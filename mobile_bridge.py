"""Opt-in phone relay: outbound HTTPS only, with a narrow application API allowlist.
The relay operator can see transient request content. This is TLS, not end-to-end encryption.
No remote commands, arbitrary paths, cloud model calls or public local listener are exposed.
"""
from __future__ import annotations
import base64
import contextlib
import hashlib
import http.client
import json
import os
import re
import secrets
import shutil
import sqlite3
import threading
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlparse, parse_qs

MAX_CHUNK = 1024 * 1024
READ_ACTIONS = {'bootstrap','library','post','jobs','patterns','plans','results','export','models'}
WRITE_ACTIONS = {'research','link','metadata','snapshot','queue','semantic','apply-semantic','plan','save-plan','review','experiment','update-experiment','import-snapshots','import-metadata','enrich-plan'}
_INSTANCES={}
_LOCK=threading.RLock()


def allowed(method, path):
    u=urlparse(path)
    if u.scheme or u.netloc or not path.startswith('/') or '\\' in path or len(path)>3000 or re.search(r'%(2f|5c|2e)',u.path,re.I):return False
    p=u.path
    if method=='GET':
        return p in ('/api/health','/api/projects') or bool(re.fullmatch(r'/api/project/[a-f0-9]{32}',p)) or (p.startswith('/api/studio/') and p[12:] in READ_ACTIONS) or bool(re.fullmatch(r'/(media/[a-f0-9]{32}|thumb/[a-f0-9]{32}/\d{1,3})',p)) or bool(re.fullmatch(r'/api/mobile/upload/[a-f0-9]{32}',p))
    if method=='POST':
        return p=='/api/save' or (p.startswith('/api/studio/') and p[12:] in WRITE_ACTIONS) or bool(re.fullmatch(r'/api/mobile/upload/(start|chunk/[a-f0-9]{32}|finish/[a-f0-9]{32})',p))
    return False


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):raise ValueError('Relay redirects are not followed')


class Bridge:
    def __init__(self,host,port):
        self.host=host;self.port=port;self.stop=threading.Event();self.thread=None
        self.config_path=host.DATA/'mobile-connection.json'
        self.journal=host.DATA/'mobile_requests.sqlite3'
        self.lock=threading.RLock();self.upload_lock=threading.RLock();self.pool=ThreadPoolExecutor(max_workers=4,thread_name_prefix='phone-relay')
        self.last_ok=0;self.error='';self.config=self.load_config()
        with self.database() as c:
            c.execute('CREATE TABLE IF NOT EXISTS operations(id TEXT PRIMARY KEY, digest TEXT, state TEXT, result TEXT, created REAL)')
            c.execute('DELETE FROM operations WHERE created<?',(time.time()-86400,))
    @contextlib.contextmanager
    def database(self):
        connection=sqlite3.connect(self.journal,timeout=15)
        try:
            with connection:yield connection
        finally:connection.close()
    def load_config(self):
        if not self.config_path.exists():return {'enabled':False}
        config=json.loads(self.config_path.read_text(encoding='utf-8'));u=urlparse(config.get('url',''))
        test=os.environ.get('RA_MOBILE_RELAY_TEST')=='1' and u.hostname in ('localhost','127.0.0.1')
        if not (u.scheme=='https' or test) or not u.hostname or u.username or u.password or u.path not in ('','/') or u.query or u.fragment or not re.fullmatch('[a-f0-9]{64}',config.get('secret','')):
            raise ValueError('Invalid private relay configuration')
        return config
    def persist(self):
        p=self.config_path.with_suffix('.tmp');p.write_text(json.dumps(self.config),encoding='utf-8');p.replace(self.config_path)
    def request(self,action,body=None,timeout=30):
        request=urllib.request.Request(self.config['url'].rstrip('/')+'/bridge/host/'+action,
            data=json.dumps(body).encode() if body is not None else None,
            headers={'Authorization':'Bearer '+self.config['secret'],'Content-Type':'application/json'})
        opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),NoRedirect())
        with opener.open(request,timeout=timeout) as response:
            raw=response.read(8*1024*1024+1)
            if len(raw)>8*1024*1024:raise ValueError('Relay response exceeds limit')
            return json.loads(raw)
    def start(self):
        if self.thread and self.thread.is_alive():
            self.stop.clear();return
        if not self.config.get('enabled'):return
        self.stop.clear();self.thread=threading.Thread(target=self.loop,daemon=True,name='ReelAnatomy-phone-connection');self.thread.start()
    def close(self):
        self.stop.set()
        if self.thread:self.thread.join(timeout=1)
        self.pool.shutdown(wait=False,cancel_futures=True)
    def loop(self):
        delay=2
        while not self.stop.is_set() and self.config.get('enabled'):
            try:
                batch=self.request('poll',timeout=28);self.last_ok=time.time();self.error='';delay=2
                for request in batch.get('requests',[])[:4]:
                    if not self.stop.is_set():self.pool.submit(self.handle,request)
            except Exception as exc:
                self.error='Relay unavailable ('+type(exc).__name__+'). Local work is unaffected.'
                self.stop.wait(delay);delay=min(delay*2,60)
    def execute(self,request):
        method=request.get('method');path=request.get('path','')
        if not allowed(method,path):return self.response(403,{'error':'Remote route denied'})
        try:body=base64.b64decode(request.get('body',''),validate=True)
        except (ValueError,TypeError):return self.response(400,{'error':'Invalid relay data'})
        if len(body)>2*MAX_CHUNK:return self.response(413,{'error':'Chunk exceeds limit'})
        headers={}
        supplied=request.get('headers',{})
        for name in ('content-type','range'):
            if isinstance(supplied.get(name),str) and len(supplied[name])<500:headers[name]=supplied[name]
        if path.startswith('/media/'):
            value=headers.get('range','bytes=0-');match=re.fullmatch(r'bytes=(\d+)-(\d*)',value)
            if not match:return self.response(416,{'error':'Single byte range required'})
            start=int(match[1]);end=min(int(match[2]) if match[2] else start+MAX_CHUNK-1,start+MAX_CHUNK-1)
            headers['range']=f'bytes={start}-{end}'
        # Fixed loopback destination and an independent path allowlist prevent SSRF.
        conn=http.client.HTTPConnection('127.0.0.1',self.port,timeout=45)
        try:
            conn.request(method,path,body=body or None,headers=headers);r=conn.getresponse();raw=r.read(3*MAX_CHUNK+1)
            if len(raw)>3*MAX_CHUNK:return self.response(413,{'error':'Response is too large for the mobile relay; use desktop export'})
            return {'status':r.status,'headers':{k.lower():v for k,v in r.getheaders() if k.lower() in ('content-type','content-range','accept-ranges')},'body':base64.b64encode(raw).decode()}
        finally:conn.close()
    @staticmethod
    def response(status,value):return {'status':status,'headers':{'content-type':'application/json'},'body':base64.b64encode(json.dumps(value).encode()).decode()}
    def handle(self,request):
        identity=request.get('id','')
        if not re.fullmatch(r'[a-f0-9-]{36}',identity):return
        fingerprint=hashlib.sha256(json.dumps({k:request.get(k) for k in ('method','path','body','headers')},sort_keys=True).encode()).hexdigest()
        writing=request.get('method')=='POST';result=None
        try:
            if writing:
                with self.lock,self.database() as c:
                    row=c.execute('SELECT digest,state,result FROM operations WHERE id=?',(identity,)).fetchone()
                    if row:
                        if row[0]!=fingerprint:result=self.response(409,{'error':'Operation identity conflict'})
                        elif row[1]=='complete':result=json.loads(row[2])
                        else:result=self.response(409,{'error':'Prior write outcome is unknown. Inspect the library or queue before retrying.','operation_id':identity})
                    else:c.execute('INSERT INTO operations VALUES (?,?,?,?,?)',(identity,fingerprint,'started',None,time.time()))
            if result is None:
                result=self.execute(request)
                if writing:
                    with self.lock,self.database() as c:c.execute("UPDATE operations SET state='complete',result=? WHERE id=?",(json.dumps(result),identity))
        except Exception as exc:
            result=self.response(502,{'error':'Desktop request failed. A change may have completed; reload before retrying.','operation_id':identity})
        result['id']=identity
        try:self.request('reply',result,timeout=20)
        except Exception:pass  # Never replay a local write because acknowledgement was lost.
    def status(self):
        return {'configured':bool(self.config.get('url')),'enabled':self.config.get('enabled',False),'url':self.config.get('url',''),
                'connected':self.config.get('enabled',False) and time.time()-self.last_ok<45,'error':self.error,
                'notice':'Paired phones can access this studio while the app is open. Requests travel through a Cloudflare HTTPS relay; this is not end-to-end encryption.'}
    def pair(self):
        if not self.config.get('url'):raise ValueError('This desktop has no relay configured. Follow MOBILE.md to deploy a private relay.')
        self.config['enabled']=True;self.persist();self.start()
        code=secrets.token_hex(32);result=self.request('pair',{'hash':hashlib.sha256(code.encode()).hexdigest()})
        return {'url':self.config['url'].rstrip('/')+'/#pair='+code,'token':code,'expires':result['expires'],'notice':'One use, valid for fifteen minutes. Treat this link as a password.'}
    def disable(self):
        # Revoke first: if it fails, retain a visible warning rather than claim revocation.
        result=self.request('revoke',{'id':'all'})
        self.config['enabled']=False;self.persist();self.stop.set();return {'disabled':True,'revoked':bool(result.get('ok'))}
    def upload(self,path,method,raw):
        folder=self.host.DATA/'mobile_uploads';folder.mkdir(exist_ok=True)
        with self.upload_lock:
            for old in folder.glob('*.json'):
                if old.stat().st_mtime<time.time()-86400:
                    old.with_suffix('.part').unlink(missing_ok=True);old.unlink(missing_ok=True)
            if path=='/api/mobile/upload/start' and method=='POST':
                data=json.loads(raw);filename=data.get('filename','');suffix=Path(filename).suffix.lower();total=data.get('size')
                if suffix not in ('.mp4','.mov','.m4v','.webm') or not isinstance(total,int) or isinstance(total,bool) or not 0<total<=self.host.MAX_VIDEO_BYTES:raise ValueError('Choose a video up to 200 MB')
                active=0
                for item in folder.glob('*.json'):
                    if json.loads(item.read_text(encoding='utf-8')).get('state') in ('uploading','submitting'):active+=1
                if active>=16:raise ValueError('Finish existing mobile uploads before starting another')
                if shutil.disk_usage(folder).free<total+1_000_000_000:raise ValueError('Desktop needs at least 1 GB free')
                metadata=data.get('metadata',{});transcript=data.get('transcript','')
                if not isinstance(metadata,dict) or metadata.get('rights_confirmed') is not True:raise ValueError('Confirm permission to process the footage')
                if not isinstance(transcript,str) or len(transcript)>200000:raise ValueError('Invalid subtitle data')
                import studio_api
                studio_api.engine(self.host).store.require_workspace(metadata.get('workspace','default'))
                identity=secrets.token_hex(16);doc={'id':identity,'filename':Path(filename).name[:160],'size':total,'received':0,'metadata':metadata,'transcript':transcript,'state':'uploading','result':None}
                (folder/(identity+'.part')).touch();self.save_upload(folder,doc);return doc
            match=re.fullmatch(r'/api/mobile/upload/(?:(chunk|finish)/)?([a-f0-9]{32})(?:\?offset=(\d+))?',path)
            if not match:raise ValueError('Unknown upload route')
            action,identity,offset=match.groups();file=folder/(identity+'.json');doc=json.loads(file.read_text(encoding='utf-8'));part=folder/(identity+'.part')
            if method=='GET':return {k:v for k,v in doc.items() if k not in ('metadata','transcript')}
            if action=='chunk':
                if doc['state']!='uploading' or offset is None:raise ValueError('Upload is not accepting chunks')
                at=int(offset)
                if not 0<len(raw)<=MAX_CHUNK or at+len(raw)>doc['size']:raise ValueError('Invalid upload chunk')
                if at<doc['received']:
                    with part.open('rb') as f:f.seek(at);prior=f.read(len(raw))
                    if prior!=raw:raise ValueError('Chunk conflicts with previously received data')
                    return {'received':doc['received']}
                if at!=doc['received']:raise ValueError('Upload offset mismatch; inspect progress before retrying')
                with part.open('r+b') as f:f.seek(at);f.write(raw);f.flush();os.fsync(f.fileno())
                doc['received']+=len(raw);self.save_upload(folder,doc);return {'received':doc['received']}
            if action=='finish':
                if doc['state']=='complete':return doc['result']
                if doc['state']!='uploading':raise ValueError('Submission outcome unknown. Inspect the desktop queue; do not resubmit blindly.')
                if doc['received']!=doc['size']:raise ValueError('Upload is incomplete')
                doc['state']='submitting';self.save_upload(folder,doc)
                import studio_api
                fields={'video':(doc['filename'],part.read_bytes()),'metadata':(None,json.dumps(doc['metadata']).encode()),'transcript':(None,doc['transcript'].encode())}
                result=studio_api.engine(self.host).import_video(fields)
                doc.update(state='complete',result=result);self.save_upload(folder,doc);part.unlink(missing_ok=True);return result
            raise ValueError('Unsupported upload action')
    @staticmethod
    def save_upload(folder,doc):
        p=folder/(doc['id']+'.json');temp=p.with_suffix('.tmp');temp.write_text(json.dumps(doc),encoding='utf-8');temp.replace(p)


def instance(host,port):
    key=str(host.DATA.resolve())
    with _LOCK:
        if key not in _INSTANCES:_INSTANCES[key]=Bridge(host,port)
        return _INSTANCES[key]


def route(host,handler,raw=None):
    bridge=instance(host,handler.server.server_port);path=handler.path
    try:
        if path.startswith('/api/mobile/upload/'):
            return handler.send(200,bridge.upload(path,handler.command,raw or b''))
        if path=='/api/mobile/status' and raw is None:return handler.send(200,bridge.status())
        if path=='/api/mobile/devices' and raw is None:
            return handler.send(200,bridge.request('devices') if bridge.config.get('url') else {'devices':[]})
        if path=='/api/mobile/pair' and raw is not None:return handler.send(200,bridge.pair())
        if path=='/api/mobile/disable' and raw is not None:return handler.send(200,bridge.disable())
        if path=='/api/mobile/revoke' and raw is not None:
            data=json.loads(raw);return handler.send(200,bridge.request('revoke',{'id':data.get('id')}))
        return handler.send(404,{'error':'Unknown mobile action'})
    except (ValueError,KeyError,TypeError,FileNotFoundError) as exc:return handler.send(400,{'error':str(exc) if isinstance(exc,ValueError) else 'Invalid mobile request'})
    except (OSError,http.client.HTTPException):return handler.send(503,{'error':'Relay is unavailable. No local data was removed.'})

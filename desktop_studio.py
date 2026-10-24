"""Modern desktop host for the same static app plus bounded offline speech jobs.
No public listener, relay, account authentication, remote URL fetch or model download.
"""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import io
import json
import mimetypes
import os
import re
import secrets
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit,unquote

ROOT=Path(getattr(sys,'_MEIPASS',Path(__file__).resolve().parent))
SITE=ROOT/'phone-dist'
MODEL=ROOT/'models/base.en'
MAX_BYTES=100*1024*1024
TOKEN=secrets.token_urlsafe(32)
LOCK=threading.RLock()
JOBS={}
VERSION='1.0.0-rc.4'
RUN_LIMIT=240
MIMES={'audio/wav','audio/x-wav','audio/mpeg','audio/mp4','audio/x-m4a','audio/flac','audio/ogg','audio/webm','audio/aac','video/x-m4v','video/mp4','video/quicktime','video/webm','application/octet-stream'}


def decode_bounded_audio(data,max_seconds=900):
    import av
    import numpy as np
    pieces=[];count=0;limit=int(max_seconds*16000)
    resampler=av.AudioResampler(format='s16',layout='mono',rate=16000)
    with av.open(io.BytesIO(data)) as media:
        for frame in media.decode(audio=0):
            for chunk in resampler.resample(frame):
                samples=chunk.to_ndarray().reshape(-1)
                count+=len(samples)
                if count>limit:raise ValueError('Decoded audio exceeds the fifteen-minute speech limit.')
                pieces.append(samples)
        for chunk in resampler.resample(None):
            samples=chunk.to_ndarray().reshape(-1);count+=len(samples)
            if count>limit:raise ValueError('Decoded audio exceeds the fifteen-minute speech limit.')
            pieces.append(samples)
    if not pieces:raise ValueError('No decodable audio samples were found.')
    return np.concatenate(pieces).astype(np.float32)/32768.0


def speech_job(input_path:Path,output_path:Path):
    # Separate process gives cancellation and deadline a real termination boundary.
    os.environ['HF_HUB_OFFLINE']='1';os.environ['TRANSFORMERS_OFFLINE']='1'
    import av
    from faster_whisper import WhisperModel
    sys.path.insert(0,str(ROOT/'standalone'))
    import timed_captions
    if not all(MODEL.joinpath(name).is_file() for name in ('model.bin','config.json','tokenizer.json')):raise ValueError('Bundled local English speech model is missing. No download was attempted.')
    if not 0<input_path.stat().st_size<=MAX_BYTES:raise ValueError('Audio file is empty or exceeds 100 MB.')
    data=input_path.read_bytes()
    with av.open(io.BytesIO(data)) as media:
        allowed={'wav','mp3','flac','ogg','mov','mp4','m4a','3gp','3g2','mj2','matroska','webm','aac'}
        if not set(media.format.name.split(','))&allowed or not media.streams.audio:
            raise ValueError('Use a supported audio or video container with an audio track.')
        if media.duration and media.duration/1_000_000>900:raise ValueError('Local speech jobs are limited to fifteen minutes.')
    samples=decode_bounded_audio(data)
    duration=len(samples)/16000
    if not .1<duration<=900:raise ValueError('Use audio between 0.1 seconds and fifteen minutes.')
    model=WhisperModel(str(MODEL),device='cpu',compute_type='int8',cpu_threads=2,num_workers=1,local_files_only=True)
    segments,info=model.transcribe(samples,language='en',vad_filter=True,word_timestamps=True,beam_size=3,condition_on_previous_text=False)
    words=[]
    for segment in segments:
        for word in segment.words or []:
            words.append({'start':round(word.start,3),'end':round(word.end,3),'word':word.word.strip(),'probability':round(word.probability,4)})
        if len(words)>12000:raise ValueError('Speech output exceeds the word limit.')
    if not words:raise ValueError('No speech was recognised. Silence is not a successful transcript.')
    cues=timed_captions.cues_from_words(words,duration)
    result={'schema':1,'method':'local-whisper-words','model':'faster-whisper/base.en','language':'en','duration':round(duration,3),
        'audio_sha256':hashlib.sha256(data).hexdigest(),'words':words,'cues':cues,'subtitles':timed_captions.srt(cues),
        'provenance':'Bundled English Whisper base.en, CPU int8, word timestamps. Local recognition, not verified transcription or forced alignment to the supplied script.',
        'limits':['Recognition and word boundaries can be wrong. Inspect against the actual audio.','English model; other languages are not supported by this bundle.']}
    output_path.write_text(json.dumps(result,ensure_ascii=False,allow_nan=False),encoding='utf-8')


def run_job(job):
    folder=Path(job['folder']);out=folder/'result.json';process=None
    try:
        with LOCK:
            if job['status']=='cancelled':return
            job['status']='running'
        args=[sys.executable] if getattr(sys,'frozen',False) else [sys.executable,str(Path(__file__).resolve())]
        args+=['--speech-job',str(folder/'media.bin'),str(out)]
        with (folder/'worker.log').open('wb') as log:
            process=subprocess.Popen(args,stdout=log,stderr=log,env=dict(os.environ,HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1'),
                creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
            with LOCK:job['process']=process
            began=time.monotonic()
            while process.poll() is None:
                if job['cancel'].wait(.1):process.terminate();break
                if time.monotonic()-began>RUN_LIMIT:process.terminate();raise TimeoutError('Speech processing exceeded four minutes. Use a shorter clip.')
            try:code=process.wait(timeout=5)
            except subprocess.TimeoutExpired:process.kill();code=process.wait(timeout=5)
        with LOCK:
            if job['cancel'].is_set():job['status']='cancelled';return
            if code!=0 or not out.exists():
                message='Local speech recognition could not process this recording.'
                try:
                    tail=(folder/'worker.log').read_text(encoding='utf-8',errors='replace').splitlines()[-1]
                    if tail.startswith('SPEECH_ERROR:'):message=tail[len('SPEECH_ERROR:'):][:300]
                except OSError:pass
                raise ValueError(message)
            result=json.loads(out.read_text(encoding='utf-8'))
            if result['audio_sha256']!=job['sha256']:raise ValueError('Speech output does not match the supplied audio.')
            job.update(status='complete',result=result)
    except Exception as error:
        with LOCK:
            if job['cancel'].is_set():job['status']='cancelled'
            else:job.update(status='failed',error=str(error)[:400])
    finally:
        if process and process.poll() is None:
            process.kill();process.wait(timeout=5)
        shutil.rmtree(folder,ignore_errors=True)
        with LOCK:job.pop('process',None);job.pop('folder',None)


class Handler(BaseHTTPRequestHandler):
    server_version='ReelAnatomyDesktop/1'
    def setup(self):super().setup();self.connection.settimeout(30)
    def log_message(self,*args):pass
    def trusted(self,write=False):
        host='127.0.0.1:'+str(self.server.server_port)
        allowed={host,'localhost:'+str(self.server.server_port)}
        if self.headers.get('Host','') not in allowed or self.headers.get('Sec-Fetch-Site','')=='cross-site':return False
        origin=self.headers.get('Origin')
        if origin is not None and origin not in {'http://'+x for x in allowed}:return False
        if write and not secrets.compare_digest(self.headers.get('X-Reel-Token',''),TOKEN):return False
        return True
    def reply(self,status,body,mime='application/json',headers=None):
        raw=body if isinstance(body,bytes) else json.dumps(body,ensure_ascii=False).encode()
        self.send_response(status);self.send_header('Content-Type',mime);self.send_header('Content-Length',str(len(raw)))
        self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.send_header('Referrer-Policy','no-referrer')
        for key,value in (headers or {}).items():self.send_header(key,value)
        self.end_headers()
        try:self.wfile.write(raw)
        except (BrokenPipeError,ConnectionResetError):pass
    def do_GET(self):
        if not self.trusted():return self.reply(403,{'error':'Local origin required.'})
        path=unquote(urlsplit(self.path).path)
        if path=='/api/companion/health':
            return self.reply(200,{'app':'reel-anatomy-desktop','version':VERSION,'speech':all(MODEL.joinpath(name).is_file() for name in ('model.bin','config.json','tokenizer.json')) and importlib.util.find_spec('faster_whisper') is not None,
                'model':'base.en','token':TOKEN,'network_processing':False,'max_bytes':MAX_BYTES,'max_seconds':900})
        if path.startswith('/api/companion/jobs/'):
            if not self.trusted(True):return self.reply(403,{'error':'Session token required.'})
            identity=path.rsplit('/',1)[-1]
            with LOCK:
                job=JOBS.get(identity)
                if not job:return self.reply(404,{'error':'Speech job not found. Server may have restarted.'})
                return self.reply(200,{k:job[k] for k in ('id','status','error','result') if k in job})
        if path.startswith('/api/'):return self.reply(404,{'error':'Unsupported desktop action.'})
        if path=='/':path='/index.html'
        try:
            target=(SITE/path.lstrip('/')).resolve()
            if not target.is_relative_to(SITE.resolve()) or any(p.startswith('.') and p!='.nojekyll' for p in Path(path).parts) or not target.is_file():
                return self.reply(404,{'error':'Not found.'})
            mime={'.mjs':'text/javascript','.js':'text/javascript','.wasm':'application/wasm','.webmanifest':'application/manifest+json'}.get(target.suffix) or mimetypes.guess_type(str(target))[0] or 'application/octet-stream'
            self.reply(200,target.read_bytes(),mime)
        except (OSError,ValueError):self.reply(404,{'error':'Not found.'})
    def do_POST(self):
        self.close_connection=True
        if not self.trusted(True):return self.reply(403,{'error':'Same-origin session token required.'})
        try:
            if self.headers.get('Transfer-Encoding'):raise ValueError('Chunked request bodies are not supported.')
            length=int(self.headers.get('Content-Length','0'))
            if not 0<length<=MAX_BYTES:return self.reply(413,{'error':'Supply a nonempty file up to 100 MB.'})
            path=urlsplit(self.path).path
            if re.fullmatch(r'/api/companion/jobs/[a-f0-9]{32}/cancel',path):
                if length>1000:return self.reply(413,{'error':'Invalid cancellation body.'})
                self.rfile.read(length);identity=path.split('/')[-2]
                with LOCK:
                    job=JOBS.get(identity)
                    if not job:return self.reply(404,{'error':'Job not found.'})
                    if job['status'] in ('queued','running'):job['cancel'].set();job['status']='cancelled'
                return self.reply(200,{'id':identity,'status':job['status']})
            if path!='/api/companion/jobs':return self.reply(404,{'error':'Unsupported action.'})
            if self.headers.get('Content-Type','').split(';')[0] not in MIMES:return self.reply(415,{'error':'Unsupported audio or video content type.'})
            with LOCK:
                if any(j['status'] in ('queued','running') or j.get('process') for j in JOBS.values()):return self.reply(409,{'error':'Another recording is being processed. Let it finish or cancel it.'})
                if len(JOBS)>=20:
                    for key in list(JOBS)[:-10]:JOBS.pop(key,None)
                identity=secrets.token_hex(16);folder=Path(tempfile.mkdtemp(prefix='reel-speech-'))
                job={'id':identity,'status':'queued','folder':str(folder),'cancel':threading.Event()};JOBS[identity]=job
            try:
                h=hashlib.sha256();remaining=length
                with (folder/'media.bin').open('wb') as handle:
                    while remaining:
                        chunk=self.rfile.read(min(1048576,remaining))
                        if not chunk:raise ValueError('Upload interrupted before the complete recording arrived.')
                        handle.write(chunk);h.update(chunk);remaining-=len(chunk)
                job['sha256']=h.hexdigest()
                threading.Thread(target=run_job,args=(job,),daemon=True).start()
                return self.reply(202,{'id':identity,'status':'queued','audio_sha256':job['sha256']})
            except Exception:
                with LOCK:job['status']='failed';job['error']='Upload did not complete.'
                shutil.rmtree(folder,ignore_errors=True);raise
        except (ValueError,OSError,TimeoutError) as error:return self.reply(400,{'error':str(error)[:300]})


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=int(os.environ.get('REEL_DESKTOP_PORT','8766')));parser.add_argument('--no-browser',action='store_true');parser.add_argument('--speech-job',nargs=2)
    args=parser.parse_args()
    if args.speech_job:
        try:speech_job(Path(args.speech_job[0]),Path(args.speech_job[1]));return
        except Exception as error:print('SPEECH_ERROR:'+str(error)[:300],flush=True);raise SystemExit(1)
    if not SITE.joinpath('BUILD.json').is_file():raise SystemExit('The app bundle is missing. Keep the whole extracted folder together.')
    if not 1024<=args.port<=65535:raise SystemExit('Choose a local port from 1024 to 65535.')
    try:server=ThreadingHTTPServer(('127.0.0.1',args.port),Handler)
    except OSError:raise SystemExit('The local port is already in use. Open the running app instead of starting another copy.')
    url=f'http://127.0.0.1:{args.port}/';print('Reel Anatomy Desktop '+VERSION+' at '+url,flush=True)
    if not args.no_browser:webbrowser.open(url)
    try:server.serve_forever()
    except KeyboardInterrupt:pass
    finally:
        with LOCK:
            for job in JOBS.values():
                job['cancel'].set()
                if job.get('process') and job['process'].poll() is None:job['process'].terminate()
        server.server_close()

if __name__=='__main__':main()

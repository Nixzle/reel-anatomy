"""Browser-local adapter. Reuses the desktop Store without an HTTP server or relay."""
import base64, json, math, re, sqlite3
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from studio_store import Store, Conflict, text, uid, now, digest, counts, moment, WINDOWS, DEFINITIONS, PLATFORMS
from embedded_core import parse_captions, classify, validate_metrics, validate_intervals
from embedded_csv import csv_import
import research_engine
import factory_engine
import release_services
import creative_lab
ROOT=Path('/reel-local')
ROOT.mkdir(exist_ok=True)
VERSION='1.0.0-rc.2'

def restore(snapshot):
    for f in ROOT.iterdir():
        if f.is_file() and (f.name.startswith('studio.sqlite3') or re.fullmatch(r'[a-f0-9]{32}\.json',f.name)):
            f.unlink()
    if snapshot:
        if snapshot.get('db'):
            (ROOT/'studio.sqlite3').write_bytes(base64.b64decode(snapshot['db'],validate=True))
        for identity,value in snapshot.get('assets',{}).items():
            if not re.fullmatch(r'[a-f0-9]{32}',identity):raise ValueError('Invalid stored asset.')
            (ROOT/(identity+'.json')).write_text(json.dumps(value),encoding='utf-8')
    s=Store(ROOT)
    research_engine.setup(s)
    factory_engine.setup(s)
    creative_lab.setup(s)
    with s.db() as c:c.execute('PRAGMA journal_mode=DELETE')
    return s

def snapshot(s):
    with s.db() as c:c.execute('PRAGMA wal_checkpoint(TRUNCATE)')
    return {'db':base64.b64encode((ROOT/'studio.sqlite3').read_bytes()).decode(),
            'assets':{f.stem:json.loads(f.read_text()) for f in ROOT.glob('*.json')}}

def asset_save(a):
    identity=a.get('id')
    if not isinstance(identity,str) or not re.fullmatch(r'[a-f0-9]{32}',identity):raise ValueError('Invalid video identity.')
    duration=a.get('duration')
    if isinstance(duration,bool) or not isinstance(duration,(int,float)) or not math.isfinite(duration) or not 0<duration<=3600:raise ValueError('Invalid video duration.')
    out={'id':identity,'title':text(a.get('title','Video'),120,True),'duration':duration,
         'segments':validate_intervals(a.get('segments',[]),duration,True),
         'shots':validate_intervals(a.get('shots',[]),duration,False),'metrics':validate_metrics(a.get('metrics',{})),
         'media':'/media/'+identity,'revision':int(a.get('revision',1)),
         'transcript_source':text(a.get('transcript_source','imported analysis'),120),
         'notices':[text(x,2000) for x in a.get('notices',[])[:30]],'app_version':VERSION,
         'timing_method':text(a.get('timing_method','imported'),120)}
    (ROOT/(identity+'.json')).write_text(json.dumps(out,allow_nan=False),encoding='utf-8')
    return out

def jobs(s):return s.setting('phone_jobs',[])
def save_jobs(s,items):s.set_setting('phone_jobs',items[-300:])

def exchange(s):
    tables={}
    for name in ('research','posts','snapshots','documents','experiments'):
        with s.db() as c:tables[name]=[json.loads(r[0]) for r in c.execute('SELECT body FROM '+name)]
    return {'format':'reel-anatomy-phone-backup','schema':1,'version':VERSION,'exported_at':now(),
            'tables':tables,'assets':snapshot(s)['assets'],'research_bundle':research_engine.bundle(s),'factory_bundle':factory_engine.bundle(s),'creative_bundle':creative_lab.bundle(s),'note':'Video files are not embedded. Reattach original media after restoring.'}

def validate_backup_document(r):
    if not isinstance(r,dict):raise ValueError('Invalid backup record.')
    if not isinstance(r.get('revision'),int) or isinstance(r.get('revision'),bool) or r['revision']<1:raise ValueError('Invalid backup revision.')
    # IDs are later used as DOM attributes. Reject unsafe values before storing.
    def check_ids(value,key=''):
        if isinstance(value,dict):
            for k,v in value.items():
                if k in ('id','asset_id','post_id','plan_id','snapshot_id','workspace') and v is not None:
                    if not isinstance(v,str) or not (v=='default' or re.fullmatch(r'[a-f0-9]{32}',v)):raise ValueError('Unsafe backup identity.')
                check_ids(v,k)
        elif isinstance(value,list):
            for item in value:check_ids(item,key)
    check_ids(r)
    if 'source_url' in r and r['source_url']:
        u=urlparse(r['source_url'])
        if u.scheme!='https' or not u.netloc or u.username or u.password:raise ValueError('Unsafe backup source link.')
    return r

def import_exchange(s,d):
    if d.get('format')!='reel-anatomy-phone-backup' or d.get('schema')!=1:raise ValueError('Not a phone backup.')
    tables=d.get('tables');assets=d.get('assets')
    if not isinstance(tables,dict) or not isinstance(assets,dict) or len(assets)>2000:raise ValueError('Invalid backup.')
    for name in ('research','posts','snapshots','documents','experiments'):
        if not isinstance(tables.get(name),list) or len(tables[name])>10000:raise ValueError('Invalid backup table.')
    def identity(x):
        if not isinstance(x,str) or not (x=='default' or re.fullmatch(r'[a-f0-9]{32}',x)):raise ValueError('Invalid backup identity.')
    if not tables['research']:raise ValueError('A backup must contain a research project.')
    for name in ('research','posts','documents','experiments'):
        for r in tables[name]:validate_backup_document(r)
    for r in tables['snapshots']:
        if not isinstance(r,dict) or r.get('window') not in WINDOWS or r.get('definition') not in DEFINITIONS:raise ValueError('Invalid snapshot definition.')
        counts(r.get('metrics'));moment(r.get('observed_at'));text(r.get('source'),500,True)
    for f in ROOT.glob('*.json'):
        if re.fullmatch(r'[a-f0-9]{32}',f.stem):f.unlink()
    for key,a in assets.items():
        if key!=a.get('id'):raise ValueError('Backup asset mismatch.')
        asset_save(a)
    with s.db() as c:
        for name in ('snapshots','experiments','documents','posts','research'):c.execute('DELETE FROM '+name)
        for r in tables['research']:
            identity(r.get('id'));text(r.get('title'),120,True)
            if r.get('platform') not in PLATFORMS:raise ValueError('Invalid research platform.')
            c.execute('INSERT INTO research VALUES (?,?)',(r['id'],json.dumps(r)))
        for r in tables['posts']:
            identity(r.get('id'));identity(r.get('asset_id'));s.clean_meta(r)
            if r['asset_id'] not in assets or not any(w['id']==r.get('workspace') for w in tables['research']):raise ValueError('Broken backup post link.')
            c.execute('INSERT INTO posts VALUES (?,?,?,?)',(r['id'],r['asset_id'],r['workspace'],json.dumps(r)))
        for r in tables['snapshots']:
            identity(r.get('id'))
            if not any(p['id']==r.get('post_id') for p in tables['posts']):raise ValueError('Broken snapshot link.')
            c.execute('INSERT INTO snapshots VALUES (?,?,?,?,?,?)',(r['id'],r['post_id'],r['window'],r['definition'],r['observed_at'],json.dumps(r)))
        for name in ('documents','experiments'):
            for r in tables[name]:
                identity(r.get('id'))
                if not any(w['id']==r.get('workspace') for w in tables['research']):raise ValueError('Broken workspace link.')
                if name=='documents' and (not isinstance(r.get('beats'),list) or not isinstance(r.get('brief'),dict) or not isinstance(r.get('history'),list)):raise ValueError('Invalid filming brief.')
                c.execute('INSERT INTO '+name+' VALUES (?,?,?)',(r['id'],r['workspace'],json.dumps(r)))
    research_engine.import_bundle(s,d.get('research_bundle'))
    factory_engine.import_bundle(s,d.get('factory_bundle'))
    creative_lab.import_bundle(s,d.get('creative_bundle'))
    save_jobs(s,[])
    return {'restored':True,'posts':len(tables['posts'])}

def import_research(s,d):
    source=d.get('research');posts=d.get('posts')
    if not isinstance(source,dict) or not isinstance(posts,list) or len(posts)>2000:raise ValueError('Invalid research export.')
    research=s.create_research({k:source.get(k,'') for k in ('title','audience','topic','objective','platform')})
    workspace=research['id'];asset_map={};post_map={};plan_map={};missing=0
    supplied=d.get('assets',{})
    if not isinstance(supplied,dict):raise ValueError('Invalid exported analysis dictionary.')
    for post in posts:
        old_asset=post.get('asset_id')
        if not isinstance(old_asset,str) or not re.fullmatch(r'[a-f0-9]{32}',old_asset):raise ValueError('Invalid exported media identity.')
        if old_asset not in asset_map:
            a=supplied.get(old_asset)
            if not a:
                a={'title':post.get('title','Imported post'),'duration':post.get('duration',1),'segments':[],'shots':[],'metrics':{},'transcript_source':'unavailable','notices':['Only metadata was included in this desktop research export. Import its analysis JSON separately for a detailed breakdown.']}
                missing+=1
            a=dict(a,id=uid());asset_save(a);asset_map[old_asset]=a['id']
        new=s.add_post(asset_map[old_asset],workspace,s.clean_meta(post));post_map[post['id']]=new['id']
    observations=d.get('snapshots',{})
    if not isinstance(observations,dict):raise ValueError('Invalid observation history.')
    for old_id,items in observations.items():
        if old_id not in post_map or not isinstance(items,list):raise ValueError('Invalid exported post observations.')
        for item in items:
            s.add_snapshot(dict(item,post_id=post_map[old_id]))
    for old in d.get('plans',[]):
        if not isinstance(old,dict) or not isinstance(old.get('brief'),dict):raise ValueError('Invalid exported brief.')
        created=s.create_plan(dict(old['brief'],workspace=workspace))
        current=dict(created,beats=old.get('beats',created['beats']),hypothesis=old.get('hypothesis',created['hypothesis']))
        saved=s.save_document(current);saved['imported_from_revision']=old.get('revision');saved['engine']=str(old.get('engine','Imported planner'))[:200]
        saved['limits'].append('Imported from a desktop export. Reference identities and performance claims require review; no transfer of source video occurred.')
        with s.db() as c:c.execute('UPDATE documents SET body=? WHERE id=?',(json.dumps(saved),saved['id']))
        plan_map[old['id']]=saved['id']
    # Preserve the original experiment records as an archival import, not new trials.
    for old in d.get('experiments',[]):
        if old.get('plan_id') not in plan_map or old.get('post_id') not in post_map:continue
        if old.get('status') not in ('planned','published','reviewed') or not isinstance(old.get('frozen_plan'),dict):raise ValueError('Invalid exported experiment.')
        record=dict(old,id=uid(),workspace=workspace,post_id=post_map[old['post_id']],plan_id=plan_map[old['plan_id']],imported=True)
        record.pop('snapshots',None);record.pop('outcome',None)
        with s.db() as c:c.execute('INSERT INTO experiments VALUES (?,?,?)',(record['id'],workspace,json.dumps(record)))
    return {'workspace':workspace,'posts':len(posts),'missing_analysis':missing,'note':'Imported as a new project. Existing work was not overwritten.'}

def dispatch(s,path,method,d):
    u=urlparse(path);path=u.path;q=parse_qs(u.query);arg=lambda k,default='':q.get(k,[default])[0]
    workspace=arg('workspace','default')
    if path=='/api/release/register-render' and method=='POST':
        return release_services.register_render(s,d,asset_save)
    if path=='/api/documents/import' and method=='POST':
        return release_services.import_document(s,d)
    if path.startswith('/api/lab/'):
        return creative_lab.route(s,path,method,d,q)
    if path.startswith('/api/factory/'):
        return factory_engine.route(s,path,method,d,q)
    if path.startswith('/api/research/'):
        result=research_engine.route(s,path,method,d,q)
        if path.endswith('/context'):
            p=creative_lab.profile(s,d.get('workspace','default'))
            result['voice_profile']={k:p[k] for k in ('audience','voice','preferred','avoid','cta','example','revision')}
        return result
    if method=='GET':
        if path=='/api/health':return {'ok':True,'version':VERSION,'ffmpeg':False,'speech':False,'local_only':True,'phone':True}
        if path=='/api/projects':
            return [{'id':a['id'],'title':a['title'],'duration':a['duration'],'segments':len(a['segments']),'shots':len(a['shots'])} for a in snapshot(s)['assets'].values()]
        if path.startswith('/api/project/'):return s.asset(path.rsplit('/',1)[1])
        if path=='/api/studio/bootstrap':
            s.legacy_import();return {'research':s.research(),'jobs':jobs(s),'queue_paused':s.setting('queue_paused',False),'model':{'enabled':False},'version':VERSION}
        if path=='/api/studio/library':return {'posts':s.posts(workspace,text(arg('q'),200),arg('collection'))}
        if path=='/api/studio/post':
            p=s.get_post(arg('id'));return {'post':p,'asset':s.asset(p['asset_id']),'snapshots':s.snapshots(p['id']),'semantic':s.semantics(p['asset_id'])}
        if path=='/api/studio/jobs':return {'jobs':jobs(s),'paused':s.setting('queue_paused',False)}
        if path=='/api/studio/patterns':return s.patterns(workspace,arg('window','24h'),arg('definition','instagram_views'))
        if path=='/api/studio/plans':return {'plans':s.documents(workspace)}
        if path=='/api/studio/results':return {'experiments':s.experiments(workspace)}
        if path=='/api/studio/models':return {'available':False,'models':[],'configured':{'enabled':False},'note':'This phone edition runs locally. Import desktop analysis JSON for automatic speech results; no language model is bundled here.'}
        if path=='/api/studio/export':
            posts=s.posts(workspace)
            return {'version':VERSION,'research':s.require_workspace(workspace),'posts':posts,'assets':{p['asset_id']:s.asset(p['asset_id']) for p in posts},'snapshots':{p['id']:s.snapshots(p['id']) for p in posts},'plans':s.documents(workspace),'experiments':s.experiments(workspace),'limits':'Local observations only. Video files are not embedded.'}
        if path=='/phone/export':return exchange(s)
        raise ValueError('Route is not available in the on-device app.')
    if path=='/api/save':
        a=s.asset(d['id'])
        if a.get('revision',0)!=d.get('revision',0):raise Conflict('This video changed. Reopen before saving.')
        d['revision']=a.get('revision',0)+1;result=asset_save(d);return {'ok':True,'revision':result['revision']}
    if path=='/api/studio/research':return s.create_research(d)
    if path=='/api/studio/link':return s.add_post(d['asset_id'],d.get('workspace','default'),d.get('metadata',{}))
    if path=='/api/studio/metadata':return s.update_post(d)
    if path=='/api/studio/snapshot':return s.add_snapshot(d)
    if path=='/api/studio/plan':return creative_lab.create_plan(s,d)
    if path=='/api/studio/save-plan':return s.save_document(d)
    if path=='/api/studio/review':return s.review_draft(d['plan_id'],d['post_id'])
    if path=='/api/studio/experiment':return s.create_experiment(d)
    if path=='/api/studio/update-experiment':return s.update_experiment(d)
    if path in ('/api/studio/import-snapshots','/api/studio/import-metadata'):return csv_import(s,d,'metadata' if path.endswith('metadata') else 'snapshots')
    if path=='/api/studio/configure' and not d.get('enabled'):return {'enabled':False}
    if path in ('/api/studio/semantic','/api/studio/enrich-plan','/api/studio/configure','/api/studio/apply-semantic'):
        raise ValueError('Learned analysis is not running on this phone. Import completed desktop analysis; no cloud call or model download was made.')
    if path=='/api/studio/queue':
        action=d.get('action');items=jobs(s)
        if action in ('pause_all','resume_all'):s.set_setting('queue_paused',action=='pause_all')
        else:
            j=next((j for j in items if j['id']==d.get('id')),None)
            if not j:raise ValueError('Job not found.')
            if action=='resume' and j['status'] in ('paused','failed'):j.update(status='queued',error='',stage='Queued')
            elif action=='cancel' and j['status'] in ('queued','paused','failed'):j.update(status='cancelled',stage='Cancelled')
            else:raise Conflict('The current video must finish before changing it.')
            save_jobs(s,items)
        return {'ok':True}
    if path=='/phone/job-add':
        meta=s.clean_meta(d['metadata']);s.require_workspace(d.get('workspace','default'))
        if not meta['rights_confirmed']:raise ValueError('Confirm permission to process this video.')
        items=jobs(s)
        if sum(j['status'] in ('queued','running','paused') for j in items)>=200:raise ValueError('Finish or cancel jobs before adding more.')
        j={'id':uid(),'kind':'import','title':text(d['title'],120,True),'status':'queued','stage':'Queued on this device','error':'','result':None,'created_at':now(),'payload':dict(d,metadata=meta)}
        items.append(j);save_jobs(s,items);return {'id':j['id'],'status':'queued'}
    if path=='/phone/recover':
        items=jobs(s)
        for j in items:
            if j['status']=='running':j.update(status='paused',stage='Interrupted. Resume with the app open.')
        save_jobs(s,items);return {'ok':True}
    if path=='/phone/claim':
        if s.setting('queue_paused',False):return None
        items=jobs(s)
        if any(j['status']=='running' for j in items):return None
        j=next((j for j in items if j['status']=='queued'),None)
        if j:j.update(status='running',stage='Inspecting video on this device');save_jobs(s,items)
        return j
    if path=='/phone/reuse':
        items=jobs(s);j=next(x for x in items if x['id']==d['id']);p=j['payload']
        a=s.asset(p['asset_id']);post=s.add_post(a['id'],p.get('workspace','default'),p['metadata'])
        j.update(status='complete',stage='Reused existing analysis',result={'asset_id':a['id'],'post_id':post['id'],'reused_analysis':True})
        save_jobs(s,items);return j
    if path=='/phone/complete':
        items=jobs(s);j=next(x for x in items if x['id']==d['id'])
        if j['status']!='running':raise Conflict('Job is no longer running.')
        if d.get('error'):j.update(status='failed',stage='Failed',error=text(d['error'],1000));save_jobs(s,items);return j
        a=d['asset'];p=j['payload'];a['id']=p['asset_id'];a['title']=p['title']
        transcript,estimated=parse_captions(p.get('transcript',''),a['duration'])
        a['segments']=[dict(index=i,start=t,end=e,text=words,role=classify(words,t,e,a['duration'])[0],reason=classify(words,t,e,a['duration'])[1],edited=False) for i,(t,e,words) in enumerate(transcript)]
        a['transcript_source']='imported captions' if transcript else 'none'
        if not transcript:a.setdefault('notices',[]).append('No speech transcription was performed on this phone. Import SRT/VTT or desktop analysis JSON.')
        if estimated:a.setdefault('notices',[]).append('Plain-text times are proportional estimates, not speech alignment.')
        a=asset_save(a);post=s.add_post(a['id'],p.get('workspace','default'),p['metadata'])
        j.update(status='complete',stage='Complete',result={'asset_id':a['id'],'post_id':post['id'],'notices':a['notices']});save_jobs(s,items);return j
    if path=='/phone/import-research':return import_research(s,d)
    if path=='/phone/import-analysis':
        incoming=dict(d['analysis'])
        if (ROOT/(str(incoming.get('id'))+'.json')).exists():incoming['id']=uid()
        a=asset_save(incoming);p=s.add_post(a['id'],d.get('workspace','default'),{'title':a['title'],'rights_confirmed':True})
        return {'asset_id':a['id'],'post_id':p['id']}
    if path=='/phone/import-backup':return import_exchange(s,d)
    raise ValueError('Unsupported on-device action.')

def handle(raw):
    request=json.loads(raw);s=restore(request.get('snapshot'));method=request.get('method','GET')
    try:
        result=dispatch(s,request['path'],method,request.get('data') or {})
        return json.dumps({'ok':True,'value':result,'snapshot':snapshot(s) if method!='GET' or request['path']=='/api/studio/bootstrap' else None},allow_nan=False)
    except (ValueError,KeyError,TypeError,OSError,sqlite3.Error) as exc:
        return json.dumps({'ok':False,'error':str(exc)[:700],'conflict':isinstance(exc,Conflict)})

"""Evidence-bound Reel production. No prediction of reach, network or publishing."""
from __future__ import annotations
import copy
import json
import math
import re
from studio_store import Conflict, text, uid, now, digest as store_digest
import research_engine as research
import timed_captions as captions

VERSION = '0.7.0-factory'
NATURES = ('unreviewed','assertion','question','opinion','instruction','demonstration')
TABLE = 'reel_campaigns'
ATTESTATIONS = ('claims_checked','rights_checked','timing_checked','visuals_checked')
def digest(value):
    # JSON crosses JavaScript (one Number type) and Python (int/float).
    # Normalise whole-number floats before hashing so 0 and 0.0 bind identically.
    def portable(item):
        if isinstance(item,float):
            if not math.isfinite(item):raise ValueError('Non-finite fingerprint value.')
            return int(item) if item.is_integer() else item
        if isinstance(item,dict):return {key:portable(child) for key,child in item.items()}
        if isinstance(item,list):return [portable(child) for child in item]
        return item
    return store_digest(portable(value))

LIMITS = ['Human review is an attestation, not independent fact verification.',
          'No predicted views, guaranteed virality or causal uplift.',
          'Caption timing is identified per variant: planned fallback or imported/recognised narration timing; review recognition accuracy.',
          'Organic variants are not a randomised A/B experiment.']

def setup(store):
    with store.db() as c:
        c.execute('CREATE TABLE IF NOT EXISTS reel_campaigns(id TEXT PRIMARY KEY,workspace TEXT NOT NULL,body TEXT NOT NULL)')
        c.execute('CREATE INDEX IF NOT EXISTS reel_campaign_workspace ON reel_campaigns(workspace)')

def finite(value,lo,hi,label):
    if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value) or not lo<=value<=hi:
        raise ValueError('Invalid '+label+'.')
    return round(float(value),3)

def get(store,identity,workspace=None):
    research.valid_id(identity)
    with store.db() as c:row=c.execute('SELECT body FROM reel_campaigns WHERE id=?',(identity,)).fetchone()
    if not row:raise ValueError('Reel campaign not found.')
    result=json.loads(row[0])
    if workspace is not None and result['workspace']!=workspace:raise ValueError('Campaign belongs to another project.')
    return result

def put(store,campaign):
    with store.db() as c:
        c.execute('INSERT INTO reel_campaigns VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body',(campaign['id'],campaign['workspace'],json.dumps(campaign,ensure_ascii=False,allow_nan=False)))

def list_campaigns(store,workspace):
    store.require_workspace(workspace)
    with store.db() as c:items=[json.loads(r[0]) for r in c.execute('SELECT body FROM reel_campaigns WHERE workspace=? ORDER BY rowid DESC',(workspace,))]
    return [{'id':x['id'],'title':x['title'],'revision':x['revision'],'created_at':x['created_at'],'variants':[{'key':v['key'],'name':v['name'],'revision':v['revision']} for v in x['variants']],'exports':len(x['exports'])} for x in items]

def clean_media(value,kind='visual'):
    if value is None:return None
    if not isinstance(value,dict):raise ValueError('Invalid asset record.')
    sha=value.get('sha256','')
    if not re.fullmatch(r'[a-f0-9]{64}',sha):raise ValueError('Asset needs its SHA-256 identity.')
    mime=text(value.get('type',''),100,True)
    expected=('image/','video/') if kind=='visual' else ('audio/',)
    if not mime.startswith(expected):raise ValueError('Wrong asset media type.')
    if mime.startswith('image/') and mime not in ('image/png','image/jpeg','image/webp'):raise ValueError('Use PNG, JPEG or WebP visuals; active image formats are not accepted.')
    size=value.get('bytes')
    if isinstance(size,bool) or not isinstance(size,int) or not 1<=size<=100*1024*1024:raise ValueError('Asset exceeds 100 MB or is empty.')
    duration=finite(value.get('duration',0),0,3600,'asset duration')
    license_kind=value.get('rights','unconfirmed')
    if license_kind not in ('owned','licensed','unconfirmed'):raise ValueError('Choose asset rights.')
    return {'sha256':sha,'name':text(value.get('name','asset'),250,True),'type':mime,'bytes':size,'duration':duration,
            'rights':license_kind,'rights_note':text(value.get('rights_note',''),1000),'credit':text(value.get('credit',''),500)}

def clean_scenes(beats,duration,claims):
    if not isinstance(beats,list) or not 1<=len(beats)<=12:raise ValueError('Use one to twelve shots.')
    out=[];last=0
    for i,b in enumerate(beats):
        start=finite(b.get('start'),0,duration,'shot start');end=finite(b.get('end'),0,duration,'shot end')
        if abs(start-last)>.011 or end-start<.5:raise ValueError('Shots must cover a continuous timeline, at least half a second each.')
        nature=b.get('nature','unreviewed')
        if nature not in NATURES:raise ValueError('Choose the statement type for each shot.')
        ids=b.get('claim_ids',[])
        if not isinstance(ids,list) or len(ids)>12 or any(x not in claims for x in ids):raise ValueError('A shot refers to an unselected claim.')
        media=clean_media(b.get('media'))
        clip_in=finite(b.get('clip_in',0),0,3600,'clip trim')
        fit=b.get('fit','cover')
        if fit not in ('cover','contain'):raise ValueError('Choose cover or contain framing.')
        card=b.get('card') is True
        out.append({'index':i,'start':start,'end':end,'role':text(b.get('role','Shot'),60),
                    'spoken':text(b.get('spoken',''),1800),'on_screen':text(b.get('on_screen',''),180),
                    'visual':text(b.get('visual',''),1500),'nature':nature,'claim_ids':list(dict.fromkeys(ids)),
                    'limitation':text(b.get('limitation',''),500),'media':media,'clip_in':clip_in,'fit':fit,'card':card})
        last=end
    if abs(last-duration)>.011:raise ValueError('Shots must finish at the planned video duration.')
    return out

def capture_evidence(store,workspace,claim_ids):
    if not isinstance(claim_ids,list) or len(claim_ids)>12:raise ValueError('Select up to twelve claims.')
    claims=[];sources={}
    for identity in list(dict.fromkeys(claim_ids)):
        claim=research.record(store,'research_claims',identity,workspace)
        claims.append(claim)
        for link in claim['links']:
            try:sources[link['source_id']]=research.record(store,'research_sources',link['source_id'],workspace)
            except ValueError:pass
    return {'claims':claims,'sources':sources,'captured_at':now()}

def evidence_hash(evidence):
    return digest({'claims':evidence['claims'],'sources':evidence['sources']})

def content_hash(campaign,variant):
    return digest({'campaign_id':campaign['id'],'workspace':campaign['workspace'],'title':campaign['title'],
                   'duration':campaign['duration'],'variant':{k:v for k,v in variant.items() if k not in ('approval','history')},
                   'evidence_hash':evidence_hash(campaign['evidence'])})

def create(store,data):
    workspace=data.get('workspace','default');store.require_workspace(workspace)
    plan=store.get_document(data.get('plan_id'))
    if plan['workspace']!=workspace:raise ValueError('Choose a filming brief from this project.')
    duration=finite(plan['brief']['duration'],10,120,'duration')
    evidence=capture_evidence(store,workspace,data.get('claim_ids',[]));ids=[x['id'] for x in evidence['claims']]
    variants=[]
    openings=[{'name':'Original opening','spoken':plan['beats'][0]['spoken'],'visual':plan['beats'][0]['visual']}]+plan.get('openings',[])[1:3]
    for i,opening in enumerate(openings):
        beats=copy.deepcopy(plan['beats'])
        beats[0].update(spoken=opening['spoken'],visual=opening['visual'])
        for b in beats:
            b['nature']='unreviewed';b['claim_ids']=ids if b['role']=='Proof' else [];b['card']=False
            if len(b.get('on_screen',''))>180:b['on_screen']=b['on_screen'][:180]
        variants.append({'key':chr(65+i),'name':opening['name'],'revision':1,'scenes':clean_scenes(beats,duration,ids),
                         'caption':plan['brief']['promise']+'\n\n'+plan['brief']['cta'],'hypothesis':opening.get('hypothesis',plan['hypothesis']),
                         'primary_metric':plan['primary_metric'],'window':'72h','narration':None,'silent_intentional':False,
                         'approval':None,'history':[]})
    campaign={'id':uid(),'workspace':workspace,'title':text(data.get('title') or plan['brief']['topic'],250,True),
              'revision':1,'created_at':now(),'updated_at':now(),'plan_id':plan['id'],'plan_revision':plan['revision'],
              'duration':duration,'brief':plan['brief'],'evidence':evidence,'variants':variants,'exports':[],
              'engine':'Existing Studio plan plus transparent hook variations; not a trained viral predictor.','limits':LIMITS}
    put(store,campaign);return with_audits(store,campaign)

def variant_of(campaign,key):
    variant=next((x for x in campaign['variants'] if x['key']==key),None)
    if variant is None:raise ValueError('Variant not found.')
    return variant

def save_variant(store,data):
    with store.lock:
        c=get(store,data.get('id'),data.get('workspace','default'))
        if c['revision']!=data.get('revision'):raise Conflict('Campaign changed. Reopen before saving.')
        old=variant_of(c,data.get('key'));incoming=data.get('variant',{})
        clean=clean_scenes(incoming.get('scenes'),c['duration'],[x['id'] for x in c['evidence']['claims']])
        old['history'].append({'revision':old['revision'],'scenes':old['scenes'],'caption':old['caption'],'at':now()})
        old['history'][-1]['timed_captions']=copy.deepcopy(old.get('timed_captions'))
        old['history']=old['history'][-25:];old['scenes']=clean
        for key,limit in [('caption',2200),('hypothesis',1000),('primary_metric',200)]:old[key]=text(incoming.get(key,old[key]),limit,True)
        window=incoming.get('window',old['window'])
        if window not in ('24h','72h','7d'):raise ValueError('Choose a fixed observation window.')
        old.update(window=window,narration=clean_media(incoming.get('narration'),'audio'),silent_intentional=incoming.get('silent_intentional') is True,
                   revision=old['revision']+1,approval=None)
        if 'timed_captions' in incoming:old['timed_captions']=captions.clean_track(incoming['timed_captions'],c['duration'])
        c['revision']+=1;c['updated_at']=now();put(store,c)
    return with_audits(store,c)

def audit(campaign,variant,current_evidence=None):
    blockers=[];warnings=[];sources=campaign['evidence']['sources'];claims={x['id']:x for x in campaign['evidence']['claims']}
    eh=evidence_hash(campaign['evidence'])
    if current_evidence is not None and evidence_hash(current_evidence)!=eh:blockers.append('Evidence changed since this campaign was created. Refresh evidence and review the script again.')
    if not claims:blockers.append('No research claims linked. Add reviewed evidence before requesting a reviewed export.')
    used=set();word_count=0
    for b in variant['scenes']:
        label='Shot '+str(b['index']+1)
        words=b['spoken'].split();word_count+=len(words)
        if len(words)*60/(b['end']-b['start'])>210:warnings.append(label+': dense narration; rehearse or adjust timing.')
        if b['nature']=='unreviewed':blockers.append(label+': classify and review the statement.')
        if b['nature']=='assertion' and not b['claim_ids']:blockers.append(label+': factual assertion lacks a linked claim.')
        for identity in b['claim_ids']:
            used.add(identity);claim=claims[identity];support=False;challenge=False
            for link in claim['links']:
                source=sources.get(link['source_id'])
                if not source or source['content_hash']!=link['content_hash']:
                    blockers.append(label+': a linked quotation is stale or missing.');continue
                if research.normalized(link['quote']) not in research.normalized(source['content']):
                    blockers.append(label+': linked quotation does not match source text.');continue
                if link['stance']=='challenges':challenge=True
                if link['stance']=='supports':
                    if not source['reviewed'] or source['level']=='metadata':blockers.append(label+': support is unreviewed or metadata only.')
                    else:support=True
            if b['nature']=='assertion' and not support:blockers.append(label+': no current reviewed support for the factual assertion.')
            if challenge and (not b['limitation'] or b['limitation'] not in b['spoken']+' '+b['on_screen']):
                blockers.append(label+': opposing evidence needs an explicit limitation in the spoken or on-screen text.')
        if not b['media'] and not b['card']:blockers.append(label+': attach a visual or explicitly choose a text card.')
        media=b['media']
        if media:
            if media['rights']=='unconfirmed' or (media['rights']=='licensed' and not media['rights_note']):blockers.append(label+': visual rights not confirmed.')
            if media['type'].startswith('video/') and b['clip_in']+b['end']-b['start']>media['duration']+.05:
                blockers.append(label+': visual clip is shorter than the selected trim and shot length.')
        phrase=' '.join([b['spoken'],b['on_screen']]).lower()
        if re.search(r'\b(we guarantee|i guarantee|guaranteed to go viral|100% viral|guaranteed viral (?:reels|views|reach))\b',phrase):
            blockers.append(label+': unsupported performance guarantee. Replace it with a testable claim.')
    if not used:blockers.append('Research is attached but not mapped to any shot.')
    if re.search(r'\b(we guarantee|i guarantee|guaranteed to go viral|100% viral|guaranteed viral (?:reels|views|reach))\b',variant['caption'].lower()):blockers.append('Post caption includes an unsupported performance guarantee.')
    if variant['narration']:
        n=variant['narration']
        if n['rights']=='unconfirmed' or (n['rights']=='licensed' and not n['rights_note']):blockers.append('Narration/audio rights not confirmed.')
        if abs(n['duration']-campaign['duration'])>max(.5,campaign['duration']*.03):blockers.append('Narration length differs from the timeline. Edit the audio or planned timing.')
    elif not variant['silent_intentional']:blockers.append('Attach narration or explicitly choose an intentionally silent edit.')
    if len({s.get('url') for s in sources.values() if s.get('url')})<2:warnings.append('Fewer than two linked source URLs. This is not an independent-source count or a reason to invent more citations.')
    blockers.extend(captions.check_track(variant.get('timed_captions'),campaign['duration'],variant.get('narration'),variant['scenes']))
    if variant.get('timed_captions'):
        caption_text=' '.join(cue['text'] for cue in variant['timed_captions']['cues'])
        script_text=' '.join(scene['spoken'] for scene in variant['scenes'])
        if re.findall(r'\w+',caption_text.casefold())!=re.findall(r'\w+',script_text.casefold()):
            blockers.append('Timed caption wording differs from the source-linked spoken script. Correct the captions or the script, then rebind and review before final export.')
        if re.search(r'\b(we guarantee|i guarantee|guaranteed to go viral|100% viral|guaranteed viral (?:reels|views|reach))\b',caption_text.lower()):
            blockers.append('Timed captions include an unsupported performance guarantee.')
        warnings.append('Recognition and timing remain estimates. Matching the written script does not prove the attached recording says those words.')
    if variant['silent_intentional']:warnings.append('This edit intentionally has no narration. Captions must carry the message.')
    approval=variant.get('approval')
    approved=bool(approval and approval.get('content_hash')==content_hash(campaign,variant) and approval.get('evidence_hash')==eh and all(approval.get('checks',{}).get(k) is True for k in ATTESTATIONS) and not blockers)
    return {'blockers':list(dict.fromkeys(blockers)),'warnings':list(dict.fromkeys(warnings)),'ready_for_review':not blockers,
            'reviewed':approved,'word_count':word_count,'words_per_minute':round(word_count*60/campaign['duration']),
            'evidence_hash':eh,'content_hash':content_hash(campaign,variant),'interpretation':'Production checks only, never a virality score.'}

def with_audits(store,c):
    try:current=capture_evidence(store,c['workspace'],[x['id'] for x in c['evidence']['claims']])
    except ValueError:current={'claims':[],'sources':{}}
    out=copy.deepcopy(c);out['audits']={v['key']:audit(c,v,current) for v in c['variants']};return out

def refresh_evidence(store,data):
    c=get(store,data['id'],data.get('workspace','default'))
    if c['revision']!=data.get('revision'):raise Conflict('Campaign changed. Reopen before refreshing.')
    c['evidence']=capture_evidence(store,c['workspace'],data.get('claim_ids',[x['id'] for x in c['evidence']['claims']]))
    valid={x['id'] for x in c['evidence']['claims']}
    for v in c['variants']:
        v['approval']=None;v['revision']+=1
        for b in v['scenes']:b['claim_ids']=[i for i in b['claim_ids'] if i in valid]
    c['revision']+=1;c['updated_at']=now();put(store,c);return with_audits(store,c)

def approve(store,data):
    c=get(store,data['id'],data.get('workspace','default'))
    if c['revision']!=data.get('revision'):raise Conflict('Campaign changed. Review the current version.')
    v=variant_of(c,data.get('key'));state=with_audits(store,c)['audits'][v['key']]
    if state['blockers']:raise ValueError('Review blocked: '+state['blockers'][0])
    checks=data.get('checks',{})
    if not all(checks.get(k) is True for k in ATTESTATIONS):raise ValueError('Confirm factual scope, rights, timing/audio and visual review.')
    v['approval']={'at':now(),'reviewer':text(data.get('reviewer',''),100,True),'checks':{k:True for k in ATTESTATIONS},
                   'content_hash':content_hash(c,v),'evidence_hash':state['evidence_hash'],'meaning':'User attestation, not automated fact verification or promised reach.'}
    c['revision']+=1;c['updated_at']=now();put(store,c);return with_audits(store,c)

def make_package(store,data):
    c=get(store,data['id'],data.get('workspace','default'));v=variant_of(c,data.get('key'))
    state=with_audits(store,c)['audits'][v['key']];mode=data.get('mode','draft')
    if mode not in ('draft','reviewed'):raise ValueError('Choose draft or reviewed export.')
    invalid=captions.check_track(v.get('timed_captions'),c['duration'],v.get('narration'),v['scenes'])
    if invalid:raise ValueError(invalid[0])
    if mode=='reviewed' and not state['reviewed']:raise ValueError('A current human review with no unresolved production blockers is required.')
    result={'format':'reel-factory-package','schema':1,'version':VERSION,'created_at':now(),'campaign_id':c['id'],'workspace':c['workspace'],
            'campaign_revision':c['revision'],'title':c['title'],'duration':c['duration'],'variant':copy.deepcopy(v),'evidence':copy.deepcopy(c['evidence']),
            'approval':v.get('approval') if mode=='reviewed' else None,'mode':mode,'audit':state,'aspect':'9:16',
            'publication':'Not posted. Export is not permission for automatic publishing.','limits':LIMITS}
    result['package_hash']=digest(result);return result

def verify_package(p):
    if not isinstance(p,dict) or p.get('format')!='reel-factory-package' or p.get('schema')!=1:raise ValueError('Not a Reel Factory package.')
    other=dict(p);sha=other.pop('package_hash',None)
    if sha!=digest(other):raise ValueError('Package integrity mismatch.')
    research.valid_id(p.get('campaign_id'))
    finite(p.get('duration'),10,120,'video duration');text(p.get('title'),250,True)
    evidence=p.get('evidence',{})
    if not isinstance(evidence.get('claims'),list) or not isinstance(evidence.get('sources'),dict) or len(evidence['claims'])>12:raise ValueError('Invalid package evidence.')
    ids=[]
    for claim in evidence['claims']:
        research.valid_id(claim.get('id'));ids.append(claim['id']);text(claim.get('statement'),2000,True)
    for identity,source in evidence['sources'].items():
        research.valid_id(identity)
        if source.get('id')!=identity or research.clean_source(source)['content_hash']!=source.get('content_hash'):raise ValueError('Invalid source identity or content hash.')
    v=p.get('variant',{})
    if v.get('key') not in ('A','B','C'):raise ValueError('Invalid variant key.')
    normalized=clean_scenes(v.get('scenes'),p['duration'],ids)
    if any(isinstance(b.get('index'),bool) or b.get('index')!=i for i,b in enumerate(v['scenes'])):raise ValueError('Invalid shot index.')
    clean_media(v.get('narration'),'audio')
    caption_errors=captions.check_track(v.get('timed_captions'),p['duration'],v.get('narration'),v['scenes'])
    if caption_errors:raise ValueError(caption_errors[0])
    text(v.get('caption'),2200,True)
    if p.get('mode') not in ('draft','reviewed'):raise ValueError('Invalid package mode.')
    c={'id':p['campaign_id'],'workspace':p['workspace'],'title':p['title'],'duration':p['duration'],'evidence':evidence}
    state=audit(c,v)
    if p['mode']=='reviewed' and not state['reviewed']:raise ValueError('Reviewed package does not retain valid evidence and approval.')
    return state

def receipt(store,data):
    c=get(store,data['id'],data.get('workspace','default'));package=make_package(store,data)
    if data.get('package_hash')!=package.get('package_hash'):
        # Creation time differs; bind to the stable content/evidence fingerprints instead.
        if data.get('content_hash')!=package['audit']['content_hash'] or data.get('evidence_hash')!=package['audit']['evidence_hash']:
            raise Conflict('Export no longer matches current content or evidence.')
    sha=data.get('file_sha256','')
    if not re.fullmatch(r'[a-f0-9]{64}',sha):raise ValueError('Export needs a file hash.')
    result={'id':uid(),'at':now(),'key':data['key'],'mode':data.get('mode','draft'),'file_sha256':sha,
            'bytes':int(finite(data.get('bytes'),1,512*1024*1024,'output size')),'mime':text(data.get('mime'),100,True),
            'content_hash':package['audit']['content_hash'],'evidence_hash':package['audit']['evidence_hash'],
            'status':'rendered locally; not published'}
    c['exports'].append(result);c['exports']=c['exports'][-100:];c['revision']+=1;put(store,c);return result

def bundle(store):
    with store.db() as c:return [json.loads(r[0]) for r in c.execute('SELECT body FROM reel_campaigns')]

def import_bundle(store,rows):
    if rows is None:rows=[]
    if not isinstance(rows,list) or len(rows)>500:raise ValueError('Invalid campaign backup.')
    clean=[]
    for row in rows:
        c=copy.deepcopy(row);research.valid_id(c.get('id'));store.require_workspace(c.get('workspace'))
        finite(c.get('duration'),10,120,'campaign duration');text(c.get('title'),250,True)
        if not isinstance(c.get('variants'),list) or not 1<=len(c['variants'])<=3:raise ValueError('Invalid variants.')
        if not isinstance(c.get('evidence'),dict) or not isinstance(c['evidence'].get('claims'),list):raise ValueError('Invalid campaign evidence.')
        if len(c['evidence']['claims'])>12 or not isinstance(c['evidence'].get('sources'),dict):raise ValueError('Invalid campaign research size.')
        ids=[research.valid_id(x['id']) for x in c['evidence']['claims']]
        for identity,source in c['evidence']['sources'].items():
            research.valid_id(identity)
            if source.get('id')!=identity or research.clean_source(source)['content_hash']!=source.get('content_hash'):raise ValueError('Invalid backed-up source content.')
        for claim in c['evidence']['claims']:
            text(claim.get('statement'),2000,True)
            if not isinstance(claim.get('links'),list) or len(claim['links'])>30:raise ValueError('Invalid claim links.')
            for link in claim['links']:
                research.valid_id(link.get('source_id'));text(link.get('quote'),2000,True)
                if link.get('citation')!='S-'+link['source_id'][:10].upper():raise ValueError('Invalid citation label.')
        for v in c['variants']:
            if v.get('key') not in ('A','B','C'):raise ValueError('Invalid variant identity.')
            v['scenes']=clean_scenes(v['scenes'],c['duration'],ids);v['narration']=clean_media(v.get('narration'),'audio');v['approval']=None
            if 'timed_captions' in v:v['timed_captions']=captions.clean_track(v['timed_captions'],c['duration'])
            for key,limit in [('caption',2200),('hypothesis',1000),('primary_metric',200),('name',120)]:text(v.get(key,''),limit,True)
        c['restore_note']='Imported metadata requires renewed review and local media attachment.';c['exports']=[];clean.append(c)
    with store.db() as db:
        db.execute('DELETE FROM reel_campaigns')
        for c in clean:db.execute('INSERT INTO reel_campaigns VALUES (?,?,?)',(c['id'],c['workspace'],json.dumps(c)))
    return True

def save_captions(store,data):
    with store.lock:
        c=get(store,data['id'],data.get('workspace','default'))
        if c['revision']!=data.get('revision'):raise Conflict('Campaign changed while captions were prepared. Reload before applying them.')
        v=variant_of(c,data.get('key'))
        if data.get('clear') is True:v['timed_captions']=None
        else:
            n=v.get('narration')
            if not n or n['sha256']!=data.get('narration_sha256'):raise ValueError('Attach the matching narration before adding timed captions.')
            cues=captions.parse_subtitles(data['subtitles'],c['duration']) if 'subtitles' in data else captions.validate_cues(data.get('cues'),c['duration'])
            v['timed_captions']=captions.clean_track({'method':data.get('method','imported-subtitles'),'narration_sha256':n['sha256'],
                'script_hash':captions.script_fingerprint(v['scenes']),'provenance':data.get('provenance','User-supplied timed subtitles; timing and wording require review.'),'cues':cues},c['duration'])
        v['approval']=None;v['revision']+=1;c['revision']+=1;c['updated_at']=now();put(store,c)
    return with_audits(store,c)

def route(store,path,method,data,query):
    workspace=query.get('workspace',['default'])[0] if method=='GET' else data.get('workspace','default')
    store.require_workspace(workspace)
    if method=='GET':
        if path.endswith('/campaigns'):return {'campaigns':list_campaigns(store,workspace)}
        if path.endswith('/campaign'):return with_audits(store,get(store,query.get('id',[''])[0],workspace))
    else:
        if path.endswith('/create'):return create(store,data)
        if path.endswith('/save'):return save_variant(store,data)
        if path.endswith('/captions'):return save_captions(store,data)
        if path.endswith('/refresh'):return refresh_evidence(store,data)
        if path.endswith('/approve'):return approve(store,data)
        if path.endswith('/package'):return make_package(store,data)
        if path.endswith('/receipt'):return receipt(store,data)
    raise ValueError('Unknown Reel Factory action.')

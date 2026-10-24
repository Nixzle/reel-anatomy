"""Local creative research: audience intake, voice rules, blind review and retention.
Rules are disclosed heuristics. No social API, trained quality score or model call.
"""
from __future__ import annotations
import copy
import json
import math
import re
import unicodedata
from collections import Counter
from difflib import SequenceMatcher
from studio_store import Conflict, digest, now, text, uid, moment
from research_engine import safe_url, valid_id
TABLE='creative_lab'
KINDS=('profile','signal','review','retention')
SIGNALS=('question','objection','request','unclassified')
PROFILE_FIELDS={'audience':500,'voice':1500,'preferred':1000,'avoid':1000,'cta':300,'example':3000}
LIMITS=['Observations and editorial rules are not predicted views or causal effects.',
        'Imported comments are a selected sample, not a representative audience survey.',
        'Text similarity is not a plagiarism verdict or semantic originality test.']

def setup(store):
    with store.db() as c:
        c.execute('CREATE TABLE IF NOT EXISTS creative_lab(id TEXT PRIMARY KEY,workspace TEXT NOT NULL,kind TEXT NOT NULL,body TEXT NOT NULL)')
        c.execute('CREATE INDEX IF NOT EXISTS creative_workspace ON creative_lab(workspace,kind)')

def tokens(value):
    return re.findall(r"[^\W_]+(?:['’][^\W_]+)?",unicodedata.normalize('NFKC',value).casefold(),re.UNICODE)

def rows(store,workspace,kind):
    store.require_workspace(workspace)
    with store.db() as c:
        return [json.loads(r[0]) for r in c.execute('SELECT body FROM creative_lab WHERE workspace=? AND kind=? ORDER BY rowid DESC',(workspace,kind))]

def get(store,identity,workspace,kind=None):
    valid_id(identity);store.require_workspace(workspace)
    with store.db() as c:row=c.execute('SELECT body FROM creative_lab WHERE id=? AND workspace=?',(identity,workspace)).fetchone()
    if not row:raise ValueError('Creative record not found in this project.')
    value=json.loads(row[0])
    if kind and value['kind']!=kind:raise ValueError('Wrong creative record type.')
    return value

def put(store,value):
    with store.db() as c:
        c.execute('INSERT INTO creative_lab VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body',(value['id'],value['workspace'],value['kind'],json.dumps(value,ensure_ascii=False,allow_nan=False)))

def bounded_number(value,lo,hi,label):
    if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value) or not lo<=value<=hi:raise ValueError('Invalid '+label+'.')
    return float(value)

def profile(store,workspace):
    existing=rows(store,workspace,'profile')
    return existing[0] if existing else {'id':digest(['creative-profile',workspace])[:32],'workspace':workspace,'kind':'profile','revision':0,**{k:'' for k in PROFILE_FIELDS},'pace_wpm':180,'updated_at':None}

def clean_profile(data):
    return {**{k:text(data.get(k,''),n) for k,n in PROFILE_FIELDS.items()},'pace_wpm':bounded_number(data.get('pace_wpm',180),80,260,'review pace threshold')}

def save_profile(store,data):
    workspace=data.get('workspace','default');old=profile(store,workspace)
    if data.get('revision')!=old['revision']:raise Conflict('Voice profile changed. Reload before saving.')
    clean=clean_profile(data)
    if clean['example'] and data.get('example_owned') is not True:raise ValueError('Use only an example you own or have permission to adapt.')
    result={**old,**clean,'revision':old['revision']+1,'updated_at':now(),'example_owned':bool(clean['example'])}
    put(store,result);return result

def redact(value):
    value=re.sub(r'\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b','[email removed]',value,flags=re.I)
    value=re.sub(r'(?<!\w)@[\w.]+','[handle removed]',value)
    value=re.sub(r'(?<!\w)\+?\d[\d ()-]{7,}\d(?!\w)','[number removed]',value)
    return value

def clean_signal(item):
    kind=item.get('signal_kind','unclassified') or 'unclassified'
    if kind not in SIGNALS:raise ValueError('Choose question, objection, request or unclassified.')
    value=redact(text(item.get('text',''),2000,True))
    return {'text':value,'source_url':safe_url(item.get('source_url','')),'theme':text(item.get('theme',''),120),
            'signal_kind':kind,'provenance':text(item.get('provenance','User-supplied audience sample'),500,True),
            'observed_at':text(item.get('observed_at',''),100),
            'privacy':'Handles, email-like strings and long numbers filtered. Names/context may remain; review before sharing.'}

def import_signals(store,data):
    workspace=data.get('workspace','default');store.require_workspace(workspace)
    if data.get('permission_confirmed') is not True:raise ValueError('Confirm permission and remove identifying details before importing audience text.')
    incoming=data.get('signals')
    if not isinstance(incoming,list) or not 1<=len(incoming)<=500:raise ValueError('Import one to 500 audience rows.')
    prepared=[]
    for item in incoming:
        clean=clean_signal(item)
        clean.update(id=digest([workspace,'signal',tokens(clean['text']),clean['source_url']])[:32],workspace=workspace,kind='signal',revision=1,created_at=now())
        prepared.append(clean)
    existing={x['id'] for x in rows(store,workspace,'signal')};unique={x['id']:x for x in prepared};new=[v for k,v in unique.items() if k not in existing]
    if len(existing)+len(new)>5000:raise ValueError('Project limit: 5,000 audience observations.')
    # Validate the entire batch before one transaction. No author/account columns persist.
    with store.db() as c:
        for row in new:c.execute('INSERT INTO creative_lab VALUES (?,?,?,?)',(row['id'],workspace,'signal',json.dumps(row,ensure_ascii=False)))
    return {'created':len(new),'duplicates':len(incoming)-len(new),'raw_count':len(incoming),'privacy_note':'No author column is stored. Automatic redaction is partial; inspect text.'}

def signal_report(store,workspace):
    signals=rows(store,workspace,'signal');groups={}
    for s in signals:
        key=(s['theme'].strip().casefold() or 'unsorted',s['signal_kind'])
        group=groups.setdefault(key,{'theme':s['theme'] or 'Unsorted','signal_kind':s['signal_kind'],'items':[]})
        group['items'].append(s)
    result=[]
    for group in groups.values():
        items=group.pop('items');unique=len({tuple(tokens(s['text'])) for s in items});urls=len({s['source_url'] for s in items if s['source_url']})
        result.append({**group,'observations':len(items),'unique_texts':unique,'source_urls':urls,'examples':items[:5]})
    result.sort(key=lambda g:(-g['unique_texts'],g['theme']))
    return {'total':len(signals),'groups':result,'limits':['Counts are unique texts and source URLs, not unique people, independent sources or population demand.','Themes and types are supplied by the user, not machine-verified intent.']}

def signal_brief(store,data):
    workspace=data.get('workspace','default');ids=data.get('signal_ids',[])
    if not isinstance(ids,list) or not 1<=len(ids)<=8:raise ValueError('Select one to eight audience observations.')
    selected=[get(store,i,workspace,'signal') for i in dict.fromkeys(ids)];voice=profile(store,workspace)
    return {'topic':selected[0]['theme'] or selected[0]['text'][:200],'audience':voice['audience'],
            'goal':'Answer a documented audience question','tone':voice['voice'][:120],'cta':voice['cta'],
            'audience_need':'\n'.join(s['text'] for s in selected),'signal_ids':[s['id'] for s in selected],
            'limits':'Audience requests identify a question, not proof of the answer. Supply factual evidence before production.'}

def create_plan(store,data):
    workspace=data.get('workspace','default');voice=profile(store,workspace);values=dict(data)
    ids=values.pop('lab_signal_ids',[]) or []
    if not isinstance(ids,list) or len(ids)>8:raise ValueError('Too many audience observations for a brief.')
    selected=[get(store,i,workspace,'signal') for i in dict.fromkeys(ids)]
    for key,field in [('audience','audience'),('tone','voice'),('cta','cta')]:
        if not values.get(key):values[key]=voice[field][:120] if key=='tone' else voice[field]
    plan=store.create_plan(values)
    plan['creative_basis']={'profile_revision':voice['revision'],'profile':{k:voice[k] for k in PROFILE_FIELDS},'audience_observations':selected,
                            'meaning':'User-authored channel guidance and audience questions. Not a learned voice model or factual proof.'}
    with store.db() as c:c.execute('UPDATE documents SET body=? WHERE id=?',(json.dumps(plan,ensure_ascii=False),plan['id']))
    return plan

def plan_hash(plan):
    return digest([plan['id'],plan['revision'],plan['beats'],plan['brief']])

def profile_hash(p):return digest([p['revision'],clean_profile(p)])

def references(store,workspace):
    # Do not read snapshots, outcomes, view counts, or performance ranks.
    selected=[];seen=set();posts=store.posts(workspace)
    for p in sorted(posts,key=lambda p:p['id']):
        if p['collection']!='reference' or p['asset_id'] in seen:continue
        seen.add(p['asset_id']);a=store.asset(p['asset_id']);body=' '.join(s.get('text','') for s in a.get('segments',[]))[:30000]
        if body:selected.append({'post_id':p['id'],'asset_id':a['id'],'title':p['title'],'text':body,'text_hash':digest(body)})
        if len(selected)>=200:break
    return selected

def review_fingerprint(plan,p,refs):
    return digest([plan_hash(plan),profile_hash(p),[(r['asset_id'],r['text_hash']) for r in refs]])

def audit_plan(store,data):
    workspace=data.get('workspace','default');store.require_workspace(workspace);plan=store.get_document(data.get('plan_id'))
    if plan['workspace']!=workspace:raise ValueError('Choose a script from this project.')
    if data.get('plan_revision')!=plan['revision']:raise Conflict('Script changed. Review its saved current revision.')
    voice=profile(store,workspace);refs=references(store,workspace);beats=plan['beats'];issues=[]
    def add(code,message,index=None):issues.append({'code':code,'message':message,'beat_index':index})
    payoff=data.get('payoff_beat')
    if payoff is not None and (isinstance(payoff,bool) or not isinstance(payoff,int) or not 0<=payoff<len(beats)):raise ValueError('Choose a valid payoff beat.')
    if payoff is None:add('payoff_unmapped','Mark the beat that actually delivers the opening promise. Matching words cannot establish that it does.')
    elif beats[payoff]['start']>plan['brief']['duration']*.65:add('late_payoff','The payoff you marked begins after 65% of the planned runtime. Consider an earlier preview, then test it.',payoff)
    banned=[x.strip() for x in voice['avoid'].splitlines() if x.strip()]
    for i,b in enumerate(beats):
        words=tokens(b['spoken']);duration=b['end']-b['start'];wpm=len(words)*60/max(.1,duration)
        if wpm>voice['pace_wpm']:add('dense_speech',f'This beat plans {round(wpm)} words/minute, above your {round(voice["pace_wpm"])} review threshold. Rehearse, shorten or extend it.',i)
        if not b.get('visual','').strip():add('visual_unspecified','Specify what the viewer sees; spoken words alone are not a shot plan.',i)
        joined=' '.join(tokens(b['spoken']+' '+b.get('on_screen','')))
        for phrase in banned:
            needle=' '.join(tokens(phrase))
            if needle and (' '+needle+' ') in (' '+joined+' '):add('voice_phrase','Your avoid-list phrase appears here: '+phrase,i)
    if len(beats)>1 and beats[0]['role'].casefold()=='cta':add('cta_before_value','The first labelled beat is a CTA. Check that the viewer gets a reason to act first.',0)
    script=' '.join(b['spoken'] for b in beats);words=tokens(script);five=lambda w:{tuple(w[i:i+5]) for i in range(max(0,len(w)-4))}
    grams=five(words);overlaps=[]
    for ref in refs:
        other=tokens(ref['text']);matches=grams & five(other)
        if not matches:continue
        match=SequenceMatcher(None,words,other,autojunk=False).find_longest_match(0,len(words),0,len(other))
        if match.size>=8 and len(set(words[match.a:match.a+match.size]))>=5:
            overlaps.append({'post_id':ref['post_id'],'asset_id':ref['asset_id'],'title':ref['title'],'matching_words':match.size,
                'passage':' '.join(words[match.a:match.a+min(match.size,35)]),'script_fivegram_overlap':round(len(matches)/max(1,len(grams)),3)})
    overlaps.sort(key=lambda r:(-r['matching_words'],r['asset_id']))
    if overlaps:add('wording_overlap','Long repeated wording exists in the reference library. Inspect attribution and rewrite independently where appropriate. This is not a plagiarism verdict.')
    value={'id':uid(),'workspace':workspace,'kind':'review','revision':1,'created_at':now(),'plan_id':plan['id'],'plan_revision':plan['revision'],
           'profile_revision':voice['revision'],'fingerprint':review_fingerprint(plan,voice,refs),'promise':plan['brief']['promise'],'payoff_beat':payoff,
           'issues':issues,'overlaps':overlaps[:8],'references_checked':len(refs),'method':'metric-blind deterministic editorial checklist v1',
           'limits':['No views, outcomes or performance ranks enter this review.','Payoff mapping is your assertion; the tool does not understand whether a promise was delivered.','Reference scan covers up to 200 distinct reference assets and 30,000 characters each. Absence of a match does not certify originality.','Pacing thresholds and timing flags are editable rules, not validated retention predictors.']}
    put(store,value);return value

def reviews(store,workspace):
    refs=references(store,workspace);p=profile(store,workspace);result=[]
    for r in rows(store,workspace,'review')[:100]:
        try:
            doc=store.get_document(r['plan_id']);stale=doc['workspace']!=workspace or review_fingerprint(doc,p,refs)!=r['fingerprint']
        except ValueError:stale=True
        result.append(dict(r,stale=stale))
    return result

def clean_points(points,duration):
    if not isinstance(points,list) or not 2<=len(points)<=2000:raise ValueError('Supply 2–2,000 measured retention points.')
    result=[];last=-1
    for row in points:
        t=bounded_number(row.get('seconds'),0,duration,'retention timestamp');v=bounded_number(row.get('retention_percent'),0,500,'retention percentage')
        if t<=last:raise ValueError('Retention timestamps must strictly increase; duplicate timestamps are ambiguous.')
        result.append({'seconds':t,'retention_percent':v});last=t
    return result

def import_retention(store,data):
    workspace=data.get('workspace','default');store.require_workspace(workspace);post=store.get_post(data.get('post_id'))
    if post['workspace']!=workspace:raise ValueError('Retention belongs to a different project.')
    if data.get('permission_confirmed') is not True:raise ValueError('Confirm that you are authorised to use these actual analytics.')
    asset=store.asset(post['asset_id']);points=clean_points(data.get('points'),asset['duration'])
    definition=data.get('definition','audience_percent')
    if definition!='audience_percent':raise ValueError('This importer accepts audience-percentage points only, not counts or relative-retention indices.')
    n=data.get('sample_size')
    if n is not None and (isinstance(n,bool) or not isinstance(n,int) or not 1<=n<=10**12):raise ValueError('Sample size must be a positive integer or unknown.')
    observed=text(data.get('observed_at',''),100,True);moment(observed)
    source=text(data.get('source',''),1000,True);label=text(data.get('label','All supplied viewers'),200,True)
    value={'workspace':workspace,'kind':'retention','revision':1,'post_id':post['id'],'asset_id':asset['id'],'asset_revision':asset.get('revision',1),'duration':asset['duration'],
           'points':points,'sample_size':n,'definition':definition,'observed_at':observed,'source':source,'label':label,'created_at':now()}
    value['id']=digest([workspace,post['id'],definition,observed,source,label,points,n])[:32]
    try:return dict(get(store,value['id'],workspace,'retention'),duplicate=True)
    except ValueError:pass
    if len(rows(store,workspace,'retention'))>=500:raise ValueError('Archive limit: 500 retention series per project.')
    put(store,value);return value

def retention_detail(store,data):
    workspace=data.get('workspace','default');series=get(store,data.get('id'),workspace,'retention');post=store.get_post(series['post_id']);asset=store.asset(series['asset_id'])
    if post['workspace']!=workspace:raise ValueError('Post moved outside this project.')
    intervals=[]
    for a,b in zip(series['points'],series['points'][1:]):
        delta=b['retention_percent']-a['retention_percent'];segments=[{'start':s['start'],'end':s['end'],'text':s['text'],'role':s.get('role','')} for s in asset.get('segments',[]) if s['start']<b['seconds'] and s['end']>a['seconds']]
        intervals.append({'start':a['seconds'],'end':b['seconds'],'delta_points':round(delta,4),'points_per_second':round(delta/(b['seconds']-a['seconds']),4),'segments':segments[:6]})
    return {**series,'title':post['title'],'stale':asset.get('revision',1)!=series['asset_revision'] or asset['duration']!=series['duration'],
            'largest_drops':sorted([r for r in intervals if r['delta_points']<0],key=lambda r:r['delta_points'])[:5],
            'largest_rises':sorted([r for r in intervals if r['delta_points']>0],key=lambda r:-r['delta_points'])[:3],
            'limits':['Only imported observations are shown. Lines join points; unobserved seconds are not measurements.','Drops may reflect skipping or leaving. Rises may reflect replay, interest or confusion; the curve does not identify a cause.','Percentages can exceed 100 with repeat viewing. No automatic view or audience estimate is invented.','Different sample populations and platforms must not be pooled without a justified comparison.']}

def bundle(store):
    with store.db() as c:return [json.loads(r[0]) for r in c.execute('SELECT body FROM creative_lab')]

def import_bundle(store,values):
    values=[] if values is None else values
    if not isinstance(values,list) or len(values)>20000:raise ValueError('Invalid creative backup size.')
    ids=set();profiles=set()
    for row in values:
        if not isinstance(row,dict):raise ValueError('Invalid creative record.')
        valid_id(row.get('id'));store.require_workspace(row.get('workspace'))
        if row['id'] in ids:raise ValueError('Duplicate creative identity.')
        ids.add(row['id'])
        if row.get('kind') not in KINDS or isinstance(row.get('revision'),bool) or not isinstance(row.get('revision'),int) or row['revision']<1:raise ValueError('Invalid creative kind or revision.')
        if len(json.dumps(row,allow_nan=False))>800000:raise ValueError('Creative record too large.')
        kind=row['kind'];workspace=row['workspace']
        if kind=='profile':
            clean_profile(row)
            if workspace in profiles:raise ValueError('Duplicate voice profile.')
            profiles.add(workspace)
        elif kind=='signal':clean_signal(row)
        elif kind=='retention':
            post=store.get_post(row.get('post_id'))
            if post['workspace']!=workspace or post['asset_id']!=row.get('asset_id'):raise ValueError('Broken retention project link.')
            bounded_number(row.get('duration'),.001,3600,'duration');clean_points(row.get('points'),row['duration'])
            if row.get('definition')!='audience_percent':raise ValueError('Invalid retention definition.')
            text(row.get('source'),1000,True);text(row.get('label'),200,True);moment(row.get('observed_at'))
            n=row.get('sample_size')
            if n is not None and (isinstance(n,bool) or not isinstance(n,int) or not 1<=n<=10**12):raise ValueError('Invalid retention sample size.')
            if isinstance(row.get('asset_revision'),bool) or not isinstance(row.get('asset_revision'),int) or row['asset_revision']<1:raise ValueError('Invalid asset revision.')
        elif kind=='review':
            doc=store.get_document(row.get('plan_id'))
            if doc['workspace']!=workspace:raise ValueError('Broken creative review link.')
            if not isinstance(row.get('issues'),list) or not isinstance(row.get('overlaps'),list) or len(row['issues'])>1000 or len(row['overlaps'])>8:raise ValueError('Invalid saved review.')
            text(row.get('promise'),500);text(row.get('method'),200)
            if not re.fullmatch(r'[a-f0-9]{64}',str(row.get('fingerprint',''))):raise ValueError('Invalid review fingerprint.')
            for key in ('plan_revision','profile_revision','references_checked'):
                if isinstance(row.get(key),bool) or not isinstance(row.get(key),int) or row[key]<0:raise ValueError('Invalid review count.')
            if not isinstance(row.get('limits'),list) or any(not isinstance(v,str) for v in row['limits']):raise ValueError('Invalid review caveats.')
            for issue in row['issues']:
                text(issue.get('code'),100,True);text(issue.get('message'),4000,True)
                i=issue.get('beat_index')
                if i is not None and (isinstance(i,bool) or not isinstance(i,int) or not 0<=i<30):raise ValueError('Unsafe beat reference.')
            for match in row['overlaps']:
                valid_id(match.get('post_id'));valid_id(match.get('asset_id'));text(match.get('passage'),1000)
                text(match.get('title'),500);bounded_number(match.get('matching_words'),8,10000,'matched word count');bounded_number(match.get('script_fivegram_overlap'),0,1,'overlap fraction')
    with store.db() as c:
        c.execute('DELETE FROM creative_lab')
        for row in values:c.execute('INSERT INTO creative_lab VALUES (?,?,?,?)',(row['id'],row['workspace'],row['kind'],json.dumps(row,ensure_ascii=False)))
    return True

def route(store,path,method,data,query):
    workspace=query.get('workspace',['default'])[0] if method=='GET' else data.get('workspace','default');store.require_workspace(workspace)
    if method=='GET':
        if path.endswith('/profile'):return profile(store,workspace)
        if path.endswith('/signals'):return signal_report(store,workspace)
        if path.endswith('/reviews'):return {'reviews':reviews(store,workspace)}
        if path.endswith('/retention'):return {'series':[{k:v for k,v in r.items() if k!='points'} for r in rows(store,workspace,'retention')]}
        if path.endswith('/retention-detail'):return retention_detail(store,{'workspace':workspace,'id':query.get('id',[''])[0]})
    else:
        if path.endswith('/profile'):return save_profile(store,data)
        if path.endswith('/signals'):return import_signals(store,data)
        if path.endswith('/signal-brief'):return signal_brief(store,data)
        if path.endswith('/review'):return audit_plan(store,data)
        if path.endswith('/retention'):return import_retention(store,data)
        if path.endswith('/delete-signal'):
            old=get(store,data.get('id'),workspace,'signal')
            with store.db() as c:c.execute('DELETE FROM creative_lab WHERE id=?',(old['id'],))
            return {'deleted':True}
    raise ValueError('Unknown Creative Lab action.')

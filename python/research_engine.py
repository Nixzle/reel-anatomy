"""Project-scoped research evidence, citations and transcripts. No network or model calls."""
from __future__ import annotations
import hashlib
import json
import re
import sqlite3
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode
from studio_store import Conflict, text, uid, now, digest

TABLES = ('research_sources', 'research_claims', 'research_runs', 'research_messages')
LEVELS = ('metadata', 'excerpt', 'full_text', 'user_note', 'transcript')
KINDS = ('paper', 'web', 'social', 'note', 'video_transcript')
STANCES = ('supports', 'challenges', 'context')
MAX_SOURCES = 2000

def setup(store):
    with store.db() as c:
        for name in TABLES:
            c.execute('CREATE TABLE IF NOT EXISTS '+name+'(id TEXT PRIMARY KEY,workspace TEXT NOT NULL,body TEXT NOT NULL)')
            c.execute('CREATE INDEX IF NOT EXISTS '+name+'_workspace ON '+name+'(workspace)')
        try:
            c.execute('CREATE VIRTUAL TABLE IF NOT EXISTS research_index USING fts5(id UNINDEXED,workspace UNINDEXED,title,content)')
        except sqlite3.OperationalError:
            pass

def safe_url(value):
    value = text(value or '', 2000)
    if not value:
        return ''
    parsed = urlparse(value)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError('Source links must be credential-free HTTPS links.')
    query = [(k,v) for k,v in parse_qsl(parsed.query) if not k.lower().startswith('utm_') and k.lower() not in ('fbclid','gclid')]
    return urlunparse((parsed.scheme, parsed.netloc.lower(), parsed.path or '/', '', urlencode(query), ''))

def valid_id(identity):
    if not isinstance(identity, str) or not re.fullmatch(r'[a-f0-9]{32}',identity):
        raise ValueError('Invalid research identity.')
    return identity

def records(store,table,workspace):
    store.require_workspace(workspace)
    with store.db() as c:
        return [json.loads(r[0]) for r in c.execute('SELECT body FROM '+table+' WHERE workspace=? ORDER BY rowid DESC',(workspace,))]

def record(store,table,identity,workspace=None):
    valid_id(identity)
    with store.db() as c:
        row=c.execute('SELECT body FROM '+table+' WHERE id=?',(identity,)).fetchone()
    if not row:
        raise ValueError('Research record not found.')
    result=json.loads(row[0])
    if workspace is not None and result['workspace']!=workspace:
        raise ValueError('This evidence belongs to a different project.')
    return result

def put(store,table,value):
    with store.db() as c:
        c.execute('INSERT INTO '+table+' VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body',
                  (value['id'],value['workspace'],json.dumps(value,ensure_ascii=False,allow_nan=False)))

def compact(source):
    return {k:v for k,v in source.items() if k not in ('content','history')}

def clean_source(data):
    level=data.get('level','excerpt');kind=data.get('kind','web')
    if level not in LEVELS or kind not in KINDS:
        raise ValueError('Choose a supported source type and content coverage.')
    tags=data.get('tags',[])
    if isinstance(tags,str):
        tags=[x.strip() for x in tags.split(',') if x.strip()]
    if not isinstance(tags,list) or len(tags)>15:
        raise ValueError('Use up to 15 source tags.')
    content=text(data.get('content',''),100_000)
    reviewed=data.get('reviewed') is True
    if reviewed and not content:
        raise ValueError('A link alone cannot be marked as reviewed content.')
    result={
        'title':text(data.get('title',''),500,True), 'url':safe_url(data.get('url','')),
        'content':content, 'kind':kind, 'level':level,
        'author':text(data.get('author',''),500), 'published':text(data.get('published',''),100),
        'provenance':text(data.get('provenance','User supplied'),1000,True),
        'tags':[text(x,60,True) for x in tags], 'reviewed':reviewed,
        'note':text(data.get('note',''),4000), 'observed_at':text(data.get('observed_at') or now(),100),
    }
    if data.get('asset_id'):
        result['asset_id']=valid_id(data['asset_id'])
    result['content_hash']=digest([result['title'],content,level])
    return result

def reindex(store,source):
    with store.db() as c:
        try:
            c.execute('DELETE FROM research_index WHERE id=?',(source['id'],))
            c.execute('INSERT INTO research_index VALUES (?,?,?,?)',(source['id'],source['workspace'],source['title'],source['content']))
        except sqlite3.OperationalError:
            pass

def save_source(store,data):
    workspace=data.get('workspace','default');store.require_workspace(workspace)
    source=clean_source(data)
    with store.lock:
        old=None
        if data.get('id'):
            old=record(store,'research_sources',data['id'],workspace)
            if data.get('revision')!=old['revision']:
                raise Conflict('This source changed in another tab. Reload before saving.')
        else:
            identity=digest([workspace,source['kind'],source['url'] or source['title'],source['content_hash'] if not source['url'] else 'url'])[:32]
            try:old=record(store,'research_sources',identity,workspace)
            except ValueError:pass
            if old:
                return dict(compact(old),duplicate=True)
            with store.db() as c:
                n=c.execute('SELECT COUNT(*) FROM research_sources WHERE workspace=?',(workspace,)).fetchone()[0]
            if n>=MAX_SOURCES:
                raise ValueError('Project limit: 2,000 sources. Archive or use a separate project.')
        source.update(id=old['id'] if old else identity,workspace=workspace,
                      revision=old['revision']+1 if old else 1,created_at=old['created_at'] if old else now(),updated_at=now())
        source['citation']='S-'+source['id'][:10].upper()
        source['history']=((old.get('history',[])+[{'revision':old['revision'],'content_hash':old['content_hash'],'updated_at':old['updated_at']}])[-20:] if old else [])
        put(store,'research_sources',source);reindex(store,source)
    return compact(source)

def list_sources(store,workspace,query='',offset=0,limit=40):
    store.require_workspace(workspace)
    query=text(query,300);offset=max(0,int(offset));limit=max(1,min(100,int(limit)))
    with store.db() as c:
        count=c.execute('SELECT COUNT(*) FROM research_sources WHERE workspace=?',(workspace,)).fetchone()[0]
        terms=re.findall(r'\w+',query,flags=re.UNICODE)[:12]
        rows=None
        if terms:
            try:
                match=' OR '.join('"'+term+'"' for term in terms)
                rows=c.execute('SELECT s.body FROM research_index f JOIN research_sources s ON s.id=f.id WHERE research_index MATCH ? AND s.workspace=? ORDER BY bm25(research_index) LIMIT ? OFFSET ?',
                               (match,workspace,limit,offset)).fetchall()
            except sqlite3.OperationalError:
                rows=c.execute('SELECT body FROM research_sources WHERE workspace=? AND body LIKE ? ORDER BY rowid DESC LIMIT ? OFFSET ?',
                               (workspace,'%'+query+'%',limit,offset)).fetchall()
        if rows is None:
            rows=c.execute('SELECT body FROM research_sources WHERE workspace=? ORDER BY rowid DESC LIMIT ? OFFSET ?',(workspace,limit,offset)).fetchall()
        result=[compact(json.loads(r[0])) for r in rows]
    return {'sources':result,'total':count,'offset':offset,'has_more':len(result)==limit,'query':query}

def normalized(value):
    return ' '.join(value.split())

def save_claim(store,data):
    workspace=data.get('workspace','default');store.require_workspace(workspace)
    statement=text(data.get('statement',''),2000,True)
    links=data.get('links',[])
    if not isinstance(links,list) or len(links)>30:
        raise ValueError('Use up to 30 evidence links per claim.')
    clean=[]
    for link in links:
        source=record(store,'research_sources',link.get('source_id'),workspace)
        stance=link.get('stance','context')
        if stance not in STANCES:raise ValueError('Invalid evidence relationship.')
        quote=text(link.get('quote',''),2000,True)
        if normalized(quote) not in normalized(source['content']):
            raise ValueError('The selected quotation was not found in this saved source.')
        clean.append({'source_id':source['id'],'citation':source['citation'],'content_hash':source['content_hash'],
                      'stance':stance,'quote':quote,'coverage':source['level']})
    old=record(store,'research_claims',data['id'],workspace) if data.get('id') else None
    if old and data.get('revision')!=old['revision']:raise Conflict('Claim changed. Reopen it.')
    item={'id':old['id'] if old else uid(),'workspace':workspace,'statement':statement,'links':clean,
          'note':text(data.get('note',''),4000),'created_at':old['created_at'] if old else now(),
          'revision':old['revision']+1 if old else 1,'updated_at':now()}
    put(store,'research_claims',item)
    return claim_status(store,item)

def claim_status(store,item):
    stale=[];stances=set()
    for link in item['links']:
        try:
            source=record(store,'research_sources',link['source_id'],item['workspace'])
            if source['content_hash']!=link['content_hash']:stale.append(link['citation'])
            else:stances.add(link['stance'])
        except ValueError:stale.append(link['citation'])
    state='conflicting evidence' if {'supports','challenges'}<=stances else 'support recorded' if 'supports' in stances else 'challenge recorded' if 'challenges' in stances else 'unresolved'
    return dict(item,evidence_state=state,stale_citations=stale,verification='User-assessed relationships; quotation matching is not fact verification.')

def context(store,data):
    workspace=data.get('workspace','default');query=text(data.get('question',''),3000,True)
    selected=data.get('source_ids') or []
    if not isinstance(selected,list) or len(selected)>12:raise ValueError('Select at most 12 context sources.')
    ranked=list_sources(store,workspace,query[:300],limit=6)['sources'] if not selected else [compact(record(store,'research_sources',x,workspace)) for x in selected]
    fallback=not ranked and not selected
    if fallback:ranked=list_sources(store,workspace,limit=6)['sources']
    entries=[];remaining=12000
    for item in ranked:
        source=record(store,'research_sources',item['id'],workspace)
        body=source['content'];terms=set(re.findall(r'\w+',query.casefold()))
        paragraphs=[p.strip() for p in re.split(r'\n\s*\n|(?<=[.!?])\s+',body) if p.strip()]
        paragraphs.sort(key=lambda p:-len(terms & set(re.findall(r'\w+',p.casefold()))))
        start=max(0,body.find(paragraphs[0])) if paragraphs else 0
        excerpt=body[start:start+min(2400,remaining)]
        remaining-=len(excerpt)
        entries.append({**compact(source),'excerpt':excerpt,'excerpt_start':start,'truncated':len(body)>len(excerpt)})
        if remaining<=0:break
    claims=[claim_status(store,x) for x in records(store,'research_claims',workspace)][:20]
    warnings=[]
    if fallback and entries:warnings.append('No lexical match; recent project sources are supplied for orientation, not asserted relevance.')
    if not entries:warnings.append('No matching saved sources. Search or add evidence before requesting conclusions.')
    if any(x['level']=='metadata' for x in entries):warnings.append('Some sources contain metadata only, not the underlying study or article.')
    if any(not x['reviewed'] for x in entries):warnings.append('Some supplied content has not been marked reviewed by the user.')
    if any(x['stale_citations'] for x in claims):warnings.append('At least one claim cites an older source revision.')
    research=store.require_workspace(workspace)
    return {'question':query,'workspace':workspace,'research':research,'sources':entries,'claims':claims,
            'warnings':warnings,'context_hash':digest([(x['id'],x['content_hash']) for x in entries]),
            'scope':'Only this project and the selected saved excerpts. No private ChatGPT memory or connected accounts.'}

def save_message(store,data):
    workspace=data.get('workspace','default');store.require_workspace(workspace)
    question=text(data.get('question',''),3000,True);answer=text(data.get('answer',''),20000,True)
    mode=data.get('mode','evidence')
    if mode not in ('evidence','local_model','external_import'):raise ValueError('Invalid assistant mode.')
    citations=data.get('citations',[])
    if not isinstance(citations,list) or len(citations)>20:raise ValueError('Too many citations.')
    valid=[];invalid=[]
    for link in citations:
        try:
            source=record(store,'research_sources',link.get('source_id'),workspace)
            quote=text(link.get('quote',''),2000,True)
            if source['content_hash']!=link.get('content_hash') or normalized(quote) not in normalized(source['content']):raise ValueError('Citation mismatch')
            valid.append({'source_id':source['id'],'citation':source['citation'],'content_hash':source['content_hash'],'quote':quote,'title':source['title']})
        except (ValueError,TypeError,KeyError):invalid.append(str(link.get('source_id','unknown'))[:80])
    value={'id':uid(),'workspace':workspace,'question':question,'answer':answer,'mode':mode,
           'model':text(data.get('model',''),200),'citations':valid,'invalid_citations':invalid,
           'created_at':now(),'context_hash':text(data.get('context_hash',''),100),
           'assessment':'Citation text checked; reasoning and entailment still require review.' if valid and not invalid else 'Unverified draft: missing or invalid source support.'}
    put(store,'research_messages',value);return value

def source_from_library(store,workspace):
    result=[]
    for post in store.posts(workspace):
        a=store.asset(post['asset_id'])
        transcript='\n'.join('[%.2fs–%.2fs] %s'%(s['start'],s['end'],s['text']) for s in a.get('segments',[]))
        if not transcript:continue
        result.append(save_source(store,{'workspace':workspace,'title':post['title']+' / transcript',
            'url':post.get('source_url',''),'content':transcript,'kind':'video_transcript','level':'transcript',
            'author':post.get('creator',''),'published':post.get('published_at') or '',
            'asset_id':a['id'],'provenance':'Imported from the local media library; transcription may contain errors.',
            'tags':['transcript',post.get('platform','other')]}))
    return {'imported':len([x for x in result if not x.get('duplicate')]),'duplicates':len([x for x in result if x.get('duplicate')])}

def summary(store,workspace):
    sources=records(store,'research_sources',workspace)
    claims=[claim_status(store,x) for x in records(store,'research_claims',workspace)]
    domains={urlparse(s['url']).hostname for s in sources if s['url']}
    return {'sources':len(sources),'reviewed':sum(s['reviewed'] for s in sources),'metadata_only':sum(s['level']=='metadata' for s in sources),
            'domains':len(domains),'claims':len(claims),'conflicts':sum(c['evidence_state']=='conflicting evidence' for c in claims),
            'stale_claims':sum(bool(c['stale_citations']) for c in claims),'messages':len(records(store,'research_messages',workspace)),
            'limits':['Source count is not source independence.','Quoted text matching does not verify the claim.','No causal virality or returns are inferred.']}

def run_save(store,data):
    workspace=data.get('workspace','default');store.require_workspace(workspace)
    steps=data.get('steps',[])
    if not isinstance(steps,list) or not 1<=len(steps)<=12:raise ValueError('Plan one to twelve explicit search steps.')
    cleaned=[]
    for step in steps:
        if step.get('provider') not in ('crossref','wikipedia'):raise ValueError('Unsupported research provider.')
        status=step.get('status','pending')
        if status not in ('pending','complete','failed','cancelled'):raise ValueError('Invalid step status.')
        count=step.get('saved',0)
        if isinstance(count,bool) or not isinstance(count,int) or not 0<=count<=100:raise ValueError('Invalid saved count.')
        cleaned.append({'query':text(step.get('query',''),300,True),'provider':step['provider'],'status':status,'saved':count,'error':text(step.get('error',''),1000)})
    old=record(store,'research_runs',data['id'],workspace) if data.get('id') else None
    if old and data.get('revision')!=old['revision']:raise Conflict('Research run changed in another tab.')
    status=data.get('status','planned')
    if status not in ('planned','running','paused','complete','partial','cancelled'):raise ValueError('Invalid research-run state.')
    result={'id':old['id'] if old else uid(),'workspace':workspace,'title':text(data.get('title','Research run'),500,True),
            'steps':cleaned,'status':status,'revision':old['revision']+1 if old else 1,'created_at':old['created_at'] if old else now(),'updated_at':now(),
            'history':(old.get('history',[])+[{'status':old['status'],'steps':old['steps'],'at':old['updated_at']}])[-50:] if old else []}
    put(store,'research_runs',result);return result

def bundle(store):
    with store.db() as c:
        return {name:[json.loads(x[0]) for x in c.execute('SELECT body FROM '+name)] for name in TABLES}

def import_bundle(store,value):
    if value is None:value={}
    if not isinstance(value,dict):raise ValueError('Invalid evidence backup.')
    for table in TABLES:
        rows=value.get(table,[])
        if not isinstance(rows,list) or len(rows)>20000:raise ValueError('Invalid evidence table.')
        for row in rows:
            valid_id(row.get('id'));store.require_workspace(row.get('workspace'))
            if table=='research_sources':
                cleaned=clean_source(row)
                if cleaned['content_hash']!=row.get('content_hash'):raise ValueError('Source backup content hash does not match its text.')
                if isinstance(row.get('revision'),bool) or not isinstance(row.get('revision'),int) or row['revision']<1:raise ValueError('Invalid source revision.')
                if row.get('citation')!='S-'+row['id'][:10].upper():raise ValueError('Invalid source citation identity.')
            if table=='research_claims':
                text(row.get('statement',''),2000,True)
                if not isinstance(row.get('links'),list) or len(row['links'])>30:raise ValueError('Invalid claim evidence list.')
                links=row['links']
            elif table=='research_messages':
                text(row.get('question',''),3000,True);text(row.get('answer',''),20000,True);text(row.get('model',''),200)
                if row.get('mode') not in ('evidence','local_model','external_import'):raise ValueError('Invalid message mode.')
                if not isinstance(row.get('citations'),list) or len(row['citations'])>20:raise ValueError('Invalid message citation list.')
                if not isinstance(row.get('invalid_citations'),list):raise ValueError('Invalid citation warnings.')
                for warning in row['invalid_citations']:text(warning,80)
                links=row['citations']
            else:links=[]
            for link in links:
                valid_id(link.get('source_id'));text(link.get('quote',''),2000,True)
                if link.get('citation')!='S-'+link['source_id'][:10].upper():raise ValueError('Invalid citation label.')
                if not re.fullmatch(r'[a-f0-9]{64}',str(link.get('content_hash',''))):raise ValueError('Invalid citation revision.')
                if table=='research_claims' and link.get('stance') not in STANCES:raise ValueError('Invalid claim relationship.')
            if table=='research_runs':
                text(row.get('title',''),500,True)
                if not isinstance(row.get('steps'),list) or len(row['steps'])>12:raise ValueError('Invalid research steps.')
                for step in row['steps']:
                    text(step.get('query',''),300,True);text(step.get('error',''),1000)
                    if step.get('provider') not in ('crossref','wikipedia'):raise ValueError('Invalid saved search provider.')
            if len(json.dumps(row,allow_nan=False))>400000:raise ValueError('Oversized research record.')
    with store.db() as c:
        for table in TABLES:
            c.execute('DELETE FROM '+table)
            for row in value.get(table,[]):c.execute('INSERT INTO '+table+' VALUES (?,?,?)',(row['id'],row['workspace'],json.dumps(row,allow_nan=False)))
        try:c.execute('DELETE FROM research_index')
        except sqlite3.OperationalError:pass
    for source in value.get('research_sources',[]):reindex(store,source)
    for claim in value.get('research_claims',[]):
        text(claim.get('statement',''),2000,True)
        if not isinstance(claim.get('links'),list):raise ValueError('Invalid backed-up claim links.')
        for link in claim['links']:
            try:record(store,'research_sources',link.get('source_id'),claim['workspace'])
            except ValueError:pass  # Missing, previously deleted evidence stays visibly stale.
            if link.get('stance') not in STANCES:raise ValueError('Invalid backed-up evidence relationship.')
    return True

def route(store,path,method,data,query):
    workspace=query.get('workspace',['default'])[0] if method=='GET' else data.get('workspace','default')
    store.require_workspace(workspace)
    if method=='GET':
        if path.endswith('/summary'):return summary(store,workspace)
        if path.endswith('/sources'):return list_sources(store,workspace,query.get('q',[''])[0],query.get('offset',[0])[0],query.get('limit',[40])[0])
        if path.endswith('/source'):return record(store,'research_sources',query.get('id',[''])[0],workspace)
        if path.endswith('/claims'):return {'claims':[claim_status(store,x) for x in records(store,'research_claims',workspace)]}
        if path.endswith('/messages'):
            messages=records(store,'research_messages',workspace)[:100]
            for message in messages:
                message['stale_citations']=[]
                for link in message['citations']:
                    try:
                        source=record(store,'research_sources',link['source_id'],workspace)
                        if source['content_hash']!=link['content_hash']:message['stale_citations'].append(link['citation'])
                    except ValueError:message['stale_citations'].append(link['citation'])
            return {'messages':messages}
        if path.endswith('/runs'):return {'runs':records(store,'research_runs',workspace)[:50]}
        if path.endswith('/export'):return {'format':'reel-research-dossier','research':store.require_workspace(workspace),'sources':records(store,'research_sources',workspace),'claims':[claim_status(store,x) for x in records(store,'research_claims',workspace)],'messages':records(store,'research_messages',workspace),'runs':records(store,'research_runs',workspace),'exported_at':now()}
    else:
        if path.endswith('/source'):return save_source(store,data)
        if path.endswith('/sources-batch'):
            items=data.get('sources')
            if not isinstance(items,list) or len(items)>100:raise ValueError('Import up to 100 sources per batch.')
            result=[save_source(store,dict(item,workspace=workspace)) for item in items]
            return {'created':sum(not x.get('duplicate',False) for x in result),'duplicates':sum(bool(x.get('duplicate')) for x in result),'sources':result}
        if path.endswith('/claim'):return save_claim(store,data)
        if path.endswith('/context'):return context(store,data)
        if path.endswith('/message'):return save_message(store,data)
        if path.endswith('/library'):return source_from_library(store,workspace)
        if path.endswith('/run'):return run_save(store,data)
        if path.endswith('/delete-source'):
            source=record(store,'research_sources',data.get('id'),workspace)
            if source['revision']!=data.get('revision'):raise Conflict('Source changed. Reload it.')
            with store.db() as c:
                c.execute('DELETE FROM research_sources WHERE id=?',(source['id'],))
                try:c.execute('DELETE FROM research_index WHERE id=?',(source['id'],))
                except sqlite3.OperationalError:pass
            return {'deleted':True,'note':'Existing claims keep their citation identities and are marked stale.'}
    raise ValueError('Unknown research route.')

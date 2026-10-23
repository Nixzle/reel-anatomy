"""Checked additions for release readiness; uses existing store semantics."""
import re
import research_engine as research
from studio_store import text

def import_document(store,data):
    workspace=data.get('workspace','default');store.require_workspace(workspace)
    if not re.fullmatch(r'[a-f0-9]{64}',str(data.get('document_hash',''))):raise ValueError('Invalid document hash.')
    sources=data.get('sources')
    if not isinstance(sources,list) or not 1<=len(sources)<=200:raise ValueError('Import one to 200 document pages.')
    # Validate every page before making any modifications. Browser commit remains atomic.
    for source in sources:
        research.clean_source(source)
        if 'document-'+data['document_hash'][:32] not in source.get('tags',[]) or data['document_hash'] not in source.get('provenance',''):raise ValueError('Document identity does not match source provenance.')
        if source.get('reviewed') is not False or source.get('level')!='excerpt':raise ValueError('Imported text is an unreviewed excerpt, not established understanding.')
    existing=research.list_sources(store,workspace,limit=1)['total']
    if existing+len(sources)>research.MAX_SOURCES:raise ValueError('The project may exceed its source limit. Use a new research project.')
    results=[research.save_source(store,dict(s,workspace=workspace)) for s in sources]
    return {'created':sum(not x.get('duplicate') for x in results),'duplicates':sum(bool(x.get('duplicate')) for x in results),'sources':results}


def register_render(store,data,save_asset):
    import factory_engine as factory
    workspace=data.get('workspace','default');store.require_workspace(workspace)
    campaign=factory.get(store,data.get('campaign_id'),workspace)
    receipt=next((r for r in campaign['exports'] if r['id']==data.get('receipt_id')),None)
    if not receipt or receipt['file_sha256']!=data.get('sha256'):raise ValueError('Choose an existing render with matching file identity.')
    key=workspace+':'+receipt['file_sha256'];links=store.setting('render_draft_links',{})
    if key in links:
        try:post=store.get_post(links[key]['post_id']);return dict(links[key],duplicate=True)
        except ValueError:raise ValueError('The earlier draft link no longer resolves. Inspect it before retrying.')
    package=data.get('package');factory.verify_package(package)
    if package['campaign_id']!=campaign['id'] or package['workspace']!=workspace or package['audit']['content_hash']!=receipt['content_hash']:raise ValueError('The saved video does not match this production package.')
    identity=receipt['file_sha256'][:32]
    try:store.asset(identity)
    except (ValueError,FileNotFoundError):
        scenes=package['variant']['scenes']
        tags={'Hook','Problem','Context','Explanation','Demonstration','Proof','Payoff','Objection','CTA','Other'}
        save_asset({'id':identity,'title':campaign['title'][:90]+' / '+receipt['key']+' / our draft','duration':package['duration'],
            'segments':[dict(index=i,start=s['start'],end=s['end'],text=s['spoken'],role=s['role'] if s['role'] in tags else 'Other',reason='Authored caption timeline, not automatic transcription.',edited=False) for i,s in enumerate(scenes)],
            'shots':[dict(index=i,start=s['start'],end=s['end'],kind='Authored shot',note=s['visual'],confidence='authored') for i,s in enumerate(scenes)],
            'metrics':{},'transcript_source':'authored captions, not ASR','timing_method':'authored-factory-timeline-v1',
            'notices':['This is a locally generated draft, not a published post. Caption timing is planned, not measured speech alignment.','Editorial review and media rights must be checked before publishing.']})
    post=store.add_post(identity,workspace,{'title':campaign['title'][:90]+' / '+receipt['key']+' / our draft','collection':'draft','rights_confirmed':False,'cohort':campaign['brief'].get('topic','')[:200]})
    link={'asset_id':identity,'post_id':post['id'],'campaign_id':campaign['id'],'variant':receipt['key'],'file_sha256':receipt['file_sha256'],'plan_id':campaign['plan_id']}
    links[key]=link;store.set_setting('render_draft_links',links);return link

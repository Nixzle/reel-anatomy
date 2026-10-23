import {PROVIDERS,MODELS,searchPublic,queryPlan,evidenceReply,modelPrompt,LocalReasoner} from './research_services.mjs';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const S={workspace:null,sources:[],claims:[],messages:[],selected:new Set(),offset:0,current:null,run:null,abort:null,refresh:0,asking:false};
const reasoner=new LocalReasoner();
const ws=()=>window.StudioUI?.state?.workspace||'default';
const tell=s=>window.notice?.(s);
const request=(route,data,workspace=ws())=>window.PhoneLocal.api('/api/research/'+route+(data===undefined?(route.includes('?')?'&':'?')+'workspace='+encodeURIComponent(workspace):''),data===undefined?undefined:{method:'POST',body:JSON.stringify({...data,workspace})});
function bind(id,event,fn){$(id).addEventListener(event,async ev=>{try{await fn(ev);}catch(error){tell(error.message);console.error(error);const form=ev.target.closest?.('form');if(form){let p=form.querySelector('.research-error');if(!p){p=document.createElement('p');p.className='research-error';p.role='alert';form.append(p);}p.textContent=error.message;}}});}
function room(name){
  for(const id of ['sources','investigate','claims','ultron'])$('room-'+id).hidden=id!==name;
  document.querySelectorAll('[data-room]').forEach(b=>{b.classList.toggle('selected',b.dataset.room===name);b.setAttribute('aria-pressed',b.dataset.room===name?'true':'false');});
}
function selectedNote(){
  $('source-selection').textContent=S.selected.size?S.selected.size+' source(s) explicitly selected for Ultron.':'No explicit selection. Ultron will retrieve relevant saved excerpts.';
}
async function refresh(){
  const serial=++S.refresh,workspace=ws();
  if(S.workspace!==workspace){S.workspace=workspace;S.offset=0;S.selected.clear();S.current=null;selectedNote();}
  const [stats,sources,claims,messages,runs]=await Promise.all([
    request('summary',undefined,workspace),request('sources?limit=40&offset='+S.offset+'&q='+encodeURIComponent($('source-search').value),undefined,workspace),
    request('claims',undefined,workspace),request('messages',undefined,workspace),request('runs',undefined,workspace)
  ]);
  if(serial!==S.refresh||workspace!==ws())return;
  $('sanctum-stats').innerHTML=[['SOURCES',stats.sources],['REVIEWED',stats.reviewed],['METADATA ONLY',stats.metadata_only],['CONFLICTS',stats.conflicts],['STALE CLAIMS',stats.stale_claims]].map(([label,n])=>'<div><strong>'+n+'</strong><span>'+label+'</span></div>').join('');
  S.sources=sources.sources;S.claims=claims.claims;S.messages=messages.messages;
  renderSources();renderClaims();renderMessages();renderRuns(runs.runs);
  $('sources-prev').disabled=S.offset===0;$('sources-next').disabled=!sources.has_more;
  const choice=$('claim-source').value;
  $('claim-source').innerHTML='<option value="">Choose a saved source</option>'+S.sources.map(s=>'<option value="'+s.id+'">'+esc(s.citation+' · '+s.title)+'</option>').join('');
  if(S.sources.some(s=>s.id===choice))$('claim-source').value=choice;
}
function renderSources(){
  $('sources-list').innerHTML=S.sources.length?S.sources.map(s=>'<article class="source-card"><input type="checkbox" aria-label="Include '+esc(s.title)+' as assistant context" data-select-source="'+s.id+'" '+(S.selected.has(s.id)?'checked':'')+'><div><span class="source-citation">'+esc(s.citation)+'</span> <span class="pill">'+esc(s.level.replace('_',' '))+'</span><span class="pill">'+(s.reviewed?'USER REVIEWED':'NOT REVIEWED')+'</span><h3>'+esc(s.title)+'</h3><p>'+esc([s.author,s.published].filter(Boolean).join(' · '))+'</p><p>'+esc(s.provenance)+'</p>'+(s.url?'<p><a href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">Open original source ↗</a></p>':'')+'<div class="actions"><button class="outline-button" data-inspect-source="'+s.id+'">Inspect / annotate</button><button class="outline-button" data-cite-source="'+s.id+'">Build a claim</button></div></div></article>').join(''):'<div class="empty-state">No matching evidence saved. Add a source, import transcripts, or run a public search from Cerebro.</div>';
  $('sources-list').querySelectorAll('[data-select-source]').forEach(b=>b.onchange=()=>{if(b.checked&&S.selected.size>=12){b.checked=false;tell('Select at most 12 sources.');return;}b.checked?S.selected.add(b.dataset.selectSource):S.selected.delete(b.dataset.selectSource);selectedNote();});
  $('sources-list').querySelectorAll('[data-inspect-source]').forEach(b=>b.onclick=()=>openSource(b.dataset.inspectSource).catch(e=>tell(e.message)));
  $('sources-list').querySelectorAll('[data-cite-source]').forEach(b=>b.onclick=async()=>{await openSource(b.dataset.citeSource);useSourceInClaim();});
}
async function openSource(id=null){
  S.current=id?await request('source?id='+encodeURIComponent(id)):null;
  const s=S.current||{title:'',url:'',author:'',published:'',kind:'web',level:'excerpt',provenance:'User supplied source excerpt',content:'',note:'',tags:[],reviewed:false};
  $('source-dialog-heading').textContent=s.citation? s.citation+' / evidence':'Add source evidence';
  for(const key of ['title','url','author','published','kind','level','provenance','content','note'])$('source-'+key).value=s[key]||'';
  $('source-identity').value=s.id||'';$('source-tags').value=s.tags.join(', ');$('source-reviewed').checked=s.reviewed;
  $('source-delete').hidden=!s.id;$('source-claim').disabled=!s.id;
  $('source-form').querySelector('.research-error')?.remove();
  if(!$('source-dialog').open)$('source-dialog').showModal();
}
function useSourceInClaim(){
  if(!S.current)return;const source=S.current;
  $('source-dialog').close();room('claims');
  if(![...$('claim-source').options].some(o=>o.value===source.id))$('claim-source').add(new Option(source.citation+' · '+source.title,source.id));
  $('claim-source').value=source.id;$('claim-quote').value=source.content.slice(0,600);$('claim-statement').focus();
  tell('Edit the statement and select the exact relevant passage. A source label is not proof.');
}
function renderClaims(){
  $('claims-list').innerHTML=S.claims.length?S.claims.map(c=>'<article class="claim-card" data-conflict="'+(c.evidence_state==='conflicting evidence')+'"><span class="pill">'+esc(c.evidence_state)+'</span>'+(c.stale_citations.length?'<span class="pill">STALE SOURCE REVISION</span>':'')+'<h3>'+esc(c.statement)+'</h3>'+c.links.map(l=>'<div><button class="evidence-link" data-evidence-source="'+l.source_id+'">'+esc(l.citation+' / '+l.stance)+'</button><div class="evidence-quote">'+esc(l.quote)+'</div></div>').join('')+'<p class="small-note">'+esc(c.verification)+'</p><div class="actions"><button class="outline-button" data-add-evidence="'+c.id+'">Add supporting or opposing evidence</button><button class="outline-button" data-test-claim="'+c.id+'">Take to Studio as a hypothesis</button></div></article>').join(''):'<div class="empty-state">No claims yet. Link an exact saved passage to a claim, then deliberately look for evidence that challenges it.</div>';
  $('claims-list').querySelectorAll('[data-evidence-source]').forEach(b=>b.onclick=()=>openSource(b.dataset.evidenceSource).catch(e=>tell(e.message)));
  $('claims-list').querySelectorAll('[data-add-evidence]').forEach(b=>b.onclick=()=>{const c=S.claims.find(x=>x.id===b.dataset.addEvidence);$('claim-identity').value=c.id;$('claim-statement').value=c.statement;$('claim-quote').value='';$('claim-form').scrollIntoView({behavior:'smooth'});});
  $('claims-list').querySelectorAll('[data-test-claim]').forEach(b=>b.onclick=()=>{
    const c=S.claims.find(x=>x.id===b.dataset.testClaim),f=$('brief-form');
    f.elements.topic.value=c.statement.slice(0,250);f.elements.promise.value=('Investigate: '+c.statement).slice(0,500);
    f.elements.proof.value=('Hypothesis, not an established result. Review '+c.links.map(x=>x.citation).join(', ')+'. Evidence state: '+c.evidence_state+'.').slice(0,1500);
    f.elements.method.value='Demonstrate the proposed change using our own footage. Compare against a pre-recorded baseline and retain counterexamples.';
    const r=window.StudioUI.state.research?.find(x=>x.id===ws());f.elements.audience.value=r?.audience||'';f.elements.goal.value=r?.objective||'';
    window.StudioUI.show('create');tell('Evidence handed to Studio as a hypothesis. Verify the proof and complete the filming brief.');
  });
}
function renderMessages(){
  $('ultron-messages').innerHTML=S.messages.length?[...S.messages].reverse().map(m=>'<article class="ultron-message"><span class="pill">'+esc(m.mode==='evidence'?'EVIDENCE MAP':m.mode==='local_model'?'LOCAL MODEL PROPOSAL':'IMPORTED ANALYSIS')+'</span><span class="small-note">'+esc(m.model)+'</span><h3 class="question">'+esc(m.question)+'</h3><div class="ultron-answer">'+esc(m.answer)+'</div><div class="citation-links">'+m.citations.map(c=>'<button data-message-source="'+c.source_id+'">'+esc(c.citation)+'</button>').join('')+'</div><p class="receipt">'+esc(m.assessment)+(m.invalid_citations.length?' Invalid source references: '+m.invalid_citations.length+'.':'')+(m.stale_citations?.length?' Source content has since changed; review this answer.':'')+'<br>'+esc(new Date(m.created_at).toLocaleString())+'</p></article>').join(''):'<div class="empty-state">Ask about the selected evidence. I will show what I can actually reach, not invent a research trail.</div>';
  $('ultron-messages').querySelectorAll('[data-message-source]').forEach(b=>b.onclick=()=>openSource(b.dataset.messageSource).catch(e=>tell(e.message)));
}
function renderRuns(runs){
  $('research-runs').innerHTML=runs.length?runs.map(r=>'<article class="run-card"><span class="pill">'+esc(r.status==='running'&&S.run?.id!==r.id?'INTERRUPTED / NEEDS RESUME':r.status)+'</span><h3>'+esc(r.title)+'</h3><ol>'+r.steps.map(s=>'<li>'+esc(PROVIDERS[s.provider]+': '+s.query)+' · '+esc(s.status)+' · '+s.saved+' new source(s)'+(s.error?'<br>'+esc(s.error):'')+'</li>').join('')+'</ol>'+(r.steps.some(s=>s.status!=='complete')?'<button class="outline-button" data-resume-run="'+r.id+'">Resume unfinished steps</button>':'')+'</article>').join(''):'<p class="small-note">No public research runs yet.</p>';
  $('research-runs').querySelectorAll('[data-resume-run]').forEach(b=>b.onclick=async()=>{try{if(!$('discovery-consent').checked)throw Error('Approve sending the query list before resuming.');await runResearch(runs.find(r=>r.id===b.dataset.resumeRun));}catch(e){tell(e.message);}});
}
async function runResearch(saved=null){
  if(S.run)throw Error('One investigation is already running. Stop or finish it first.');
  const workspace=saved?.workspace||ws();
  if(!$('discovery-consent').checked)throw Error('Approve sending these queries before running research.');
  let run=saved;
  if(!run){
    const queries=$('investigation-queries').value.split('\n').map(x=>x.trim()).filter(Boolean);
    if(!queries.length||queries.length>6||queries.some(x=>x.length>300))throw Error('Use one to six queries, each up to 300 characters.');
    const providers=Object.keys(PROVIDERS).filter(k=>$('provider-'+k).checked);if(!providers.length)throw Error('Select a public discovery service.');
    run=await request('run',{title:$('investigation-question').value,steps:queries.flatMap(query=>providers.map(provider=>({query,provider,status:'pending',saved:0,error:''}))),status:'planned'},workspace);
  }
  S.run=run;S.abort=new AbortController();$('run-investigation').disabled=true;$('stop-investigation').disabled=false;
  try{
    run=await request('run',{...run,status:'running'},workspace);S.run=run;
    for(let i=0;i<run.steps.length;i++){
      const step=run.steps[i];if(step.status==='complete')continue;
      if(S.abort.signal.aborted)break;
      $('investigation-log').textContent='Reading '+PROVIDERS[step.provider]+' · step '+(i+1)+' of '+run.steps.length+' · '+step.query;
      try{
        const sources=await searchPublic(step.provider,step.query,S.abort.signal);
        if(S.abort.signal.aborted)break;
        const result=await request('sources-batch',{sources},workspace);
        step.saved=result.created;step.status='complete';step.error='';
      }catch(error){step.status=S.abort.signal.aborted?'cancelled':'failed';step.error=error.message;}
      run=await request('run',{...run,status:S.abort.signal.aborted?'paused':'running'},workspace);S.run=run;
      if(workspace===ws())await refresh();
    }
    run=await request('run',{...run,status:S.abort.signal.aborted?'paused':run.steps.every(s=>s.status==='complete')?'complete':'partial'},workspace);
    $('investigation-log').textContent='Research '+run.status+'. '+run.steps.filter(s=>s.status==='complete').length+' of '+run.steps.length+' steps completed. Inspect sources before concluding.';
  }finally{S.run=null;S.abort=null;$('run-investigation').disabled=false;$('stop-investigation').disabled=true;await refresh();}
}
async function getContext(){return request('context',{question:$('ultron-question').value,source_ids:[...S.selected]});}
async function dossierMarkdown(){
  const d=await request('export');
  const lines=['# '+d.research.title+' / evidence dossier','',d.research.topic||'', 'Exported: '+d.exported_at,'','## Claims and counterevidence',''];
  for(const c of d.claims){lines.push('### '+c.statement,'',c.evidence_state+(c.stale_citations.length?' / stale evidence':''),'');for(const l of c.links)lines.push('['+l.citation+'] '+l.stance+': '+l.quote,'');}
  lines.push('## Source register','');for(const s of d.sources)lines.push('['+s.citation+'] '+s.title,s.url||'User-supplied material','Coverage: '+s.level+'; '+(s.reviewed?'user reviewed':'not reviewed')+'.',s.provenance,'');
  lines.push('## Limits','','A matching quotation is not fact verification. Model outputs are proposals. No causal performance claim follows from a pattern alone.','');
  return lines.join('\n');
}
async function importFiles(files){
  let imported=0,duplicates=0;const errors=[];const workspace=ws();
  for(const file of files){
    if(file.size>2_000_000){errors.push(file.name+': exceeds 2 MB');continue;}
    const raw=await file.text();let sources=[];
    if(/\.csv$/i.test(file.name)){
      const rows=window.parseCsvRows(raw);const heads=(rows.shift()||[]).map(x=>x.trim().toLowerCase());
      if(!heads.includes('title')){errors.push(file.name+': missing title column');continue;}
      if(rows.length>500){errors.push(file.name+': maximum 500 rows');continue;}
      sources=rows.map(row=>{const v=Object.fromEntries(heads.map((h,i)=>[h,row[i]||'']));return {title:v.title,url:v.url,content:v.content||v.caption||'',author:v.author||v.creator,published:v.published,kind:v.kind||'social',level:v.level||((v.content||v.caption)?'excerpt':'metadata'),provenance:v.provenance||'User-imported CSV: '+file.name,tags:['csv']};});
    }else sources=[{title:file.name,content:raw,kind:'note',level:'user_note',provenance:'User-imported local file: '+file.name,tags:['local-file']}];
    for(let i=0;i<sources.length;i++){
      try{const result=await request('source',sources[i],workspace);result.duplicate?duplicates++:imported++;}
      catch(e){errors.push(file.name+' row '+(i+1)+': '+e.message);}
    }
  }
  await refresh();tell(imported+' sources imported; '+duplicates+' duplicates; '+errors.length+' rejected.');
  if(errors.length)$('sources-list').insertAdjacentHTML('afterbegin','<div class="research-error">'+errors.slice(0,10).map(esc).join('<br>')+'</div>');
}
async function init(){
  document.querySelectorAll('[data-room]').forEach(b=>b.onclick=()=>room(b.dataset.room));
  document.querySelector('[data-studio-tab="sanctum"]').addEventListener('click',()=>refresh().catch(e=>tell(e.message)));
  $('research-select').addEventListener('change',()=>setTimeout(()=>refresh().catch(e=>tell(e.message)),80));
  bind('source-new','click',()=>openSource());bind('source-close','click',()=>$('source-dialog').close());
  bind('source-refresh','click',()=>{S.offset=0;return refresh();});
  bind('source-search','keydown',e=>{if(e.key==='Enter'){e.preventDefault();S.offset=0;return refresh();}});
  bind('sources-prev','click',()=>{S.offset=Math.max(0,S.offset-40);return refresh();});bind('sources-next','click',()=>{S.offset+=40;return refresh();});
  bind('source-form','submit',async ev=>{
    ev.preventDefault();const data={};for(const key of ['title','url','author','published','kind','level','provenance','content','note','tags'])data[key]=$('source-'+key).value;
    data.reviewed=$('source-reviewed').checked;if(S.current){data.id=S.current.id;data.revision=S.current.revision;}
    await request('source',data);$('source-dialog').close();await refresh();tell('Source saved with provenance and revision identity.');
  });
  bind('source-delete','click',async()=>{if(!S.current||!confirm('Remove this source? Existing claims will retain stale references rather than silently losing their trail.'))return;await request('delete-source',{id:S.current.id,revision:S.current.revision});S.selected.delete(S.current.id);$('source-dialog').close();await refresh();});
  bind('source-claim','click',useSourceInClaim);
  bind('source-files','change',async ev=>{const files=[...ev.target.files];ev.target.value='';await importFiles(files);});
  bind('source-transcripts','click',async()=>{const r=await request('library',{});await refresh();tell(r.imported+' transcripts imported; '+r.duplicates+' duplicates.');});
  bind('dossier-json','click',async()=>window.PhoneLocal.exportFile('research-dossier.json',await request('export')));
  bind('dossier-md','click',async()=>window.PhoneLocal.exportFile('research-dossier.md',await dossierMarkdown(),'text/markdown'));
  bind('claim-clear','click',()=>{$('claim-form').reset();$('claim-identity').value='';});
  bind('claim-form','submit',async ev=>{
    ev.preventDefault();const old=S.claims.find(x=>x.id===$('claim-identity').value);
    await request('claim',{...(old||{}),statement:$('claim-statement').value,links:[...(old?.links||[]),{source_id:$('claim-source').value,stance:$('claim-stance').value,quote:$('claim-quote').value}]});
    $('claim-form').reset();$('claim-identity').value='';await refresh();tell('Evidence link recorded. Text matching is not a truth certificate.');
  });
  bind('make-research-plan','click',()=>{const plan=queryPlan($('investigation-question').value,['crossref']);$('investigation-queries').value=plan.map(x=>x.query).join('\n');});
  bind('investigation-question','input',()=>$('external-social-search').href='https://www.youtube.com/results?search_query='+encodeURIComponent($('investigation-question').value));
  bind('investigation-form','submit',async ev=>{ev.preventDefault();await runResearch();});bind('stop-investigation','click',()=>S.abort?.abort());
  bind('preview-context','click',async()=>{const c=await getContext();$('context-preview').textContent=JSON.stringify({retrieval:c,model_input_if_enabled:modelPrompt(c,[...S.messages].reverse())},null,2);$('context-dialog').showModal();});bind('context-close','click',()=>$('context-dialog').close());
  bind('ultron-form','submit',async ev=>{
    ev.preventDefault();if(S.asking)throw Error('One response is already in progress.');S.asking=true;$('ask-ultron').disabled=true;$('stop-ultron').disabled=false;
    const workspace=ws();
    try{
      const c=await getContext();const mode=$('ultron-mode').value;
      const response=mode==='local_model'?await reasoner.answer(c,[...S.messages].reverse()):evidenceReply(c);
      await request('message',{...response,question:c.question,context_hash:c.context_hash},workspace);
      await refresh();$('ultron-messages').lastElementChild?.scrollIntoView({behavior:'smooth',block:'start'});
    }finally{S.asking=false;$('ask-ultron').disabled=false;$('stop-ultron').disabled=true;}
  });bind('stop-ultron','click',()=>reasoner.interrupt());
  $('local-model-select').innerHTML=MODELS.map(m=>'<option value="'+m.id+'">'+esc(m.label)+'</option>').join('');
  const modelInfo=()=>$('local-model-memory').textContent=MODELS.find(x=>x.id===$('local-model-select').value).memory;
  modelInfo();bind('local-model-select','change',modelInfo);
  bind('open-local-model','click',()=>$('local-model-dialog').showModal());bind('local-model-close','click',()=>$('local-model-dialog').close());
  bind('local-model-load','click',async()=>{
    if(!$('local-model-consent').checked)throw Error('Explicitly approve the model download first.');
    $('local-model-load').disabled=true;$('local-model-status').textContent='Checking this browser and loading the chosen local model…';
    try{const model=await reasoner.load($('local-model-select').value,text=>$('local-model-status').textContent=text);
      $('local-model-status').textContent='Loaded: '+model+'. Responses run on this device.';$('sanctum-engine').textContent='LOCAL MODEL · '+model;
      $('assistant-capability').textContent='Local model enabled. It receives only inspected project excerpts; its reasoning still needs review.';$('ultron-mode').value='local_model';
    }catch(e){$('local-model-status').textContent=e.message;throw e;}finally{$('local-model-load').disabled=false;}
  });
  bind('local-model-unload','click',async()=>{await reasoner.unload();$('local-model-status').textContent='Unloaded from active memory. Cached model downloads remain on this device.';$('sanctum-engine').textContent='EVIDENCE MODE · NO MODEL LOADED';$('ultron-mode').value='evidence';$('assistant-capability').textContent='Evidence mode retrieves saved excerpts. It does not pretend to be generative AI.';});
  await refresh();
  window.Sanctum={refresh,state:S,room,context:getContext,reasoner,searchPublic,request};
}
export const ready=init().catch(e=>{tell('Sanctum: '+e.message);throw e;});

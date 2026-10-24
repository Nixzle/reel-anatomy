/* Creative Lab uses saved project data only; no background network or inference. */
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const S={workspace:null,profile:null,profileDirty:false,plans:[],posts:[],groups:[],reviews:[],series:[],pending:[],pendingWorkspace:null,serial:0};
const ws=()=>window.StudioUI.state.workspace||'default';
const notify=s=>window.notice(s);
const api=(name,data,workspace=ws())=>window.PhoneLocal.api('/api/lab/'+name+(data===undefined?(name.includes('?')?'&':'?')+'workspace='+encodeURIComponent(workspace):''),data===undefined?undefined:{method:'POST',body:JSON.stringify({...data,workspace})});
function on(id,event,fn){$(id).addEventListener(event,async e=>{try{await fn(e);}catch(error){notify(error.message);const form=e.target.closest('form');if(form){let out=form.querySelector('.lab-form-error');if(!out){out=document.createElement('p');out.className='lab-form-error';out.role='alert';form.append(out);}out.textContent=error.message;}}});}
function tab(name){for(const n of ['voice','audience','review','retention'])$(n==='audience'?'lab-audience-panel':'lab-'+n).hidden=n!==name;document.querySelectorAll('[data-lab-tab]').forEach(b=>{b.classList.toggle('selected',b.dataset.labTab===name);b.setAttribute('aria-pressed',b.dataset.labTab===name?'true':'false');});}
const profileIds={audience:'lab-audience',voice:'lab-voice-rules',preferred:'lab-preferred',avoid:'lab-avoid',cta:'lab-cta',example:'lab-example',pace_wpm:'lab-pace'};
function displayProfile(){for(const [key,id] of Object.entries(profileIds))$(id).value=S.profile[key];$('lab-example-owned').checked=S.profile.example_owned===true;$('lab-profile-version').textContent='Saved profile revision '+S.profile.revision;S.profileDirty=false;}
async function refresh(){
 const serial=++S.serial,workspace=ws(),changed=S.workspace!==workspace;
 const [p,signals,reviews,retention,plans,posts]=await Promise.all([api('profile',undefined,workspace),api('signals',undefined,workspace),api('reviews',undefined,workspace),api('retention',undefined,workspace),window.PhoneLocal.api('/api/studio/plans?workspace='+workspace),window.PhoneLocal.api('/api/studio/library?workspace='+workspace)]);
 if(serial!==S.serial||workspace!==ws())return;
 S.workspace=workspace;S.profile=p;S.plans=plans.plans;S.posts=posts.posts;S.groups=signals.groups;S.reviews=reviews.reviews;S.series=retention.series;
 if(changed){S.pending=[];S.pendingWorkspace=null;updateBriefNote();S.profileDirty=false;}
 if(!S.profileDirty)displayProfile();
 renderSignals(signals);renderReviews();
 const previous=$('lab-plan').value;$('lab-plan').innerHTML='<option value="">Choose a saved brief</option>'+S.plans.map(p=>'<option value="'+p.id+'">'+esc(p.brief.topic)+' · v'+p.revision+'</option>').join('');if(S.plans.some(p=>p.id===previous))$('lab-plan').value=previous;payoffOptions();
 const post=$('lab-retention-post').value;$('lab-retention-post').innerHTML='<option value="">Choose a video</option>'+S.posts.map(p=>'<option value="'+p.id+'">'+esc(p.title)+' · '+esc(p.platform)+'</option>').join('');if(S.posts.some(p=>p.id===post))$('lab-retention-post').value=post;
 const series=$('lab-retention-series').value;$('lab-retention-series').innerHTML='<option value="">Choose an observation</option>'+S.series.map(r=>'<option value="'+r.id+'">'+esc(S.posts.find(p=>p.id===r.post_id)?.title||'Video')+' · '+esc(r.observed_at)+' · '+esc(r.label)+'</option>').join('');if(S.series.some(r=>r.id===series))$('lab-retention-series').value=series;
}
function payoffOptions(){const p=S.plans.find(p=>p.id===$('lab-plan').value),old=$('lab-payoff').value;$('lab-payoff').innerHTML='<option value="">Not mapped yet</option>'+(p?p.beats.map((b,i)=>'<option value="'+i+'">'+(i+1)+': '+esc(b.role)+' · '+b.start+'s</option>').join(''):'');if(p&&Number(old)<p.beats.length)$('lab-payoff').value=old;}
function updateBriefNote(){const note=$('lab-brief-note');if(!note)return;note.textContent=S.pending.length?'Audience basis: '+S.pending.length+' supplied observation(s). Questions identify a need, not factual proof.':'';note.hidden=!S.pending.length;}
function fillBrief(values){window.StudioUI.show('create');const form=$('brief-form');for(const [key,value] of Object.entries(values))if(form.elements[key]&&value&&!form.elements[key].value)form.elements[key].value=value;form.scrollIntoView({behavior:'smooth'});}
function renderSignals(report){
 $('lab-signal-groups').innerHTML='<p class="small-note">'+report.total+' saved observations. Counts are texts and URLs, not unique viewers or representative demand.</p>'+report.groups.map((g,i)=>'<article class="lab-item"><span class="kicker">'+esc(g.signal_kind)+'</span><h3>'+esc(g.theme)+'</h3><p class="lab-counts">'+g.unique_texts+' distinct texts · '+g.observations+' observations · '+g.source_urls+' source URLs</p>'+g.examples.map(s=>'<blockquote>'+esc(s.text)+'</blockquote><p class="small-note">'+esc(s.provenance)+(s.source_url?' · <a href="'+esc(s.source_url)+'" target="_blank" rel="noopener noreferrer">Source ↗</a>':'')+'</p><button class="outline-button" data-delete-signal="'+s.id+'">Remove this observation</button>').join('')+'<div class="actions"><button class="primary-button" data-signal-brief="'+i+'">Use these questions in a brief</button></div></article>').join('');
 document.querySelectorAll('[data-signal-brief]').forEach(b=>b.onclick=async()=>{try{
  if(window.StudioUI.state.planDirty&&!confirm('A script has unsaved edits. Continue to its brief form without discarding that script?'))return;
  const g=S.groups[Number(b.dataset.signalBrief)],data=await api('signal-brief',{signal_ids:g.examples.map(s=>s.id)});
  S.pending=data.signal_ids;S.pendingWorkspace=ws();fillBrief(data);updateBriefNote();notify('Questions attached to the next brief. Supply the answer and genuine proof yourself.');
 }catch(e){notify(e.message);}});
 document.querySelectorAll('[data-delete-signal]').forEach(b=>b.onclick=async()=>{try{if(!confirm('Remove this audience observation? Existing brief snapshots remain historical.'))return;await api('delete-signal',{id:b.dataset.deleteSignal});await refresh();}catch(e){notify(e.message);}});
}
async function openPlan(id,index){
 await window.StudioUI.refresh();window.StudioUI.show('create');$('plan-select').value=id;$('load-plan').click();
 const field=document.querySelector('[data-beat="'+index+'"][data-field="spoken"]');field?.scrollIntoView({behavior:'smooth',block:'center'});field?.focus();
}
function renderReviews(){
 $('lab-reviews').innerHTML=S.reviews.map(r=>'<article class="lab-item">'+(r.stale?'<p class="lab-stale">Outdated review: the saved script, playbook or reference text changed. Run it again.</p>':'')+'<span class="kicker">SAVED SCRIPT V'+r.plan_revision+' / PROFILE V'+r.profile_revision+'</span><h3>'+esc(S.plans.find(p=>p.id===r.plan_id)?.brief.topic||'Saved script')+'</h3><p>Opening promise: '+esc(r.promise)+'</p><p class="small-note">'+esc(r.method)+' · '+r.references_checked+' distinct reference transcripts checked. No reach prediction.</p>'+(r.issues.length?r.issues.map(x=>'<div class="lab-issue"><strong>'+esc(x.code.replaceAll('_',' '))+'</strong>'+esc(x.message)+(x.beat_index!==null?'<p><button class="outline-button" data-review-plan="'+r.plan_id+'" data-review-beat="'+x.beat_index+'">Inspect beat '+(x.beat_index+1)+'</button></p>':'')+'</div>').join(''):'<p>No rule flags fired. This is not approval, semantic verification or an originality certificate.</p>')+r.overlaps.map(x=>'<details><summary>Repeated wording: '+esc(x.title)+' · '+x.matching_words+' words</summary><div class="lab-reference-match">'+esc(x.passage)+'</div><button class="outline-button" data-reference-asset="'+x.asset_id+'">Inspect reference video</button></details>').join('')+'</article>').join('')||'<p class="small-note">No saved creative reviews in this project.</p>';
 document.querySelectorAll('[data-review-plan]').forEach(b=>b.onclick=()=>openPlan(b.dataset.reviewPlan,Number(b.dataset.reviewBeat)).catch(e=>notify(e.message)));
 document.querySelectorAll('[data-reference-asset]').forEach(b=>b.onclick=()=>window.openProject(b.dataset.referenceAsset));
}
export function retentionPoints(raw){
 const rows=window.parseCsvRows(raw),header=(rows.shift()||[]).map(x=>x.trim().toLowerCase());
 const t=header.indexOf('seconds'),p=header.indexOf('retention_percent');if(t<0||p<0)throw Error('CSV needs seconds and retention_percent columns.');
 return rows.filter(r=>r.some(x=>x.trim())).map((row,i)=>{
  if(!String(row[t]??'').trim()||!String(row[p]??'').trim())throw Error('Missing retention value on row '+(i+2)+'. Unknown values are not zero.');
  const seconds=Number(row[t]),retention_percent=Number(row[p]);if(!Number.isFinite(seconds)||!Number.isFinite(retention_percent))throw Error('Invalid number on row '+(i+2)+'.');return {seconds,retention_percent};
 });
}
function chart(series){
 const width=640,height=240,pad=55,max=Math.max(100,...series.points.map(p=>p.retention_percent));
 const x=s=>pad+(width-pad*2)*s/Math.max(.1,series.duration),y=v=>height-pad-(height-pad*2)*v/max;
 const coords=series.points.map(p=>x(p.seconds).toFixed(2)+','+y(p.retention_percent).toFixed(2)).join(' ');
 return '<svg class="lab-retention-svg" viewBox="0 0 640 240" role="img" aria-label="Imported audience retention observations; connected line is not a measurement at intervening seconds"><path d="M55 15 V185 H620" fill="none" stroke="currentColor"/><polyline points="'+coords+'" fill="none" stroke="currentColor" stroke-width="2"/>'+series.points.map(p=>'<circle cx="'+x(p.seconds)+'" cy="'+y(p.retention_percent)+'" r="3" fill="currentColor"><title>'+p.seconds+' seconds: '+p.retention_percent+'%</title></circle>').join('')+'<text x="4" y="25" font-size="22">'+max+'%</text><text x="3" y="190" font-size="22">0%</text><text x="55" y="229" font-size="22">0s</text><text x="570" y="229" font-size="22">'+series.duration+'s</text></svg>';
}
async function showRetention(){
 const id=$('lab-retention-series').value;if(!id){$('lab-retention-result').textContent='';return;}
 const workspace=ws(),r=await api('retention-detail?id='+id);if(workspace!==ws()||$('lab-retention-series').value!==id)return;
 $('lab-retention-result').innerHTML='<article class="lab-item"><h3>'+esc(r.title)+'</h3>'+(r.stale?'<p class="lab-stale">Transcript or video metadata changed after this import. Recheck timestamp alignment.</p>':'')+'<p>'+esc(r.source)+' · '+esc(r.label)+'</p><p class="small-note">Sample: '+(r.sample_size===null?'unknown':r.sample_size)+' · '+esc(r.observed_at)+'. This is imported analytics, not a forecast.</p>'+chart(r)+'<h4>Largest observed drops between supplied points</h4>'+r.largest_drops.map(d=>'<div class="lab-issue"><strong>'+d.start+'–'+d.end+'s: '+d.delta_points+' percentage points</strong><p>'+d.points_per_second+' points per second across this interval. Cause unknown.</p>'+d.segments.map(s=>'<blockquote>'+esc(s.text)+'</blockquote>').join('')+'<button class="outline-button" data-retention-asset="'+r.asset_id+'" data-retention-time="'+d.start+'">Inspect this moment</button></div>').join('')+'<details><summary>All measured points ('+r.points.length+')</summary><table class="lab-retention-table"><thead><tr><th>Seconds</th><th>Audience %</th></tr></thead><tbody>'+r.points.map(p=>'<tr><td>'+p.seconds+'</td><td>'+p.retention_percent+'</td></tr>').join('')+'</tbody></table></details><p class="small-note">'+r.limits.map(esc).join(' ')+'</p></article>';
 document.querySelectorAll('[data-retention-asset]').forEach(b=>b.onclick=async()=>{await window.openProject(b.dataset.retentionAsset);window.StudioUI.show('breakdown');window.seek(Number(b.dataset.retentionTime));});
 window.CreativeLab.currentRetention=r;
}
async function init(){
 document.querySelectorAll('[data-lab-tab]').forEach(b=>b.onclick=()=>tab(b.dataset.labTab));tab('voice');
 document.querySelector('[data-room="lab"]').addEventListener('click',()=>refresh().then(()=>$('room-lab').scrollIntoView({behavior:'smooth'})).catch(e=>notify(e.message)));
 $('studio-home').querySelector('.studio-heading').insertAdjacentHTML('beforeend','<div class="actions"><button id="open-creative-lab" class="outline-button">Audience, voice &amp; retention</button></div>');
 on('open-creative-lab','click',async()=>{window.StudioUI.show('sanctum');window.Sanctum.room('lab');await refresh();$('room-lab').scrollIntoView({behavior:'smooth'});});
 $('research-select').addEventListener('change',e=>{if(S.profileDirty&&!confirm('Discard unsaved channel-playbook changes?')){e.stopImmediatePropagation();e.target.value=S.workspace;}},true);
 $('research-select').addEventListener('change',()=>setTimeout(()=>refresh().catch(e=>notify(e.message)),80));
 $('brief-form').insertAdjacentHTML('afterbegin','<div id="lab-brief-note" class="limits-box" hidden></div>');
 for(const id of Object.values(profileIds))$(id).addEventListener('input',()=>{S.profileDirty=true;$('lab-profile-version').textContent='Unsaved playbook changes';});
 on('lab-profile-form','submit',async e=>{e.preventDefault();if(ws()!==S.workspace)throw Error('Project changed. Reload this screen.');const values=Object.fromEntries(Object.entries(profileIds).map(([k,id])=>[k,$(id).value]));values.pace_wpm=Number(values.pace_wpm);S.profile=await api('profile',{...values,example_owned:$('lab-example-owned').checked,revision:S.profile.revision});displayProfile();notify('Channel guidance saved. It is not a trained voice model.');});
 on('lab-use-profile','click',()=>{if(S.profileDirty)throw Error('Save the playbook first.');fillBrief({audience:S.profile.audience,tone:S.profile.voice.slice(0,120),cta:S.profile.cta});});
 on('lab-signal-form','submit',async e=>{e.preventDefault();const r=await api('signals',{permission_confirmed:$('lab-audience-permission').checked,signals:[{text:$('lab-signal-text').value,theme:$('lab-signal-theme').value,signal_kind:$('lab-signal-kind').value,source_url:$('lab-signal-url').value,provenance:$('lab-signal-provenance').value}]});await refresh();notify(r.created+' added; '+r.duplicates+' duplicates.');});
 on('lab-signal-template','click',()=>window.PhoneLocal.exportFile('audience-template.csv','text,theme,signal_kind,source_url,provenance,observed_at\n','text/csv'));
 on('lab-signal-csv','change',async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;if(!$('lab-audience-permission').checked)throw Error('Confirm permission and remove identities before importing.');if(file.size>2000000)throw Error('CSV limit is 2 MB.');const rows=window.parseCsvRows(await file.text()),heads=(rows.shift()||[]).map(s=>s.trim().toLowerCase());if(!heads.includes('text'))throw Error('CSV needs a text column.');const allowed=['text','theme','signal_kind','source_url','provenance','observed_at'];const signals=rows.filter(r=>r.some(x=>x.trim())).map(row=>Object.fromEntries(heads.map((h,i)=>[h,row[i]||'']).filter(([h])=>allowed.includes(h))));const r=await api('signals',{signals,permission_confirmed:true});await refresh();notify(r.created+' added; '+r.duplicates+' duplicates. Author columns were not stored.');});
 on('lab-plan','change',payoffOptions);
 on('lab-review-form','submit',async e=>{e.preventDefault();const plan=S.plans.find(p=>p.id===$('lab-plan').value);if(!plan)throw Error('Choose a saved brief.');const x=$('lab-payoff').value;await api('review',{plan_id:plan.id,plan_revision:plan.revision,payoff_beat:x===''?null:Number(x)});await refresh();$('lab-reviews').scrollIntoView({behavior:'smooth'});notify('Metric-blind review saved. Inspect its flags, not an invented score.');});
 const local=new Date(Date.now()-new Date().getTimezoneOffset()*60000);$('lab-retention-date').value=local.toISOString().slice(0,16);
 on('lab-retention-csv','change',async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;if(file.size>2000000)throw Error('CSV limit is 2 MB.');$('lab-retention-points').value=await file.text();});
 on('lab-retention-form','submit',async e=>{e.preventDefault();const n=$('lab-retention-n').value,when=new Date($('lab-retention-date').value);if(!Number.isFinite(when.getTime()))throw Error('Choose an observation time.');const r=await api('retention',{post_id:$('lab-retention-post').value,points:retentionPoints($('lab-retention-points').value),source:$('lab-retention-source').value,label:$('lab-retention-label').value,observed_at:when.toISOString(),sample_size:n===''?null:Number(n),definition:'audience_percent',permission_confirmed:$('lab-retention-permission').checked});await refresh();$('lab-retention-series').value=r.id;await showRetention();$('lab-retention-result').scrollIntoView({behavior:'smooth'});notify(r.duplicate?'This observation already exists.':'Measured retention saved; no cause inferred.');});
 on('lab-retention-series','change',showRetention);
 window.CreativeLab={state:S,refresh,api,tab,retentionPoints,pendingSignalIds:()=>S.pendingWorkspace===ws()?[...S.pending]:[],clearPending:()=>{S.pending=[];S.pendingWorkspace=null;updateBriefNote();}};
 await refresh();
}
export const ready=init();

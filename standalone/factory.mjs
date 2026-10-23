import {createStore,get,set} from './vendor/idb-keyval.js';
import {captionCues,srtText,drawFrame,loadAssets,releaseAssets,seekPreview,renderReel} from './factory_render.mjs';
const db=createStore('reel-anatomy-on-device-v1','library');
const $=id=>document.getElementById(id),escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const S={campaign:null,key:'A',dirty:false,busy:false,media:new Map(),abort:null,workspace:null,outputs:[],serial:0};
const ws=()=>window.StudioUI.state.workspace||'default';
const api=(route,data,workspace=ws())=>window.PhoneLocal.api('/api/factory/'+route+(data===undefined?(route.includes('?')?'&':'?')+'workspace='+encodeURIComponent(workspace):''),data===undefined?undefined:{method:'POST',body:JSON.stringify({...data,workspace})});
const read=route=>window.PhoneLocal.api('/api/studio/'+route+(route.includes('?')?'&':'?')+'workspace='+encodeURIComponent(ws()));
const variant=()=>S.campaign?.variants.find(v=>v.key===S.key);
const notice=s=>window.notice(s);
const bind=(id,event,fn)=>$(id).addEventListener(event,async ev=>{try{await fn(ev);}catch(e){notice(e.message);$('factory-render-status').textContent=e.message;}});
function dirty(){S.dirty=true;$('factory-dirty').textContent='UNSAVED CHANGES';$('factory-audit').innerHTML='<h3>Changed draft</h3><p>Save to rerun evidence and production checks. Previous approval no longer covers these edits.</p>';}
function clearReview(){document.querySelectorAll('[data-factory-check]').forEach(x=>x.checked=false);}
async function refreshLists(){
 const serial=++S.serial,workspace=ws();
 const [plans,campaigns,claims]=await Promise.all([read('plans'),api('campaigns'),window.PhoneLocal.api('/api/research/claims?workspace='+encodeURIComponent(workspace))]);
 if(serial!==S.serial||workspace!==ws())return;
 if(S.workspace!==workspace){S.workspace=workspace;S.campaign=null;S.dirty=false;releaseAssets(S.media);$('factory-editor').hidden=true;}
 const old=$('factory-plan').value;$('factory-plan').innerHTML='<option value="">Choose a saved filming brief</option>'+plans.plans.map(p=>'<option value="'+p.id+'">'+escape(p.brief.topic)+' · v'+p.revision+'</option>').join('');if(plans.plans.some(p=>p.id===old))$('factory-plan').value=old;
 $('factory-claims').innerHTML=claims.claims.length?claims.claims.map(c=>'<label><input type="checkbox" data-factory-claim="'+c.id+'"><span>'+escape(c.statement)+'<br><small>'+escape(c.evidence_state)+(c.stale_citations.length?' · STALE':'')+'</small></span></label>').join(''):'<p class="small-note">No claims in this project yet. Add evidence in Sanctum. You can still create a clearly marked draft.</p>';
 const existing=$('factory-campaign').value;$('factory-campaign').innerHTML='<option value="">Choose a campaign</option>'+campaigns.campaigns.map(c=>'<option value="'+c.id+'">'+escape(c.title)+' · v'+c.revision+'</option>').join('');if(campaigns.campaigns.some(c=>c.id===existing))$('factory-campaign').value=existing;
}
function showAudit(){
 const a=S.campaign.audits[S.key];$('factory-audit').innerHTML='<h3>'+ (a.reviewed?'Human-reviewed version':a.ready_for_review?'Ready for your review':'Draft needs attention')+'</h3><p class="small-note">'+a.word_count+' words · '+a.words_per_minute+' planned words/minute. Not a retention prediction.</p>'+(a.blockers.length?'<ul>'+a.blockers.map(t=>'<li class="factory-blocker">'+escape(t)+'</li>').join('')+'</ul>':'')+(a.warnings.length?'<details><summary>'+a.warnings.length+' review notes</summary><ul>'+a.warnings.map(t=>'<li>'+escape(t)+'</li>').join('')+'</ul></details>':'')+'<p class="small-note">'+escape(a.interpretation)+'</p>';
}
function renderEditor(){
 const c=S.campaign,v=variant();$('factory-editor').hidden=false;$('factory-name').textContent=c.title;$('factory-revision').textContent='CAMPAIGN V'+c.revision+' / VARIANT '+v.key+' V'+v.revision;$('factory-dirty').textContent='SAVED';S.dirty=false;clearReview();
 $('factory-variants').innerHTML=c.variants.map(x=>'<button data-factory-variant="'+x.key+'" class="'+(x.key===v.key?'selected':'')+'">'+x.key+' / '+escape(x.name)+'</button>').join('');
 $('factory-variants').querySelectorAll('button').forEach(b=>b.onclick=async()=>{if(S.busy)return;if(S.dirty&&!confirm('Discard unsaved changes to this variant?'))return;S.campaign=await api('campaign?id='+c.id);S.key=b.dataset.factoryVariant;renderEditor();});
 for(const key of ['hypothesis','caption'])$('factory-'+key).value=v[key];$('factory-metric').value=v.primary_metric;$('factory-window').value=v.window;
 $('factory-silent').checked=v.silent_intentional;$('factory-audio-rights').value=v.narration?.rights||'unconfirmed';$('factory-audio-note').value=v.narration?.rights_note||'';
 $('factory-audio-info').textContent=v.narration?v.narration.name+' · '+v.narration.duration.toFixed(2)+'s':'No narration attached.';
 $('factory-scrub').max=c.duration;$('factory-scrub').value=0;
 $('factory-shots').innerHTML=v.scenes.map((b,i)=>'<article class="factory-shot" data-scene="'+i+'"><div class="section-top"><h3>'+String(i+1).padStart(2,'0')+' / '+escape(b.role)+'</h3><span class="pill">'+b.start.toFixed(1)+'–'+b.end.toFixed(1)+'s</span></div><div class="form-grid"><label>Start, seconds<input data-field="start" type="number" step="0.1" min="0" max="'+c.duration+'" value="'+b.start+'"></label><label>End, seconds<input data-field="end" type="number" step="0.1" min="0" max="'+c.duration+'" value="'+b.end+'"></label><label class="span-two">Spoken words / captions<textarea data-field="spoken" rows="3" maxlength="1800">'+escape(b.spoken)+'</textarea></label><label class="span-two">On-screen headline<textarea data-field="on_screen" rows="2" maxlength="180">'+escape(b.on_screen)+'</textarea></label><label>Statement type<select data-field="nature">'+['unreviewed','assertion','question','opinion','instruction','demonstration'].map(x=>'<option '+(x===b.nature?'selected':'')+' value="'+x+'">'+escape(x)+'</option>').join('')+'</select></label><label>Framing<select data-field="fit"><option value="cover" '+(b.fit==='cover'?'selected':'')+'>Fill frame, centre crop</option><option value="contain" '+(b.fit==='contain'?'selected':'')+'>Keep whole image</option></select></label><label class="span-two">Material limitation, also included verbatim in the spoken or headline text<input data-field="limitation" maxlength="500" value="'+escape(b.limitation)+'"></label></div><div class="factory-evidence-select">'+c.evidence.claims.map(claim=>'<label><input type="checkbox" data-scene-claim="'+claim.id+'" '+(b.claim_ids.includes(claim.id)?'checked':'')+'><span>'+escape(claim.statement)+'</span></label>').join('')+'</div><p class="small-note">Factual assertions require current, reviewed source support. Questions and opinions still require honest scope.</p><label class="file-mini">Attach owned / licensed visual<input data-scene-media="'+i+'" type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime,video/webm"></label><p class="factory-asset-note" data-media-info>'+escape(b.media?b.media.name+' · '+b.media.duration.toFixed(2)+'s':'No visual attached')+'</p><div class="form-grid"><label>Clip start, seconds<input data-field="clip_in" type="number" min="0" step="0.1" value="'+b.clip_in+'"></label><label>Visual rights<select data-field="rights"><option value="unconfirmed">Unconfirmed</option><option value="owned" '+(b.media?.rights==='owned'?'selected':'')+'>My original media</option><option value="licensed" '+(b.media?.rights==='licensed'?'selected':'')+'>Licensed for this use</option></select></label><label class="span-two">Licence / provenance note<input data-field="rights_note" maxlength="1000" value="'+escape(b.media?.rights_note||'')+'"></label></div><label class="check-label"><input type="checkbox" data-field="card" '+(b.card?'checked':'')+'> Use an intentional text card when no visual is attached.</label><button data-remove-media="'+i+'" class="outline-button">Remove visual</button></article>').join('');
 $('factory-shots').querySelectorAll('input:not([type=file]),textarea,select').forEach(x=>x.addEventListener('input',()=>{collect();dirty();}));
 $('factory-shots').querySelectorAll('[data-scene-media]').forEach(el=>el.onchange=async ev=>{try{const i=Number(el.dataset.sceneMedia),file=ev.target.files[0];if(!file)return;collect();const meta=await attach(file,'visual');v.scenes[i].media=meta;v.scenes[i].card=false;dirty();refreshMediaFields(i);}catch(e){notice(e.message);}finally{ev.target.value='';}});
 $('factory-shots').querySelectorAll('[data-remove-media]').forEach(el=>el.onclick=()=>{const i=Number(el.dataset.removeMedia);collect();v.scenes[i].media=null;refreshMediaFields(i);dirty();});
 showAudit();void preview().catch(e=>notice(e.message));void outputList();
}
function refreshMediaFields(i){const b=variant().scenes[i],el=$('factory-shots').querySelector('[data-scene="'+i+'"]');el.querySelector('[data-media-info]').textContent=b.media?b.media.name+' · '+b.media.duration.toFixed(2)+'s':'No visual attached';el.querySelector('[data-field=rights]').value=b.media?.rights||'unconfirmed';el.querySelector('[data-field=rights_note]').value=b.media?.rights_note||'';el.querySelector('[data-field=card]').checked=b.card;}
function collect(){
 const v=variant();if(!v)return;
 for(const el of $('factory-shots').querySelectorAll('[data-scene]')){const b=v.scenes[Number(el.dataset.scene)];for(const field of el.querySelectorAll('[data-field]')){const k=field.dataset.field;if(k==='rights'||k==='rights_note'){if(b.media)b.media[k]=field.value;}else b[k]=field.type==='checkbox'?field.checked:field.type==='number'?Number(field.value):field.value;}b.claim_ids=[...el.querySelectorAll('[data-scene-claim]:checked')].map(x=>x.dataset.sceneClaim);}
 v.hypothesis=$('factory-hypothesis').value;v.caption=$('factory-caption').value;v.primary_metric=$('factory-metric').value;v.window=$('factory-window').value;v.silent_intentional=$('factory-silent').checked;
 if(v.narration){v.narration.rights=$('factory-audio-rights').value;v.narration.rights_note=$('factory-audio-note').value;}
}
async function attach(file,kind){
 if(file.size>100*1024*1024||!file.size)throw Error('Use a non-empty file up to 100 MB.');
 const allowed=kind==='visual'?/^(image\/(png|jpeg|webp)|video\/(mp4|quicktime|webm))$/:/^audio\//;
 if(!allowed.test(file.type))throw Error('This file type is not supported by the local renderer.');
 const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
 let duration=0;
 if(!file.type.startsWith('image/')){const el=document.createElement(kind==='audio'?'audio':'video');el.preload='metadata';const url=URL.createObjectURL(file);let timer;
 try{await new Promise((resolve,reject)=>{timer=setTimeout(()=>reject(Error('Media duration timed out.')),15000);el.onloadedmetadata=resolve;el.onerror=()=>reject(Error('This device cannot decode the chosen file.'));el.src=url;});duration=el.duration;if(!Number.isFinite(duration)||duration<=0)throw Error('Media duration is unavailable. Convert to a standard local file.');}finally{clearTimeout(timer);el.removeAttribute('src');el.load();URL.revokeObjectURL(url);}}
 await set('factory-media:'+sha256,file,db);return {sha256,name:file.name,type:file.type,bytes:file.size,duration,rights:'unconfirmed',rights_note:'',credit:''};
}
async function save(){
 if(!S.campaign)throw Error('Open a campaign first.');collect();
 S.campaign=await api('save',{id:S.campaign.id,revision:S.campaign.revision,key:S.key,variant:variant()},S.campaign.workspace);renderEditor();notice('Variant saved. Previous approval was cleared.');
}
function packageDraft(){return {title:S.campaign.title,variant:variant(),duration:S.campaign.duration,mode:'draft',evidence:S.campaign.evidence};}
async function preview(){
 if(!S.campaign||S.busy)return;collect();releaseAssets(S.media);const p=packageDraft();S.media=await loadAssets(p,sha=>get('factory-media:'+sha,db));await seekPreview(p,Number($('factory-scrub').value),S.media);drawFrame($('factory-preview'),p,Number($('factory-scrub').value),S.media,{safeGuides:true});$('factory-time').textContent=Number($('factory-scrub').value).toFixed(1)+' seconds';
}
function ensureSaved(){if(!S.campaign)throw Error('Open a campaign first.');if(S.dirty)throw Error('Save this variant before rendering or exporting its production package.');}
async function getPackage(key=S.key){ensureSaved();return api('package',{id:S.campaign.id,key,mode:$('factory-mode').value},S.campaign.workspace);}
function productionNotes(p){
 const lines=['# '+p.title+' / variant '+p.variant.key,'','Status: '+p.mode+'. Not published.','',...p.limits,'','## Post caption','',p.variant.caption,'','## Test card','',p.variant.hypothesis,'Primary metric: '+p.variant.primary_metric,'Observation window: '+p.variant.window,'Change tested: opening variant '+p.variant.key+'. Organic distribution is not randomised.','','## Script and shots',''];
 for(const s of p.variant.scenes)lines.push('### '+s.start+'–'+s.end+'s / '+s.role,'',s.spoken,'On screen: '+s.on_screen,'Visual: '+s.visual,'Claim IDs: '+s.claim_ids.join(', '),'');
 lines.push('## Evidence register','');for(const source of Object.values(p.evidence.sources))lines.push('['+source.citation+'] '+source.title,source.url||'User-supplied content','Coverage: '+source.level+'; '+(source.reviewed?'user reviewed':'not reviewed'),source.provenance,'');
 lines.push('## Export caveats','','Caption timing is proportional within each planned shot. Review against the actual narration. No automatic post was created.');return lines.join('\n');
}
function busy(value){S.busy=value;for(const x of $('factory-editor').querySelectorAll('input,textarea,select,button'))if(x.id!=='factory-stop')x.disabled=value;$('factory-stop').disabled=!value;$('research-select').disabled=value;}
async function performRender(keys){
 ensureSaved();if(!navigator.locks)throw Error('Cross-tab rendering lock unavailable. Use a supported modern browser.');
 S.abort=new AbortController();busy(true);releaseAssets(S.media);const workspace=S.campaign.workspace,id=S.campaign.id;const width=Number($('factory-size').value),mode=$('factory-mode').value;
 try{await navigator.locks.request('reel-anatomy-factory-render',{ifAvailable:true},async lock=>{
  if(!lock)throw Error('Another tab is rendering. Wait for that render to finish.');
  for(let i=0;i<keys.length;i++){
   if(S.abort.signal.aborted)throw Error('Batch stopped. Already completed exports are retained.');
   const key=keys[i],p=await api('package',{id,key,mode},workspace);
   $('factory-render-status').textContent='Rendering '+key+' ('+(i+1)+'/'+keys.length+'). Keep this app visible.';$('factory-progress').value=0;
   const result=await renderReel(p,sha=>get('factory-media:'+sha,db),{width,signal:S.abort.signal,onProgress:f=>$('factory-progress').value=f});
   const receipt=await api('receipt',{id,key,mode,package_hash:p.package_hash,content_hash:p.audit.content_hash,evidence_hash:p.audit.evidence_hash,file_sha256:result.sha256,bytes:result.bytes,mime:result.mime},workspace);
   const keyOut='factory-output:'+receipt.id;await set(keyOut,{blob:result.blob,receipt,package:p,extension:result.extension},db);
   S.campaign=await api('campaign?id='+id,undefined,workspace);await outputList();
  }
  $('factory-render-status').textContent='Completed '+keys.length+' local export(s). Review the downloaded video before posting. Nothing was published.';
 });}finally{busy(false);S.abort=null;if(S.campaign){$('factory-revision').textContent='CAMPAIGN V'+S.campaign.revision+' / VARIANT '+S.key;showAudit();}}
}
async function outputList(){
 S.outputs.forEach(x=>URL.revokeObjectURL(x.url));S.outputs=[];if(!S.campaign)return;
 for(const receipt of [...S.campaign.exports].reverse().slice(0,6)){const record=await get('factory-output:'+receipt.id,db);if(record){S.outputs.push({...record,url:URL.createObjectURL(record.blob)});}}
 $('factory-outputs').innerHTML=S.outputs.map((x,i)=>'<article class="factory-output"><h3>Variant '+x.receipt.key+' / '+escape(x.receipt.mode)+'</h3><p class="small-note">'+escape(x.receipt.mime)+' · '+(x.receipt.bytes/1024/1024).toFixed(1)+' MB · not published</p><video controls playsinline preload="metadata" src="'+x.url+'"></video><a class="primary-button" href="'+x.url+'" download="reel-'+S.campaign.id.slice(0,8)+'-'+x.receipt.key+'-'+x.receipt.mode+'.'+x.extension+'">Save video</a><button class="outline-button" data-output-notes="'+i+'">Source receipt / test card</button><button class="outline-button" data-output-draft="'+i+'">Use this render as our draft</button><p class="small-note">SHA-256: '+escape(x.receipt.file_sha256)+'</p></article>').join('');
 $('factory-outputs').querySelectorAll('[data-output-draft]').forEach(b=>b.onclick=async()=>{try{if(!confirm('Add this actual rendered file to our draft library? This does not publish it or certify its rights.'))return;await window.ReleaseDesk.sendToLibrary(S.outputs[Number(b.dataset.outputDraft)]);}catch(e){notice(e.message);}});
 $('factory-outputs').querySelectorAll('[data-output-notes]').forEach(b=>b.onclick=()=>{const x=S.outputs[Number(b.dataset.outputNotes)];window.PhoneLocal.exportFile('reel-production-receipt.json',{receipt:x.receipt,package:x.package});});
}
async function init(){
 document.querySelector('[data-studio-tab="factory"]').addEventListener('click',()=>refreshLists().catch(e=>notice(e.message)));
 $('research-select').addEventListener('change',()=>setTimeout(()=>refreshLists().catch(e=>notice(e.message)),100));
 bind('factory-to-studio','click',()=>window.StudioUI.show('create'));bind('factory-refresh','click',refreshLists);
 bind('factory-create','submit',async ev=>{ev.preventDefault();const c=await api('create',{plan_id:$('factory-plan').value,title:$('factory-title').value,claim_ids:[...document.querySelectorAll('[data-factory-claim]:checked')].map(x=>x.dataset.factoryClaim)});S.campaign=c;S.key='A';await refreshLists();$('factory-campaign').value=c.id;renderEditor();notice('Three editable variants created. Research review is still required.');});
 bind('factory-open','click',async()=>{if(S.dirty&&!confirm('Discard the unsaved edits?'))return;S.campaign=await api('campaign?id='+$('factory-campaign').value);S.key='A';renderEditor();});
 for(const id of ['factory-hypothesis','factory-caption','factory-metric','factory-window','factory-silent','factory-audio-rights','factory-audio-note'])bind(id,'input',()=>{collect();dirty();});
 bind('factory-audio','change',async ev=>{const file=ev.target.files[0];ev.target.value='';if(!file)return;collect();variant().narration=await attach(file,'audio');variant().silent_intentional=false;$('factory-silent').checked=false;$('factory-audio-info').textContent=file.name+' · '+variant().narration.duration.toFixed(2)+'s';$('factory-audio-rights').value='unconfirmed';dirty();});
 bind('factory-audio-remove','click',()=>{variant().narration=null;$('factory-audio-info').textContent='No narration attached.';dirty();});
 bind('factory-save','click',save);bind('factory-preview-refresh','click',preview);
 bind('factory-scrub','input',async()=>{if(!S.campaign||S.busy)return;const t=Number($('factory-scrub').value);await seekPreview(packageDraft(),t,S.media);drawFrame($('factory-preview'),packageDraft(),t,S.media,{safeGuides:true});$('factory-time').textContent=t.toFixed(1)+' seconds';});
 bind('factory-copy-visuals','click',async()=>{ensureSaved();const source=structuredClone(variant());for(const target of S.campaign.variants.filter(x=>x.key!==S.key)){target.scenes.forEach((b,i)=>{const from=source.scenes[i];if(from)for(const k of ['media','clip_in','fit','card'])b[k]=structuredClone(from[k]);});S.campaign=await api('save',{id:S.campaign.id,revision:S.campaign.revision,key:target.key,variant:target},S.campaign.workspace);}renderEditor();notice('Visuals reused. Narration and factual review remain variant-specific.');});
 bind('factory-evidence','click',async()=>{ensureSaved();S.campaign=await api('refresh',{id:S.campaign.id,revision:S.campaign.revision},S.campaign.workspace);renderEditor();notice('Evidence refreshed. All earlier approvals were cleared.');});
 bind('factory-approve','click',async()=>{ensureSaved();const checks=Object.fromEntries([...document.querySelectorAll('[data-factory-check]')].map(x=>[x.dataset.factoryCheck,x.checked]));S.campaign=await api('approve',{id:S.campaign.id,revision:S.campaign.revision,key:S.key,reviewer:$('factory-reviewer').value,checks},S.campaign.workspace);renderEditor();notice('Review recorded for this exact script, evidence and asset set.');});
 bind('factory-render','click',()=>performRender([S.key]));bind('factory-batch','click',()=>performRender(S.campaign.variants.map(x=>x.key)));bind('factory-stop','click',()=>S.abort?.abort());
 bind('factory-package','click',async()=>window.PhoneLocal.exportFile('reel-'+S.key+'-package.json',await getPackage()));
 bind('factory-batch-package','click',async()=>{ensureSaved();const packages=[];for(const v of S.campaign.variants)packages.push(await getPackage(v.key));window.PhoneLocal.exportFile('reel-campaign-batch.json',{format:'reel-factory-batch',packages});});
 bind('factory-srt','click',async()=>{const p=await getPackage();window.PhoneLocal.exportFile('reel-'+S.key+'-captions.srt',srtText(p.variant.scenes),'text/plain');});
 bind('factory-notes','click',async()=>window.PhoneLocal.exportFile('reel-'+S.key+'-production.md',productionNotes(await getPackage()),'text/markdown'));
 window.addEventListener('beforeunload',ev=>{if(S.dirty||S.busy){ev.preventDefault();ev.returnValue='';}});
 await refreshLists();window.ReelFactory={state:S,refresh:refreshLists,open:async id=>{S.campaign=await api('campaign?id='+id);S.key='A';renderEditor();},api,renderReel,render:performRender,preview,attach,productionNotes};
}
export const ready=init();

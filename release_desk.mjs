import {createStore,get,set,keys} from './vendor/idb-keyval.js';
import {importDocument,renderPDFPage,documentReference,sha256} from './document_tools.mjs';
import {exportProjectPack,inspectProjectPack,restoreProjectPack} from './project_pack.mjs';
import {articleEndpoint,readAvailableArticle} from './article_reader.mjs';
import {chooseMime} from './factory_render.mjs';
const db=createStore('reel-anatomy-on-device-v1','library'),$=id=>document.getElementById(id);
const S={busy:false,controller:null,document:null,pdfController:null,objectURLs:[],build:null,registration:null};
const ws=()=>window.StudioUI?.state?.workspace||'default';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const notify=s=>window.notice?.(s);
const bind=(id,event,fn)=>$(id)?.addEventListener(event,async e=>{try{await fn(e);}catch(error){notify(error.message);$('release-status').textContent=error.message;}});
async function operation(fn){if(S.busy)throw Error('A document or transfer operation is already active.');S.busy=true;S.controller=new AbortController();$('release-stop').disabled=false;try{return await fn(S.controller.signal);}finally{S.busy=false;S.controller=null;$('release-stop').disabled=true;}}
async function refresh(){await window.StudioUI.refresh();await window.loadLibrary();await window.Sanctum.refresh();await window.ReelFactory.refresh();}
async function showDocument(ref){
 S.pdfController?.abort();S.pdfController=new AbortController();S.document=ref;$('document-page').value=ref.page;
 if(!$('document-viewer').open)$('document-viewer').showModal();$('document-page-status').textContent='Rendering original page…';
 const info=await renderPDFPage(ref.hash,ref.page,$('document-canvas'),{signal:S.pdfController.signal});
 $('document-title').textContent=info.title;$('document-page-status').textContent='Page '+info.page+' of '+info.pages;$('document-page').max=info.pages;$('document-prev').disabled=info.page<=1;$('document-next').disabled=info.page>=info.pages;
}
function sourceControls(){
 const source=window.Sanctum?.state?.current,ref=source&&documentReference(source);
 $('view-source-pdf').hidden=!ref?.pdf;$('read-full-article').hidden=!articleEndpoint(source||{});
}
async function diagnostics(){
 const estimate=await navigator.storage?.estimate?.();const state=await window.PhoneLocal.inspectState();const jobs=await window.PhoneLocal.api('/api/studio/jobs');
 const result={app:S.build?{version:S.build.version,build:S.build.build,source_commit:S.build.source_commit}:null,
  environment:{secure:window.isSecureContext,online:navigator.onLine,viewport:{width:innerWidth,height:innerHeight},installed:matchMedia('(display-mode: standalone)').matches||navigator.standalone===true},
  capabilities:{indexedDB:!!window.indexedDB,workers:!!window.Worker,serviceWorker:!!navigator.serviceWorker,crossTabLocks:!!navigator.locks,webGPU:!!navigator.gpu,canvasCapture:typeof HTMLCanvasElement.prototype.captureStream==='function',recorder:chooseMime(),fileSharing:typeof navigator.share==='function'},
  storage:{usage:estimate?.usage??null,quota:estimate?.quota??null,persistent:await navigator.storage?.persisted?.()??null,revision:state.revision},
  queue:{count:jobs.jobs.length,paused:jobs.paused,running:jobs.jobs.filter(x=>x.status==='running').length},
  inference:{loaded:!!window.Sanctum?.reasoner?.engine,model:window.Sanctum?.reasoner?.model||null,quality:'Not established by a feature probe.'},
  privacy:'No source titles, documents, transcripts, account details, filenames or private prompts included.'};
 $('device-diagnostics').textContent=JSON.stringify(result,null,2);return result;
}
async function archivedOutputs(){
 for(const url of S.objectURLs)URL.revokeObjectURL(url);S.objectURLs=[];const entries=[];
 for(const key of await keys(db))if(typeof key==='string'&&/^archived-output:[a-f0-9]{64}$/.test(key)){
  const value=await get(key,db);if(!(value?.blob instanceof Blob))continue;const url=URL.createObjectURL(value.blob);S.objectURLs.push(url);entries.push({url,...value});
 }
 $('archived-videos').innerHTML=entries.length?entries.map(x=>'<div class="storage-entry"><a href="'+x.url+'" download="'+esc(x.name)+'">Save '+esc(x.name)+'</a><p>'+esc(x.review_state)+'</p></div>').join(''):'<p class="small-note">No historical rendered videos restored on this device.</p>';
}
export async function sendToLibrary(output){
 if(!(output?.blob instanceof Blob)||!output.package||!output.receipt)throw Error('Choose a completed local render.');
 const sha=await sha256(await output.blob.arrayBuffer());if(sha!==output.receipt.file_sha256)throw Error('Stored video does not match its render receipt.');
 await set('video:'+sha.slice(0,32),output.blob,db);
 const link=await window.PhoneLocal.api('/api/release/register-render',{method:'POST',body:JSON.stringify({workspace:output.package.workspace,campaign_id:output.package.campaign_id,receipt_id:output.receipt.id,sha256:sha,package:output.package})});
 await refresh();window.StudioUI.show('library');notify(link.duplicate?'This export is already linked to our draft library.':'Actual rendered video added as our draft. Record the prospective test in Results before publication.');return link;
}
async function setupUpdate(){
 if(!navigator.serviceWorker)return;
 S.registration=await navigator.serviceWorker.getRegistration(new URL('./',location.href).href);
 const reg=S.registration;if(!reg)return;
 const render=()=>{$('update-ready').hidden=!reg.waiting;};render();reg.addEventListener('updatefound',()=>reg.installing?.addEventListener('statechange',render));
 $('check-update').onclick=async()=>{try{await reg.update();render();$('release-status').textContent=reg.waiting?'A new app version is ready. Save edits before reopening.':'Update check completed. No waiting version was found.';}catch(e){notify(e.message);}};
 // Do not force activation across tabs with potentially unsaved edits or active exports.
 $('apply-update').onclick=()=>{if(S.busy||window.ReelFactory?.state?.busy||window.ReelFactory?.state?.dirty||window.Sanctum?.state?.run||window.Sanctum?.state?.asking){notify('Finish and save active work before reopening for an update.');return;}notify('Save all edits, close every Reel Anatomy tab, then reopen. Device data is retained; do not clear storage.');};
}
async function init(){
 document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>window.StudioUI.show(b.dataset.go));
 const mobileNav=document.createElement('label');mobileNav.className='mobile-workflow';mobileNav.innerHTML='<span>Workspace</span><select id="mobile-workflow" aria-label="Choose workspace"></select>';document.querySelector('.workspace-tabs').append(mobileNav);
 const tabs=[...document.querySelectorAll('[data-studio-tab]')];
 $('mobile-workflow').replaceChildren(...tabs.map(b=>new Option(b.textContent.trim(),b.dataset.studioTab)));
 $('mobile-workflow').addEventListener('change',()=>{const button=tabs.find(b=>b.dataset.studioTab===$('mobile-workflow').value);button?.click();});
 new MutationObserver(()=>{$('mobile-workflow').value=document.body.dataset.view||'home';}).observe(document.body,{attributes:true,attributeFilter:['data-view']});

 $('room-sources').insertAdjacentHTML('afterbegin','<details class="studio-card"><summary>Read a PDF or saved article</summary><p>Import permitted documents locally. PDF pages retain exact page references, with the original available for inspection. Image-only pages are reported, not invented.</p><label class="file-mini">Choose PDF / HTML<input id="document-file" type="file" accept=".pdf,.html,.htm,application/pdf,text/html"></label><p id="document-import-status" class="release-progress" role="status"></p></details>');
 $('source-form').insertAdjacentHTML('beforebegin','<div id="source-document-action" class="actions"><button id="view-source-pdf" type="button" class="outline-button" hidden>Inspect original PDF page</button><button id="read-full-article" type="button" class="outline-button" hidden>Read available full article</button></div>');
 new MutationObserver(sourceControls).observe($('source-dialog'),{attributes:true,attributeFilter:['open']});
 $('studio-settings').insertAdjacentHTML('beforeend',`<div class="studio-card"><h3>Portable project packs</h3><p>Carry the library with its original video, audio and documents. Restoring replaces metadata atomically, preserves a recovery copy and clears earlier campaign approval.</p><div class="actions"><label class="check-label"><input id="pack-media" type="checkbox" checked> Include original media and documents</label><label class="check-label"><input id="pack-outputs" type="checkbox" checked> Include rendered videos as historical exports</label></div><div class="release-actions"><button id="pack-export" class="primary-button">Export project pack</button><label class="file-mini">Inspect / restore project pack<input id="pack-import" type="file" accept=".zip,application/zip"></label><button id="release-stop" class="outline-button" disabled>Cancel current transfer</button></div><p class="pack-notice">Packs are not encrypted. Share only with intended recipients. Maximum 200 MB; save larger media separately. Metadata-only JSON backups are still supported. Downloaded model caches are never included.</p><p id="release-status" role="status" class="release-progress"></p><div id="pack-preview"></div><h4>Recovered rendered videos</h4><div id="archived-videos"></div></div><div class="studio-card"><h3>Update without erasing work</h3><p id="current-build">Loading build identity…</p><button id="check-update" class="outline-button">Check for an app update</button><div id="update-ready" class="update-banner" hidden><strong>A newer app is ready.</strong><p>Finish and save work in all open tabs, then close and reopen the app. Do not clear website data.</p><button id="apply-update" class="outline-button">Update instructions</button></div></div><div class="studio-card"><h3>Device diagnostics</h3><p>No media, prompts or source titles are included in this report.</p><div class="actions"><button id="run-diagnostics" class="outline-button">Check this device</button><button id="export-diagnostics" class="outline-button">Export diagnostics</button></div><pre id="device-diagnostics"></pre></div><div class="studio-card"><h3>What still holds stable 1.0</h3><p>These gates remain visible rather than disappearing behind a version number.</p><div id="release-gates" class="release-gates"></div></div>`);
 bind('document-file','change',async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;const workspace=ws();await operation(async signal=>{
  $('document-import-status').textContent='Reading locally…';const result=await importDocument(file,{workspace,signal,onProgress:(n,total)=>$('document-import-status').textContent='Extracting page '+n+' of '+total});
  $('document-import-status').textContent=result.created+' source pages added; '+result.duplicates+' duplicates. '+(result.empty_pages.length?'No text on pages '+result.empty_pages.join(', ')+'. ':'')+'Inspect original pages before relying on their text.';await refresh();
 });});
 bind('view-source-pdf','click',async()=>{const ref=documentReference(window.Sanctum.state.current);if(ref)await showDocument(ref);});
 bind('document-close','click',()=>{S.pdfController?.abort();$('document-viewer').close();});
 bind('document-page','change',()=>showDocument({...S.document,page:Number($('document-page').value)}));bind('document-prev','click',()=>showDocument({...S.document,page:S.document.page-1}));bind('document-next','click',()=>showDocument({...S.document,page:S.document.page+1}));
 bind('read-full-article','click',async()=>{const source=window.Sanctum.state.current;if(!source)return;
  if(!confirm('Fetch this article through its public provider? The provider sees the article request and network address. Unsaved source-form edits will not be used.'))return;
  await operation(async signal=>{const updated=await readAvailableArticle(source,{signal});await window.PhoneLocal.api('/api/research/source',{method:'POST',body:JSON.stringify(updated)});$('source-dialog').close();await refresh();notify('Available article text saved as unreviewed. Earlier quotations are rechecked against its new revision.');});
 });
 bind('release-stop','click',()=>S.controller?.abort());
 bind('pack-export','click',()=>operation(async signal=>{const result=await exportProjectPack({signal,includeMedia:$('pack-media').checked,includeOutputs:$('pack-outputs').checked,onProgress:(n,bytes)=>$('release-status').textContent='Packing '+n+' media items · '+(bytes/1048576).toFixed(1)+' MB'});window.PhoneLocal.exportFile('reel-anatomy-project.reelpack.zip',result.blob,'application/zip');$('release-status').textContent='Project pack created: '+(result.bytes/1048576).toFixed(1)+' MB. Save it outside browser storage.';}));
 bind('pack-import','change',async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;await operation(async signal=>{
  $('release-status').textContent='Verifying all pack files before any restore…';const checked=await inspectProjectPack(file,{signal});
  $('pack-preview').textContent='Contains '+checked.manifest.assets.length+' original files, '+checked.manifest.outputs.length+' historical exports and '+checked.library.tables.research.length+' research projects.';
  if(!confirm('Replace this device library with this verified project pack? Existing metadata is retained as a recovery copy. Earlier campaign approvals are not restored.')){$('release-status').textContent='Pack inspected. Nothing restored.';return;}
  const receipt=await restoreProjectPack(checked,{signal});await refresh();await archivedOutputs();$('release-status').textContent='Restore committed atomically. '+receipt.media_entries+' file records restored. Reload to refresh project selection. No social post was created.';
 });});
 bind('run-diagnostics','click',diagnostics);bind('export-diagnostics','click',async()=>window.PhoneLocal.exportFile('reel-anatomy-diagnostics.json',await diagnostics()));
 try{S.build=await fetch(new URL('./BUILD.json',import.meta.url)).then(r=>r.json());$('current-build').textContent=S.build.version+' · build '+S.build.build;$('home-build').textContent=S.build.version+' / '+S.build.build;}catch{$('home-build').textContent='Build identity unavailable offline.';}
 try{const target=await fetch(new URL('./RELEASE_TARGET.json',import.meta.url)).then(r=>r.json());$('release-gates').innerHTML=target.gates.map(g=>'<article><strong>'+esc(g.title)+' · '+esc(g.status.replaceAll('_',' '))+'</strong><p>'+esc(g.acceptance)+'</p></article>').join('');}catch{}
 window.ReleaseDesk={get busy(){return S.busy;},state:S,diagnostics,sendToLibrary,importDocument,exportProjectPack,inspectProjectPack,restoreProjectPack,showDocument};
 await archivedOutputs();setTimeout(()=>void setupUpdate(),1500);
}
export const ready=init();

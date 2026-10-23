import {createStore,get,set,update,del,keys} from './vendor/idb-keyval.js';
import {inspectVideo} from './media.mjs';
const db=createStore('reel-anatomy-on-device-v1','library');
let worker=new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'});
const waiting=new Map();let sequence=0,tail=Promise.resolve(),driving=false,workerFailed=false;
const urls=new Map();
function failWorker(message){
 workerFailed=true;worker.terminate();
 for(const p of waiting.values()){clearTimeout(p.timer);p.reject(Error(message));}waiting.clear();
}
worker.onmessage=({data})=>{const p=waiting.get(data.id);if(p){clearTimeout(p.timer);waiting.delete(data.id);data.ok?p.resolve(data):p.reject(Error(data.error));}};
worker.onerror=error=>failWorker('The on-device engine stopped: '+error.message+'. Reload to recover the last committed state.');
function call(request){return new Promise((resolve,reject)=>{
 if(workerFailed){reject(Error('The engine is stopped. Reload; no failed operation was committed.'));return;}
 const id=++sequence,timer=setTimeout(()=>failWorker('The local engine exceeded its 90-second operation limit. Reload to recover; do not repeatedly submit the operation.'),90000);
 waiting.set(id,{resolve,reject,timer});worker.postMessage({id,request});
});}
async function inspectState(){const state=await get('state',db)||{revision:0,snapshot:null};return {revision:state.revision};}
function restoreBundle(library,additions=[],{signal}={}){
 const operation=tail.catch(()=>{}).then(async()=>{
  if(driving||window.ReelFactory?.state?.busy)throw Error('An active media job must finish before restore.');
  if(!navigator.locks)throw Error('This browser does not support safe cross-tab restore locks.');
  return navigator.locks.request('reel-anatomy-video-queue',{ifAvailable:true},async videoLock=>{
   if(!videoLock)throw Error('Another tab is inspecting media. Close it before restoring.');
   return navigator.locks.request('reel-anatomy-factory-render',{ifAvailable:true},async renderLock=>{
    if(!renderLock)throw Error('Another tab is rendering. Finish that work first.');
    const old=await get('state',db)||{revision:0,snapshot:null};
    const backup=await call({path:'/phone/export',method:'GET',data:{},snapshot:old.snapshot});
    const candidate=await call({path:'/phone/import-backup',method:'POST',data:library,snapshot:old.snapshot});
    if(!candidate.snapshot)throw Error('Restore validation did not produce a candidate state.');
    if(signal?.aborted)throw Error('Restore cancelled before commit.');
    const receipt={id:crypto.randomUUID(),at:new Date().toISOString(),prior_revision:old.revision,restored_revision:old.revision+1,media_entries:additions.length};
    await db('readwrite',store=>new Promise((resolve,reject)=>{
     const tx=store.transaction;let problem;
     tx.oncomplete=()=>resolve();tx.onabort=()=>reject(problem||tx.error||Error('Restore transaction aborted. The old state remains committed.'));tx.onerror=()=>{};
     const check=store.get('state');check.onsuccess=()=>{
      if((check.result?.revision||0)!==old.revision){problem=Error('Another tab changed the library. No restore was committed.');tx.abort();return;}
      if(signal?.aborted){problem=Error('Restore cancelled before commit.');tx.abort();return;}
      try{
       store.put(backup.value,'previous-backup');
       for(const [key,value]of additions)store.put(value,key);
       store.put({revision:old.revision+1,snapshot:candidate.snapshot},'state');store.put(receipt,'last-restore-receipt');
      }catch(e){problem=e;tx.abort();}
     };
    }));
    for(const url of urls.values())URL.revokeObjectURL(url);urls.clear();return {restored:true,...receipt};
   });
  });
 });
 tail=operation;return operation;
}
function invoke(path,method='GET',data={}){
  const operation=tail.catch(()=>{}).then(async()=>{
    for(let attempt=0;attempt<3;attempt++){
      const old=await get('state',db)||{revision:0,snapshot:null};
      const r=await call({path,method,data,snapshot:old.snapshot});
      if(r.snapshot){
        let conflict=false;
        await update('state',current=>{
          if((current?.revision||0)!==old.revision){conflict=true;return current;}
          return {revision:old.revision+1,snapshot:r.snapshot};
        },db);
        if(conflict){if(attempt===2)throw Error('Another tab changed this library. Reopen this screen.');continue;}
      }
      return r.value;
    }
  });
  tail=operation;return operation;
}
async function hydrate(a){
  if(!a||!a.id||!Array.isArray(a.segments))return a;
  const file=await get('video:'+a.id,db);const thumbnails=await get('thumbs:'+a.id,db)||[];
  if(file&&!urls.has(a.id))urls.set(a.id,URL.createObjectURL(file));
  return {...a,media:urls.get(a.id)||'',thumbnails,notices:[...(a.notices||[]),...(!file?['Original video is not on this device. Attach it in Settings to enable playback.']:[])]};
}
const hex=buffer=>Array.from(new Uint8Array(buffer),b=>b.toString(16).padStart(2,'0')).join('');
async function acceptVideo(form,legacy=false){
  const file=form.get('video');if(!(file instanceof Blob)||!file.size)throw Error('Choose a video.');
  if(file.size>100*1024*1024)throw Error('On-device videos are limited to 100 MB each. Use desktop for larger footage.');
  const metadata=legacy?{rights_confirmed:true,collection:'reference',workspace:'default'}:JSON.parse(form.get('metadata')||'{}');
  if(metadata.rights_confirmed!==true)throw Error('Confirm your permission to process this footage.');
  const estimate=await navigator.storage?.estimate?.();
  if(estimate?.quota&&estimate.quota-estimate.usage<file.size*1.5)throw Error('Not enough browser storage. Export a backup before removing local media.');
  const transcript=String(form.get('transcript')||'');
  const hash=hex(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()));
  const id=hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(hash+'|'+transcript+'|browser-sampled-v1'))).slice(0,32);
  const title=file.name.replace(/\.[^.]+$/,'').slice(0,120);metadata.title=metadata.title||title;
  const workspace=metadata.workspace||'default';delete metadata.workspace;
  await set('video:'+id,file,db);
  const job=await invoke('/phone/job-add','POST',{asset_id:id,title,workspace,metadata,transcript});
  void drive();return job;
}
async function drive(){
  if(driving||document.hidden)return;driving=true;
  try{
    if(!navigator.locks)throw Error('This browser lacks cross-tab locks. Use an up-to-date Safari or desktop browser.');
    await navigator.locks.request('reel-anatomy-video-queue',{ifAvailable:true},async lock=>{
      if(!lock)return;
      await invoke('/phone/recover','POST',{});
      while(!document.hidden){
        const j=await invoke('/phone/claim','POST',{});if(!j)break;
        try{
          const file=await get('video:'+j.payload.asset_id,db);
          if(!file)throw Error('The source video is missing from local storage. Import it again.');
          let reuse=null;try{reuse=await invoke('/api/project/'+j.payload.asset_id);}catch{}
          if(reuse){await invoke('/phone/reuse','POST',{id:j.id});continue;}
          const media=await inspectVideo(file);await set('thumbs:'+j.payload.asset_id,media.thumbnails,db);delete media.thumbnails;
          await invoke('/phone/complete','POST',{id:j.id,asset:media});
        }catch(error){await invoke('/phone/complete','POST',{id:j.id,error:error.message});}
      }
    });
  }catch(error){showMessage(error.message);}finally{driving=false;}
}
async function api(path,options){
  const method=options?.method||'GET';
  if(path==='/api/studio/import'||path==='/api/analyze'){
    const job=await acceptVideo(options.body,path==='/api/analyze');
    if(path==='/api/studio/import')return job;
    for(let i=0;i<240;i++){
      await new Promise(r=>setTimeout(r,500));const state=await invoke('/api/studio/jobs');const j=state.jobs.find(x=>x.id===job.id);
      if(j?.status==='complete')return hydrate(await invoke('/api/project/'+j.result.asset_id));
      if(j?.status==='failed')throw Error(j.error);
      if(state.paused)throw Error('The video is queued. Resume the queue in Library.');
    }
    throw Error('The video remains in Library. Check its queue status before resubmitting.');
  }
  const value=await invoke(path,method,options?.body?JSON.parse(options.body):{});
  if(path.startsWith('/api/project/'))return hydrate(value);
  if(path==='/api/studio/queue'){void drive();}
  return value;
}
function showMessage(message){if(window.notice)window.notice(message);else document.getElementById('boot-status').textContent=message;}
function exportFile(name,value,type='application/json'){
  const blob=value instanceof Blob?value:new Blob([typeof value==='string'?value:JSON.stringify(value,null,2)],{type});
  const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=name;link.click();
  setTimeout(()=>URL.revokeObjectURL(link.href),30000);
  window.PhoneLocal.lastExport={name,blob};document.getElementById('share-export').hidden=false;
}
async function loadScript(src){await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(Error('Could not load '+src));document.body.append(s);});}
window.PhoneLocal={api,invoke,exportFile,hydrate,inspectState,restoreBundle,current:()=>null};
function bind(id,event,fn){document.getElementById(id).addEventListener(event,async ev=>{try{await fn(ev);}catch(error){showMessage(error.message);}});}
async function start(){
  await api('/api/health');
  await loadScript('./web/app.js');await loadScript('./web/studio.js');
  await window.StudioUI.ready;
  const sanctum=await import('./sanctum.mjs');await sanctum.ready;
  const factory=await import('./factory.mjs');await factory.ready;
  const desk=await import('./release_desk.mjs');await desk.ready;
  document.getElementById('boot').hidden=true;
  window.StudioUI.show('home');
  bind('install-phone','click',()=>document.getElementById('install-dialog').showModal());
  bind('close-install','click',()=>document.getElementById('install-dialog').close());
  bind('export-backup','click',async()=>exportFile('reel-anatomy-backup.json',await invoke('/phone/export')));
  bind('import-phone-json','change',async ev=>{
    const files=Array.from(ev.target.files);let imported=0;
    for(const file of files){
      if(file.size>25*1024*1024)throw Error('JSON import exceeds 25 MB.');
      const data=JSON.parse(await file.text());
      if(data.format==='reel-anatomy-phone-backup'){
        if(!confirm('Replace this device library with this backup? A recovery copy of the current metadata will be retained locally. Videos are not included.'))continue;
        await restoreBundle(data);
      }else if(data.research&&Array.isArray(data.posts)){
        await invoke('/phone/import-research','POST',data);
      }else{
        const analysis=data.analysis||data;
        await invoke('/phone/import-analysis','POST',{analysis,workspace:window.StudioUI.state.workspace});
      }
      imported++;
    }
    ev.target.value='';await window.StudioUI.refresh();await window.loadLibrary();
    showMessage(imported+' file(s) imported. Reload to show newly imported research projects.');
  });
  bind('export-recovery','click',async()=>{const copy=await get('previous-backup',db);if(!copy)throw Error('No pre-restore recovery copy exists.');exportFile('reel-anatomy-recovery.json',copy);});
  bind('attach-media','change',async ev=>{
    const file=ev.target.files[0],a=window.PhoneLocal.current();
    if(!file||!a)throw Error('Open a video in Breakdown first, then choose its original file here.');
    if(file.size>100*1024*1024)throw Error('Use a file up to 100 MB on this device.');
    const check=document.createElement('video'),url=URL.createObjectURL(file);check.preload='metadata';check.src=url;
    try{await new Promise((r,j)=>{check.onloadedmetadata=r;check.onerror=()=>j(Error('Video cannot be decoded.'));setTimeout(()=>j(Error('Video metadata timed out.')),10000);});
      if(Math.abs(check.duration-a.duration)>Math.max(1,a.duration*.03))throw Error('This video length does not match the imported analysis.');
      if(!confirm('Attach this local video to '+a.title+'? Check that it is the original footage.'))return;
      await set('video:'+a.id,file,db);if(urls.has(a.id))URL.revokeObjectURL(urls.get(a.id));urls.delete(a.id);
      await window.openProject(a.id);showMessage('Video attached locally. No upload was made.');
    }finally{check.removeAttribute('src');check.load();URL.revokeObjectURL(url);ev.target.value='';}
  });
  bind('share-export','click',async()=>{
    const x=window.PhoneLocal.lastExport;if(!x)return;
    const file=new File([x.blob],x.name,{type:x.blob.type});
    if(navigator.canShare?.({files:[file]}))await navigator.share({files:[file],title:x.name});
    else exportFile(x.name,x.blob);
  });
  bind('persist-storage','click',async()=>{const kept=await navigator.storage?.persist?.();showMessage(kept?'Persistent storage granted. Still export important work.':'Storage persistence was not granted. Export backups; browser data can be evicted.');});
  if('serviceWorker' in navigator){
    const reg=await navigator.serviceWorker.register('./sw.js',{scope:'./'});
    navigator.serviceWorker.ready.then(()=>{document.getElementById('offline-status').textContent='App available offline. Research stays on this device; export backups.';});
    reg.update().catch(()=>{});
  }
  void drive();
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void drive();});
  setInterval(()=>{if(!document.hidden)void drive();},5000);
}
start().catch(error=>{document.getElementById('boot-status').textContent=error.message+' Reload while online to retry. No library was erased.';console.error(error);});

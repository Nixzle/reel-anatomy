/** Complete device-local project packs. Validation precedes the single IndexedDB restore commit. */
import {createStore,get,keys} from './vendor/idb-keyval.js';
import {PACK_LIMIT} from './pack_worker.mjs';
const db=createStore('reel-anatomy-on-device-v1','library');
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',value)),b=>b.toString(16).padStart(2,'0')).join('');
const KEY=/^(?:video:[a-f0-9]{32}|factory-media:[a-f0-9]{64}|document:[a-f0-9]{64})$/;
function ensureIdle(){
 if(window.ReelFactory?.state?.busy||window.ReelFactory?.state?.dirty||window.Sanctum?.state?.run||window.Sanctum?.state?.asking)throw Error('Finish or save the active edit/research task before transferring the library.');
}
function packWorker(action,payload,{signal}={}){
 return new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(Error('Project transfer cancelled.'));return;}
  const worker=new Worker(new URL('./pack_worker.mjs',import.meta.url),{type:'module'});
  const end=()=>{clearTimeout(timer);signal?.removeEventListener('abort',cancel);worker.terminate();};
  const cancel=()=>{end();reject(Error('Project transfer cancelled. Nothing was restored.'));};
  const timer=setTimeout(()=>{end();reject(Error('Project pack processing exceeded its time budget. Nothing was restored.'));},45000);
  signal?.addEventListener('abort',cancel,{once:true});
  worker.onerror=e=>{end();reject(Error('Project pack worker failed: '+e.message));};
  worker.onmessage=({data})=>{end();data.ok?resolve(data.output):reject(Error(data.error));};
  const transfer=action==='decode'?[payload.bytes.buffer]:Object.values(payload.files).map(x=>x.buffer);
  worker.postMessage({action,...payload},transfer);
 });
}
export async function exportProjectPack({includeMedia=true,includeOutputs=true,onProgress,signal}={}){
 ensureIdle();const before=await window.PhoneLocal.inspectState();const library=await window.PhoneLocal.api('/phone/export');
 const files={'library.json':encoder.encode(JSON.stringify(library))};let total=files['library.json'].byteLength;const assets=[],documents=[],outputs=[],omitted=[];
 const keyList=await keys(db);
 for(const key of keyList){
  if(signal?.aborted)throw Error('Project transfer cancelled.');if(typeof key!=='string')continue;
  if(includeMedia&&KEY.test(key)){
   if(key.startsWith('video:')&&!library.assets?.[key.slice(6)]){omitted.push({key,reason:'Original file has no committed analysis; an interrupted import may have left it behind.'});continue;}
   const file=await get(key,db);if(!(file instanceof Blob))throw Error('Stored media is corrupt: '+key);
   if(total+file.size>PACK_LIMIT-1_000_000)throw Error('Library plus selected media exceeds 200 MB. Export metadata and large media separately.');
   const bytes=new Uint8Array(await file.arrayBuffer()),sha=await hash(bytes),path='blobs/'+sha;
   if(!files[path]){files[path]=bytes;total+=bytes.length;}
   assets.push({key,path,sha256:sha,bytes:bytes.length,type:file.type||'application/octet-stream',name:typeof file.name==='string'?file.name.slice(0,240):key});
   if(key.startsWith('document:')){const info=await get('document-info:'+key.slice(9),db);if(info)documents.push({hash:key.slice(9),info});}
  }else if(includeOutputs&&/^factory-output:[a-f0-9]{32}$/.test(key)){
   const output=await get(key,db);if(!(output?.blob instanceof Blob))continue;
   if(total+output.blob.size>PACK_LIMIT-1_000_000)throw Error('Rendered exports exceed the pack budget. Save them separately or disable their inclusion.');
   const bytes=new Uint8Array(await output.blob.arrayBuffer()),sha=await hash(bytes),path='blobs/'+sha;
   if(!files[path]){files[path]=bytes;total+=bytes.length;}
   outputs.push({sha256:sha,path,bytes:bytes.length,type:output.blob.type,key:output.receipt?.key||'',mode:output.receipt?.mode||'draft',name:'reel-'+(output.receipt?.key||'export')+'.'+(output.extension==='mp4'?'mp4':'webm')});
  }
  onProgress?.(assets.length+outputs.length,total);
 }
 const after=await window.PhoneLocal.inspectState();if(after.revision!==before.revision)throw Error('Library changed during packing. Retry after other work finishes; no inconsistent pack was saved.');
 const manifest={format:'reel-anatomy-project-pack',schema:1,created_at:new Date().toISOString(),library:{path:'library.json',sha256:await hash(files['library.json']),bytes:files['library.json'].length},assets,documents,outputs,omitted,includeMedia,includeOutputs,limits:'Private local data, not encrypted. Restoring rechecks metadata and clears previous campaign approval. Exported videos remain historical artifacts, not fresh editorial approval.'};
 files['manifest.json']=encoder.encode(JSON.stringify(manifest));const bytes=await packWorker('encode',{files},{signal});return {blob:new Blob([bytes],{type:'application/zip'}),manifest,bytes:bytes.byteLength};
}
export async function inspectProjectPack(file,{signal}={}){
 if(!(file instanceof Blob)||file.size>PACK_LIMIT+2_000_000)throw Error('Use a Reel Anatomy project pack up to 200 MB.');
 const files=await packWorker('decode',{bytes:new Uint8Array(await file.arrayBuffer())},{signal});
 if(files['manifest.json']?.length>1_000_000||files['library.json']?.length>25*1024*1024)throw Error('Project metadata exceeds its limit.');
 const manifest=JSON.parse(decoder.decode(files['manifest.json']||new Uint8Array())),library=JSON.parse(decoder.decode(files['library.json']||new Uint8Array()));
 if(manifest.format!=='reel-anatomy-project-pack'||manifest.schema!==1||!Array.isArray(manifest.assets)||!Array.isArray(manifest.documents)||!Array.isArray(manifest.outputs)||manifest.assets.length+manifest.outputs.length>1400)throw Error('Unknown or invalid project pack.');
 const all=[manifest.library,...manifest.assets,...manifest.outputs];const expected=new Set(['manifest.json']);
 for(const item of all){
  if(!item||typeof item.path!=='string'||!Number.isSafeInteger(item.bytes)||item.bytes<0||!/^[a-f0-9]{64}$/.test(item.sha256))throw Error('Invalid file manifest.');
  const bytes=files[item.path];if(!bytes||bytes.length!==item.bytes||await hash(bytes)!==item.sha256)throw Error('Project pack integrity mismatch. No library change was made.');expected.add(item.path);
 }
 if(manifest.library.path!=='library.json'||Object.keys(files).some(n=>!expected.has(n)))throw Error('Unlisted archive content rejected.');
 const seen=new Set();
 for(const a of manifest.assets){
  if(!KEY.test(a.key)||seen.has(a.key)||a.path!=='blobs/'+a.sha256||typeof a.type!=='string'||a.type.length>120||typeof a.name!=='string'||a.name.length>240)throw Error('Invalid or duplicate media mapping.');seen.add(a.key);
  if((a.key.startsWith('factory-media:')||a.key.startsWith('document:'))&&a.key.split(':')[1]!==a.sha256)throw Error('Media identity does not match its bytes.');
  if(a.key.startsWith('video:')&&!library.assets?.[a.key.slice(6)])throw Error('Video has no matching analysis record.');
 }
 for(const d of manifest.documents){
  if(!/^[a-f0-9]{64}$/.test(d.hash)||!seen.has('document:'+d.hash)||!['pdf','html'].includes(d.info?.format)||d.info?.hash!==d.hash||typeof d.info?.title!=='string'||!Array.isArray(d.info.pages)||d.info.pages.length>200)throw Error('Invalid document reference.');
 }
 for(const o of manifest.outputs)if(o.path!=='blobs/'+o.sha256||!/^video\/(mp4|webm)(;.*)?$/.test(o.type)||!/^reel-[ABCexport-]+\.(mp4|webm)$/.test(o.name))throw Error('Invalid historical export.');
 return {manifest,library,files};
}
export async function restoreProjectPack(checked,{signal}={}){
 ensureIdle();if(signal?.aborted)throw Error('Project transfer cancelled.');
 if(!checked?.manifest||!checked?.files)throw Error('Inspect this project pack before restoring it.');
 const additions=checked.manifest.assets.map(a=>[a.key,new Blob([checked.files[a.path]],{type:a.type})]);
 for(const d of checked.manifest.documents)additions.push(['document-info:'+d.hash,d.info]);
 for(const o of checked.manifest.outputs)additions.push(['archived-output:'+o.sha256,{blob:new Blob([checked.files[o.path]],{type:o.type}),name:o.name,sha256:o.sha256,review_state:'Historical export. Restored metadata does not renew editorial approval.'}]);
 const estimate=await navigator.storage?.estimate?.();const required=additions.reduce((n,[,v])=>n+(v instanceof Blob?v.size:v?.blob?.size||0),0);
 if(estimate?.quota&&estimate.quota-estimate.usage<required*1.2)throw Error('Not enough device storage for an atomic restore and recovery copy. Nothing was changed.');
 // The backend validates the metadata into an uncommitted snapshot; all media and state commit together.
 return window.PhoneLocal.restoreBundle(checked.library,additions,{signal});
}

/* Loopback-only offline speech. The hosted app never probes or uploads to another host. */
let health=null,checked=false;
const LOCAL=new Set(['127.0.0.1','localhost']);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function discover(){
 if(checked)return health;checked=true;
 if(!LOCAL.has(location.hostname)||new URL('./',import.meta.url).pathname!=='/')return null;
 const control=new AbortController(),timer=setTimeout(()=>control.abort(),2000);
 try{const r=await fetch('/api/companion/health',{signal:control.signal,cache:'no-store'});if(!r.ok)return null;const value=await r.json();if(value.app==='reel-anatomy-desktop'&&value.speech===true&&typeof value.token==='string')health=value;}catch{}finally{clearTimeout(timer);}
 return health;
}
export function available(){return Boolean(health);}
export async function recognise(blob,{signal,onProgress}={}){
 checked=false;health=null;await discover();if(!health)throw Error('Local speech is available in the desktop bundle. On this device, import timed SRT/VTT captions instead.');
 if(!(blob instanceof Blob)||!blob.size||blob.size>100*1024*1024)throw Error('Choose nonempty media up to 100 MB.');
 if(signal?.aborted)throw Error('Speech job cancelled.');
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
 if(signal?.aborted)throw Error('Speech job cancelled.');
 onProgress?.('Sending this recording only to the local desktop process…');
 // Do not abandon an upload response with an unknown job ID. Reconcile cancellation after the ID arrives.
 const r=await fetch('/api/companion/jobs',{method:'POST',headers:{'X-Reel-Token':health.token,'Content-Type':blob.type||'application/octet-stream'},body:blob});
 const created=await r.json();if(!r.ok)throw Error(created.error||'Local speech request failed.');
 let cancelled=false;
 const cancel=async()=>{if(cancelled)return;cancelled=true;const response=await fetch('/api/companion/jobs/'+created.id+'/cancel',{method:'POST',headers:{'X-Reel-Token':health.token,'Content-Type':'application/json'},body:'{}'});if(!response.ok)throw Error('Cancellation could not be confirmed. Check the local process before retrying.');};
 try{
  for(let i=0;i<650;i++){
   if(signal?.aborted){await cancel();throw Error('Speech job cancelled. No caption track was applied.');}
   const poll=await fetch('/api/companion/jobs/'+created.id,{headers:{'X-Reel-Token':health.token},cache:'no-store'});const value=await poll.json();
   if(!poll.ok)throw Error(value.error||'Speech status unavailable.');
   onProgress?.(value.status==='queued'?'Queued locally…':'Recognising English speech locally. No cloud model is involved.');
   if(value.status==='complete'){
    if(value.result?.audio_sha256!==hash)throw Error('Transcript fingerprint does not match this recording.');
    return value.result;
   }
   if(value.status==='failed'||value.status==='cancelled')throw Error(value.error||'Speech job cancelled.');
   await sleep(500);
  }
  await cancel();throw Error('Speech job timed out. Try a shorter clip.');
 }catch(error){if(signal?.aborted&&!cancelled)await cancel();throw error;}
}

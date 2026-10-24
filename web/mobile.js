/* Phone installation, secure pairing and explicit offline filming copies. */
"use strict";
(() => {
 const remote=!!document.querySelector('meta[name="reel-hosted"]');
 const nativeFetch=window.fetch.bind(window), $=id=>document.getElementById(id);
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const box=document.createElement('div');box.id='mobile-connection';box.className='mobile-gate';box.hidden=true;
 box.innerHTML='<div class="mobile-gate-inner"><span class="mobile-wordmark">REEL ANATOMY / PHONE STUDIO</span><h1>Your studio.<br>Within reach.</h1><p id="mobile-message">Connect this device to your desktop to use the research library, scripts, results and video queue.</p><form id="pair-form"><label>One-time pairing link or code<textarea id="pair-code" rows="3" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Generate a link in desktop Settings → Phone connection" required></textarea></label><button class="primary-button" type="submit">Connect this device</button></form><p class="small-note">The desktop must stay on with Reel Anatomy open for live work. Requests and video chunks use a Cloudflare HTTPS relay. They are not end-to-end encrypted.</p><div class="actions"><button id="mobile-retry" class="outline-button">Reconnect</button><button id="mobile-offline" class="outline-button">Saved on this phone</button><button id="mobile-install-help" class="outline-button">Install on iPhone</button></div><p id="pair-error" role="alert"></p></div>';
 document.body.append(box);
 const dialog=document.createElement('dialog');dialog.id='mobile-menu';dialog.className='mobile-dialog';
 dialog.innerHTML='<div class="section-top"><h2>Phone connection</h2><button id="mobile-close" class="outline-button">Close</button></div><p id="mobile-state"></p><section id="desktop-phone-controls"><p>Pairing gives a device access to this entire studio, not to your computer or terminal. Pair only devices you trust.</p><button id="mobile-new-link" class="primary-button">Create one-time pairing link</button><p id="mobile-pair-result"></p><div id="mobile-devices"></div><button id="mobile-disable" class="outline-button">Disable and revoke all phones</button></section><section id="phone-controls"><p>Desktop data remains authoritative. Save filming briefs below for offline use. Videos are not stored in the offline cache.</p><button id="mobile-save-brief" class="primary-button">Save open filming brief on this phone</button><button id="mobile-forget" class="outline-button">Forget this device and offline copies</button></section><section><h3>Saved on this device</h3><div id="offline-briefs"></div></section><section class="install-instructions"><h3>Install on iPhone</h3><p>Open this address in Safari. Tap Share (or the page menu, then Share), choose Add to Home Screen, turn on Open as Web App, then tap Add.</p><p>If the action is missing, use Edit Actions in the Share menu. If the Home Screen app asks to pair again, create a new one-time link in desktop Settings.</p></section><section><h3>Privacy</h3><p>The relay stores hashed session credentials, not your media library. Transient requests pass through Cloudflare over HTTPS. Use a trusted device; any paired device can edit this studio. No AI provider or social account is automatically enabled.</p></section>';
 document.body.append(dialog);
 const menuButton=document.createElement('button');menuButton.id='mobile-menu-button';menuButton.className='outline-button';menuButton.textContent=remote?'Phone & offline':'Phone connection';
 document.querySelector('.header-right').append(menuButton);
 const banner=document.createElement('div');banner.id='mobile-network-state';banner.setAttribute('role','status');banner.hidden=true;document.querySelector('.main').prepend(banner);
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const clientFetch=(path,options={})=>nativeFetch(path,{...options,headers:{...options.headers,...(options.method==='POST'?{'x-reel-client':'pwa-v1'}:{})},credentials:'same-origin'});
 async function request(path,data){const r=await clientFetch(path,data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const value=await r.json();if(!r.ok)throw Error(value.error||'Request failed');return value;}
 function message(text){$('mobile-state').textContent=text;}
 function gate(text,paired=false){box.hidden=false;document.querySelector('.shell').hidden=true;$('mobile-message').textContent=text;$('pair-form').hidden=paired;$('mobile-retry').hidden=!paired;}
 async function initRemote(){
  const fragment=new URLSearchParams(location.hash.slice(1));const code=fragment.get('pair');if(code){history.replaceState(null,'',location.pathname);$('pair-code').value=code;}
  try{const status=await request('/bridge/session');
   if(!status.paired){gate('Pair this iPhone with the Windows studio. The link is single-use and expires after fifteen minutes.');if(code)await pair(code);return;}
   if(!status.desktop_online){gate('Your computer is offline. Open Reel Anatomy on the desktop, then reconnect. Saved filming briefs below still work.',true);return;}
   box.hidden=true;document.querySelector('.shell').hidden=false;
  }catch(e){gate('The connection is unavailable. Your saved filming briefs can still be opened offline.',true);}
 }
 async function pair(value){
  const code=value.includes('#pair=')?new URLSearchParams(value.split('#')[1]).get('pair'):value.trim();
  if(!/^[a-f0-9]{64}$/.test(code||''))throw Error('Paste the full pairing link or its 64-character code.');
  await request('/bridge/pair',{token:code,label:/iPhone/.test(navigator.userAgent)?'iPhone':/iPad/.test(navigator.userAgent)?'iPad':'Browser'});
  $('pair-code').value='';location.replace(location.pathname);
 }
 $('pair-form').addEventListener('submit',async e=>{e.preventDefault();$('pair-error').textContent='';try{await pair($('pair-code').value);}catch(error){$('pair-error').textContent=error.message;}});
 $('mobile-retry').onclick=()=>location.reload();
 function db(){return new Promise((resolve,reject)=>{const q=indexedDB.open('reel-anatomy-phone',1);q.onupgradeneeded=()=>q.result.createObjectStore('briefs',{keyPath:'id'});q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(Error('Offline storage is unavailable'));});}
 async function stored(action,value){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('briefs',action==='list'?'readonly':'readwrite');const store=tx.objectStore('briefs');const q=action==='list'?store.getAll():action==='save'?store.put(value):action==='delete'?store.delete(value):store.clear();let result;q.onsuccess=()=>result=q.result;tx.oncomplete=()=>{d.close();resolve(result);};tx.onerror=()=>{d.close();reject(Error('Could not save offline brief'));};});}
 async function renderOffline(){
  const briefs=await stored('list');$('offline-briefs').innerHTML=briefs.length?briefs.map(b=>'<article class="offline-card"><strong>'+escape(b.title)+'</strong><small>Saved '+escape(new Date(b.saved).toLocaleString())+' Â· brief v'+escape(b.revision)+'</small><button class="outline-button" data-view="'+escape(b.id)+'">Open filming brief</button><button class="outline-button" data-remove="'+escape(b.id)+'">Remove copy</button></article>').join(''):'<p>No offline copies yet. Open a brief in Studio, then choose Save open filming brief on this phone.</p>';
  $('offline-briefs').querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{const item=briefs.find(x=>x.id===b.dataset.view);const viewer=document.createElement('dialog');viewer.className='brief-viewer';const close=document.createElement('button');close.className='outline-button';close.textContent='Close filming brief';close.onclick=()=>viewer.remove();const frame=document.createElement('iframe');frame.title=item.title;frame.setAttribute('sandbox','');frame.srcdoc=item.html;viewer.append(close,frame);document.body.append(viewer);viewer.showModal();});
  $('offline-briefs').querySelectorAll('[data-remove]').forEach(b=>b.onclick=async()=>{await stored('delete',b.dataset.remove);await renderOffline();});
 }
 async function menu(){
  $('desktop-phone-controls').hidden=remote;$('phone-controls').hidden=!remote;
  if(!dialog.open)dialog.showModal();await renderOffline();
  if(remote){try{const s=await request('/bridge/session');message(s.paired?(s.desktop_online?'Paired. Desktop online.':'Paired. Desktop offline. Saved briefs remain available.'):'This device is not paired.');}catch{message('Offline. Saved filming copies are available.');}}
  else{const s=await request('/api/mobile/status');message((s.connected?'Phone relay connected. ':s.enabled?'Connecting to phone relay. ':s.configured?'Phone relay ready to pair. ':'No relay configured. See MOBILE.md. ')+s.notice);await devices();}
 }
 async function devices(){const result=await request('/api/mobile/devices');$('mobile-devices').innerHTML='<h3>Paired devices</h3>'+(result.devices.length?result.devices.map(d=>'<p>'+escape(d.label)+' <button class="outline-button" data-revoke="'+escape(d.id)+'">Revoke</button></p>').join(''):'<p>None paired.</p>');$('mobile-devices').querySelectorAll('[data-revoke]').forEach(b=>b.onclick=async()=>{try{await request('/api/mobile/revoke',{id:b.dataset.revoke});await devices();}catch(e){message(e.message);}});}
 menuButton.onclick=()=>menu().catch(e=>message(e.message));$('mobile-close').onclick=()=>dialog.close();
 $('mobile-offline').onclick=$('mobile-install-help').onclick=()=>menu().catch(e=>message(e.message));
 $('mobile-new-link').onclick=async()=>{try{const r=await request('/api/mobile/pair',{});$('mobile-pair-result').innerHTML='<label>Private one-time link<textarea id="desktop-pair-link" rows="3" readonly>'+escape(r.url)+'</textarea></label><button id="copy-pair-link" class="outline-button">Copy link</button><p>Expires '+escape(new Date(r.expires).toLocaleTimeString())+'. Share only with your own device.</p>';$('copy-pair-link').onclick=()=>navigator.clipboard.writeText(r.url).then(()=>message('Pairing link copied.')).catch(()=>{$('desktop-pair-link').select();message('Select and copy the link.');});message('Phone connection enabled while this app is running.');}catch(e){message(e.message);}};
 $('mobile-disable').onclick=async()=>{if(!confirm('Revoke every paired phone and disable the relay?'))return;try{await request('/api/mobile/disable',{});$('mobile-pair-result').textContent='';message('All phones revoked. Mobile connection disabled.');await devices();}catch(e){message(e.message);}};
 $('mobile-forget').onclick=async()=>{if(!confirm('Forget this pairing and remove all offline copies from this device?'))return;try{await request('/bridge/logout',{});await stored('clear');location.reload();}catch(e){message('Could not revoke the session online. Revoke this device from desktop Settings. '+e.message);}};
 $('mobile-save-brief').onclick=async()=>{try{const b=window.StudioUI?.mobileBrief?.();if(!b)throw Error('Open a filming brief in Studio first.');await stored('save',{...b,saved:Date.now()});await renderOffline();message('Saved on this device for offline filming.');if(navigator.storage?.persist)navigator.storage.persist().catch(()=>{});}catch(e){message(e.message);}};
 // Requests are sent once. A lost response is not permission to repeat a mutation.
 async function upload(path,form){
  const file=form.get('video');if(!(file instanceof File))throw Error('Choose a video file');
  let metadata=path==='/api/studio/import'?JSON.parse(form.get('metadata')||'{}'):{workspace:'default',collection:'draft',platform:'instagram',distribution:'unknown',rights_confirmed:false};
  if(path==='/api/analyze'){if(!confirm('Confirm you own this footage or have permission to process it on your desktop.'))throw Error('Upload cancelled');metadata.rights_confirmed=true;}
  let job;const start=await request('/api/mobile/upload/start',{filename:file.name,size:file.size,metadata,transcript:String(form.get('transcript')||'')});
  const chunkSize=1024*1024;banner.hidden=false;
  try{for(let offset=0;offset<file.size;offset+=chunkSize){banner.textContent='Sending '+file.name+' to desktop: '+Math.round(offset/file.size*100)+'%. Keep this app in the foreground.';
    const r=await clientFetch('/api/mobile/upload/chunk/'+start.id+'?offset='+offset,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file.slice(offset,offset+chunkSize)});
    if(!r.ok){const e=await r.json();throw Error(e.error||'Upload interrupted');}
   }
   job=await request('/api/mobile/upload/finish/'+start.id,{});
   if(path==='/api/studio/import')return new Response(JSON.stringify(job),{status:202,headers:{'Content-Type':'application/json'}});
   banner.textContent='Video received. The desktop is analysing it; the queue continues even if this page closes.';
   for(let i=0;i<300;i++){const r=await request('/api/studio/jobs');const j=r.jobs.find(x=>x.id===job.id);if(j?.status==='complete'){const project=await request('/api/project/'+j.result.asset_id);return new Response(JSON.stringify(project),{status:200,headers:{'Content-Type':'application/json'}});}if(j&&['failed','cancelled','paused'].includes(j.status))throw Error(j.error||'Job needs attention in Library');await sleep(2000);}
   throw Error('Analysis is still queued. Open Library to inspect progress; do not upload the same file again.');
  }finally{banner.hidden=true;}
 }
 if(remote){window.fetch=async(input,options={})=>{const path=typeof input==='string'?input:'';
   if((path==='/api/analyze'||path==='/api/studio/import')&&options.body instanceof FormData)return upload(path,options.body);
   return clientFetch(input,options);
  };initRemote();
  document.querySelector('.privacy small').textContent='Analysis runs on your paired desktop. Phone requests use an authenticated HTTPS relay.';
 }
 window.MobileUI={remote,menu,saveOffline:stored,refresh:initRemote};
 if('serviceWorker' in navigator&&remote){const wasControlled=!!navigator.serviceWorker.controller;navigator.serviceWorker.register('/sw.js').then(reg=>{
  const offer=()=>{if(reg.waiting){banner.hidden=false;banner.innerHTML='An app update is ready. Save edits first. <button id="apply-mobile-update">Reload with update</button>';$('apply-mobile-update').onclick=()=>{reg.waiting.postMessage({type:'ACTIVATE'});};}};
  offer();reg.addEventListener('updatefound',()=>reg.installing?.addEventListener('statechange',offer));
 }).catch(()=>{});let refreshed=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(wasControlled&&!refreshed){refreshed=true;location.reload();}});}
 window.addEventListener('offline',()=>{if(remote){banner.hidden=false;banner.textContent='Phone offline. Live changes are not saved or queued. Use Phone & offline for saved filming briefs.';}});
 window.addEventListener('online',()=>{if(remote){banner.hidden=false;banner.textContent='Connection restored. Save local edits or reload to refresh the studio.';}});
})();

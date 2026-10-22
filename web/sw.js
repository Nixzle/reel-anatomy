const CACHE='reel-anatomy-shell-0.3.0';
const SHELL=['/','/web/style.css','/web/app.js','/web/studio.css','/web/studio.js','/web/mobile.css','/web/mobile.js','/manifest.webmanifest','/icons/icon-180.png','/icons/icon-192.png','/icons/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('reel-anatomy-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('message',e=>{if(e.data?.type==='ACTIVATE')self.skipWaiting();});
self.addEventListener('fetch',event=>{
 const u=new URL(event.request.url);
 if(event.request.method!=='GET'||u.origin!==location.origin||/^\/(api|bridge|media|thumb)\//.test(u.pathname))return;
 if(!SHELL.includes(u.pathname))return;
 event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put(u.pathname,copy)));}return response;}).catch(()=>caches.match(u.pathname).then(r=>r||Response.error())));
});

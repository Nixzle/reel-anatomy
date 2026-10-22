// Owner-scoped HTTPS relay. Private media is transient, not written to cloud storage.
// The desktop initiates outbound polling. No public LAN port, tunnel or remote shell.
const enc = new TextEncoder();
const MAX_BODY = 2 * 1024 * 1024;
const SESSION_MS = 30 * 86400000;
const sha = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');
const token = () => [...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');
const json = (value,status=200,extra={}) => Response.json(value,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff',...extra}});
const cookieName='__Host-ra_session';
function cookie(req){return (req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1)||'';}
const same = (a,b) => { if(a.length!==b.length)return false; let out=0;for(let i=0;i<a.length;i++)out|=a.charCodeAt(i)^b.charCodeAt(i);return out===0; };
const b64 = bytes => {let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);};
const unb64 = text => Uint8Array.from(atob(text),x=>x.charCodeAt(0));
async function bounded(req,max=MAX_BODY){
 if(Number(req.headers.get('content-length')||0)>max)throw new Error('too_large');
 if(!req.body)return new Uint8Array();const r=req.body.getReader(),chunks=[];let n=0;
 for(;;){const {done,value}=await r.read();if(done)break;n+=value.length;if(n>max){await r.cancel();throw new Error('too_large');}chunks.push(value);}
 const result=new Uint8Array(n);let at=0;for(const c of chunks){result.set(c,at);at+=c.length;}return result;
}
export function allowed(method,path){
 const u=new URL(path,'http://local');if(u.origin!=='http://local'||path.length>3000||/%(2f|5c|2e)/i.test(u.pathname)||path.includes('\\'))return false;
 if(method==='GET')return /^\/api\/(health|projects|project\/[a-f0-9]{32})$/.test(u.pathname)||/^\/api\/studio\/(bootstrap|library|post|jobs|patterns|plans|results|export|models)$/.test(u.pathname)||/^\/(media\/[a-f0-9]{32}|thumb\/[a-f0-9]{32}\/\d{1,3})$/.test(u.pathname)||/^\/api\/mobile\/upload\/[a-f0-9]{32}$/.test(u.pathname);
 if(method==='POST')return u.pathname==='/api/save'||/^\/api\/studio\/(research|link|metadata|snapshot|queue|semantic|apply-semantic|plan|save-plan|review|experiment|update-experiment|import-snapshots|import-metadata|enrich-plan)$/.test(u.pathname)||/^\/api\/mobile\/upload\/(start|chunk\/[a-f0-9]{32}|finish\/[a-f0-9]{32})$/.test(u.pathname);
 return false;
}
export class StudioRelay {
 constructor(ctx,env){this.ctx=ctx;this.env=env;this.pending=new Map();this.poll=null;this.lastSeen=0;this.rate={at:0,n:0};this.pairRate={at:0,n:0};}
 async authenticated(req){const c=cookie(req);if(!/^[a-f0-9]{64}$/.test(c))return null;const h=await sha(c),s=await this.ctx.storage.get('session:'+h);if(!s||s.until<Date.now())return null;return {hash:h,...s};}
 async bridgeAuth(req){const t=(req.headers.get('authorization')||'').replace(/^Bearer /,'');return /^[a-f0-9]{64}$/.test(t)&&typeof this.env.BRIDGE_SECRET==='string'&&same(await sha(t),await sha(this.env.BRIDGE_SECRET));}
 clearPending(message){for(const [id,p] of this.pending){clearTimeout(p.timer);p.resolve(json({error:message,operation_id:id,outcome:p.sent&&p.method==='POST'?'unknown':'not_dispatched'},503));}this.pending.clear();}
 async fetch(req){
  const url=new URL(req.url),path=url.pathname;
  const origin=req.headers.get('origin');
  if((origin&&origin!==url.origin)||req.headers.get('sec-fetch-site')==='cross-site')return json({error:'Same-origin access required'},403);
  try{
   if(path.startsWith('/bridge/host/')){
    if(!await this.bridgeAuth(req))return json({error:'Desktop authentication required'},401);
    if(path==='/bridge/host/pair'&&req.method==='POST'){
     const data=JSON.parse(new TextDecoder().decode(await bounded(req,2048)));
     if(!/^[a-f0-9]{64}$/.test(data.hash))return json({error:'Invalid pairing verifier'},400);
     const expires=Date.now()+15*60000;await this.ctx.storage.put('pair',{hash:data.hash,expires});return json({expires});
    }
    if(path==='/bridge/host/devices'&&req.method==='GET'){
     const sessions=await this.ctx.storage.list({prefix:'session:'});const list=[];
     for(const [key,s] of sessions){if(s.until<Date.now()){await this.ctx.storage.delete(key);continue;}list.push({id:s.id,label:s.label,created:s.created,expires:s.until});}return json({devices:list});
    }
    if(path==='/bridge/host/revoke'&&req.method==='POST'){
     const data=JSON.parse(new TextDecoder().decode(await bounded(req,2048)));const sessions=await this.ctx.storage.list({prefix:'session:'});
     for(const [key,s] of sessions)if(data.id==='all'||s.id===data.id)await this.ctx.storage.delete(key);
     if(data.id==='all')await this.ctx.storage.delete('pair');this.clearPending('Device access changed. Reload before making another change.');return json({ok:true});
    }
    if(path==='/bridge/host/poll'&&req.method==='GET'){
     this.lastSeen=Date.now();if(this.poll)this.poll([]);
     const take=()=>[...this.pending].filter(([,p])=>!p.sent).slice(0,2).map(([id,p])=>{p.sent=true;return {id,method:p.method,path:p.path,headers:p.headers,body:p.body};});
     const ready=take();if(ready.length)return json({requests:ready});
     const result=await new Promise(resolve=>{let timer;const finish=()=>{clearTimeout(timer);if(this.poll===finish)this.poll=null;resolve(take());};this.poll=finish;timer=setTimeout(finish,20000);});return json({requests:result});
    }
    if(path==='/bridge/host/reply'&&req.method==='POST'){
     this.lastSeen=Date.now();const result=JSON.parse(new TextDecoder().decode(await bounded(req,5*1024*1024)));const p=this.pending.get(result.id);
     if(!p)return json({accepted:false});
     if(!Number.isInteger(result.status)||result.status<200||result.status>599||typeof result.body!=='string'||result.body.length>4500000)return json({error:'Invalid desktop response'},400);
     const bytes=unb64(result.body),headers={'cache-control':'no-store','x-content-type-options':'nosniff','x-reel-operation':result.id};
     for(const name of ['content-type','content-range','accept-ranges'])if(typeof result.headers?.[name]==='string')headers[name]=result.headers[name];
     this.pending.delete(result.id);clearTimeout(p.timer);p.resolve(new Response([204,304].includes(result.status)?null:bytes,{status:result.status,headers}));return json({accepted:true});
    }
    return json({error:'Unknown desktop action'},404);
   }
   if(path==='/bridge/pair'&&req.method==='POST'){
    if(!origin||origin!==url.origin)return json({error:'Open the pairing page in your browser'},403);
    const minute=Math.floor(Date.now()/60000);if(this.pairRate.at!==minute)this.pairRate={at:minute,n:0};if(++this.pairRate.n>10)return json({error:'Too many pairing attempts. Try again later.'},429);
    const data=JSON.parse(new TextDecoder().decode(await bounded(req,2048)));if(!/^[a-f0-9]{64}$/.test(data.token))return json({error:'Invalid pairing link'},400);
    const incoming=await sha(data.token),secret=token(),hash=await sha(secret);
    const outcome=await this.ctx.storage.transaction(async tx=>{const pair=await tx.get('pair');if(!pair||pair.expires<Date.now()||!same(pair.hash,incoming))return false;
     const sessions=await tx.list({prefix:'session:'});let count=0;for(const [key,s]of sessions){if(s.until<Date.now())await tx.delete(key);else count++;}if(count>=10)throw Error('device_limit');
     await tx.delete('pair');await tx.put('session:'+hash,{id:crypto.randomUUID(),label:String(data.label||'Paired browser').slice(0,80),created:Date.now(),until:Date.now()+SESSION_MS});return true;});
    if(!outcome)return json({error:'Pairing link expired or already used. Generate a new link in desktop Settings.'},401);
    return json({paired:true},200,{'set-cookie':cookieName+'='+secret+'; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Strict'});
   }
   const session=await this.authenticated(req);
   if(path==='/bridge/session'&&req.method==='GET')return json({paired:!!session,desktop_online:!!session&&Date.now()-this.lastSeen<45000,version:'0.3.0'});
   if(!session)return json({error:'Pair this device with your desktop first',pair_required:true},401);
   if(path==='/bridge/logout'&&req.method==='POST'){
    if(!origin)return json({error:'Same-origin access required'},403);await this.ctx.storage.delete('session:'+session.hash);
    return json({ok:true},200,{'set-cookie':cookieName+'=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict'});
   }
   if(!allowed(req.method,path+url.search))return json({error:'This desktop action is not available remotely'},403);
   if(req.method==='POST'&&(!origin||req.headers.get('x-reel-client')!=='pwa-v1'))return json({error:'App request required'},403);
   if(Date.now()-this.lastSeen>45000)return json({error:'Your desktop is offline. Open Reel Anatomy on the computer. Saved filming briefs remain available on this phone.',desktop_offline:true},503);
   const minute=Math.floor(Date.now()/60000);if(this.rate.at!==minute)this.rate={at:minute,n:0};if(++this.rate.n>600||this.pending.size>=24)return json({error:'Desktop relay is busy. Try again after current work completes.'},429);
   const body=b64(await bounded(req));const id=crypto.randomUUID();const headers={};
   for(const name of ['content-type','range'])if(req.headers.has(name))headers[name]=req.headers.get(name);
   return await new Promise(resolve=>{
    const entry={method:req.method,path:path+url.search,body,headers,sent:false,resolve};
    entry.timer=setTimeout(()=>{if(this.pending.delete(id))resolve(json({error:req.method==='POST'&&entry.sent?'The desktop did not confirm this change. Reload the library or queue before retrying; the operation may already have completed.':'Desktop did not respond. No automatic retry was made.',operation_id:id,outcome:entry.sent?'unknown':'not_dispatched'},504));},55000);
    this.pending.set(id,entry);if(this.poll)this.poll();
   });
  }catch(error){return json({error:error.message==='too_large'?'Transfer chunk exceeds the relay limit':error.message==='device_limit'?'Ten devices are already paired. Revoke one in desktop Settings.':'Invalid relay request'},error.message==='too_large'?413:400);}
 }
}
const security={
 'x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY',
 'permissions-policy':'camera=(self), microphone=(), geolocation=()',
 'content-security-policy':"default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; frame-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
};
export default {async fetch(req,env){
 const url=new URL(req.url);
 let response;
 if(/^\/(api|media|thumb|bridge)\//.test(url.pathname)){
  if(!env.BRIDGE_SECRET)return json({error:'Desktop relay has not been configured'},503);
  response=await env.RELAY.getByName('owner').fetch(req);
 }else{
  response=await env.ASSETS.fetch(req);
 }
 const headers=new Headers(response.headers);for(const [k,v]of Object.entries(security))headers.set(k,v);
 if(url.pathname==='/sw.js')headers.set('cache-control','no-cache');
 return new Response(response.body,{status:response.status,headers});
}};

// Exercise the exact generated service worker with controlled public assets and caches.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const root=path.resolve('phone-dist'),source=fs.readFileSync(path.join(root,'sw.js'),'utf8');
function harness(corrupt=false){
 const events={},stores=new Map([['reel-phone-previous-qualified',new Map([['sentinel',new Response('previous app')]])]]);
 const cacheFor=name=>({put:async(req,res)=>stores.get(name).set(req.url||String(req),res.clone()),match:async(req)=>stores.get(name).get(req.url||String(req))?.clone()});
 const caches={open:async name=>{if(!stores.has(name))stores.set(name,new Map());return cacheFor(name);},delete:async name=>stores.delete(name),keys:async()=>[...stores.keys()]};
 const sandbox={self:{registration:{scope:'https://example.org/reel/'},location:{origin:'https://example.org'},clients:{claim:async()=>{}},addEventListener:(name,handler)=>events[name]=handler},caches,Request,Response,URL,TextDecoder,Uint8Array,crypto:webcrypto,
  fetch:async req=>{const u=new URL(req.url||req);let name=u.pathname.slice('/reel/'.length)||'index.html';if(name.includes('..'))return new Response('',{status:400});let data=fs.readFileSync(path.join(root,name));if(corrupt&&name==='web/style.css')data=Buffer.concat([data,Buffer.from('\n/* unqualified bytes */')]);return new Response(data,{status:200});}};
 vm.runInNewContext(source,sandbox,{timeout:2000});return {events,stores};
}
const bad=harness(true);let installation;bad.events.install({waitUntil:p=>installation=p});await assert.rejects(installation,/checksum/);assert.deepEqual([...bad.stores.keys()],['reel-phone-previous-qualified']);console.log('PASS changed application bytes reject candidate installation and preserve the prior cache');
const good=harness();good.events.install({waitUntil:p=>installation=p});await installation;assert.equal(good.stores.size,2);console.log('PASS every generated precache entry verifies before installation succeeds');
let responded=false;good.events.fetch({request:new Request('https://example.org/reel/api/private-library'),respondWith:()=>{responded=true;}});assert.equal(responded,false);console.log('PASS private API routes are outside static offline interception');
let activation;good.events.activate({waitUntil:p=>activation=p});await activation;assert.equal(good.stores.size,1);assert.ok(!good.stores.has('reel-phone-previous-qualified'));console.log('PASS old cache cleanup occurs only during activation of the qualified replacement');
console.log('SERVICE_WORKER_CHECKS=4');

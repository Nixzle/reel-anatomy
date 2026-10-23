// Isolated browser acceptance for the standalone app. No accounts or relay.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawn,spawnSync} from 'node:child_process';
const root=process.cwd(),run=path.join(root,'.local','readiness-live-'+Date.now());fs.mkdirSync(run,{recursive:true});
const origin=process.env.RA_PHONE_ORIGIN||'http://127.0.0.1:18930/reel-anatomy/';
const profile=path.join(run,'chrome');fs.mkdirSync(profile);
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','pipe','pipe']});
const log=fs.createWriteStream(path.join(run,'chrome.log'));chrome.stdout.pipe(log);chrome.stderr.pipe(log);
let ws,session,id=0;const pending=new Map(),errors=[],requests=[],checks=[];
const delay=ms=>new Promise(r=>setTimeout(r,ms));const pause=delay;
async function until(fn,label,limit=60000){const end=Date.now()+limit;while(Date.now()<end){const result=await fn();if(result)return result;await delay(150);}throw Error('Timed out: '+label);}
function send(method,params={},sid=session){return new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(Error('CDP timeout '+method));},60000);pending.set(n,{resolve,reject,timer});ws.send(JSON.stringify({id:n,method,params,...(sid?{sessionId:sid}:{})}));});}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value;}
const pass=(name,detail=true)=>{checks.push({name,detail});console.log('PASS',name,JSON.stringify(detail));};
async function shot(name){const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(run,name+'.png'),Buffer.from(r.data,'base64'));}
async function click(selector){return evaluate('document.querySelector('+JSON.stringify(selector)+').click()');}
async function input(selector,value){return evaluate('(()=>{const e=document.querySelector('+JSON.stringify(selector)+');e.value='+JSON.stringify(value)+';e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}));})()');}
async function files(selector,list){const doc=await send('DOM.getDocument');const n=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector});await send('DOM.setFileInputFiles',{nodeId:n.nodeId,files:list});}
const py=path.join(root,'.venv','Scripts','python.exe');
const ff=spawnSync(py,['-c','import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())'],{encoding:'utf8'}).stdout.trim();
const video=path.join(run,'synthetic-reel.mp4');
const made=spawnSync(ff,['-hide_banner','-loglevel','error','-f','lavfi','-i','color=black:s=320x180:r=25:d=2','-f','lavfi','-i','color=white:s=320x180:r=25:d=2','-i',path.join(root,'tests','fixtures','speech.wav'),'-filter_complex','[0:v][1:v]concat=n=2:v=1:a=0[out]','-map','[out]','-map','2:a','-c:v','libx264','-threads','2','-pix_fmt','yuv420p','-c:a','aac','-shortest','-y',video],{encoding:'utf8',timeout:30000});
assert.equal(made.status,0,made.stderr);
const post=async(route,data)=>evaluate('PhoneLocal.api('+JSON.stringify('/api/studio/'+route)+',{method:"POST",body:'+JSON.stringify(JSON.stringify(data))+'})');
const read=async route=>evaluate('PhoneLocal.api('+JSON.stringify('/api/studio/'+route)+')');
const formInput=(form,name,value)=>input('#'+form+' [name="'+name+'"]',value);
const localDate=date=>new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,19);

try{
 await until(()=>fs.existsSync(path.join(profile,'DevToolsActivePort')),'Chrome');
 const [port,route]=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').trim().split('\n');ws=new WebSocket('ws://127.0.0.1:'+port+route);
 await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});
 ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);else if(m.method==='Network.requestWillBeSent')requests.push({url:m.params.request.url,method:m.params.request.method});else if(m.method==='Page.javascriptDialogOpening')void send('Page.handleJavaScriptDialog',{accept:true},m.sessionId);});
 const context=(await send('Target.createBrowserContext',{},null)).browserContextId;
 const target=(await send('Target.createTarget',{url:'about:blank',browserContextId:context},null)).targetId;
 session=(await send('Target.attachToTarget',{targetId:target,flatten:true},null)).sessionId;
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Log.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await send('Page.navigate',{url:origin});
 await until(async()=>{const s=await evaluate('({done:document.getElementById("boot")?.hidden,text:document.getElementById("boot-status")?.textContent})');if(s?.text?.includes('No library was erased'))throw Error(s.text);return s?.done;},'on-device Python');
 await until(()=>evaluate('document.getElementById("research-select")?.options.length>0'),'research UI');


 await until(()=>evaluate('!!window.ReleaseDesk'),'release services');
 const result=await evaluate(`(async()=>{const {readAvailableArticle}=await import(new URL('./article_reader.mjs',location.href).href);const output=[];for(const source of [{title:'Social media',url:'https://en.wikipedia.org/wiki/Social_media',kind:'web',tags:[]},{title:'Europe PMC database description',url:'https://europepmc.org/articles/PMC4383902',kind:'paper',tags:[]}]){const start=performance.now();try{const item=await readAvailableArticle(source);output.push({url:item.url,title:item.title,characters:item.content.length,level:item.level,reviewed:item.reviewed,provenance:item.provenance,milliseconds:Math.round(performance.now()-start)});}catch(e){output.push({url:source.url,error:e.message});}}return output;})()`);
 console.log('ACTUAL_FULL_TEXT',JSON.stringify(result));
 assert.ok(result.every(x=>x.level==='full_text'&&x.reviewed===false&&x.characters>1000),JSON.stringify(result));pass('actual browser full-text routes return attributed text without claiming user review',result);
 assert.equal(errors.length,0,JSON.stringify(errors));assert.ok(requests.every(r=>r.method==='GET'));assert.ok(!requests.some(r=>/huggingface|\.hf\.co/.test(r.url)));pass('full-text checks make no cloud-model call or private-content upload');
 fs.writeFileSync(path.join(run,'result.json'),JSON.stringify({passed:true,checks,errors,requests,full_text:result},null,2));fs.writeFileSync(path.join(root,'.local/v1-readiness-20261023/live-latest.json'),JSON.stringify({run,checks:checks.length,passed:true},null,2));console.log('READINESS_LIVE_EVIDENCE='+run);
}catch(error){try{await shot('failure');console.error('PAGE',await evaluate('document.body.innerText.slice(-3500)'));}catch{}fs.writeFileSync(path.join(run,'result.json'),JSON.stringify({passed:false,error:String(error),checks,errors,requests},null,2));console.error(error);process.exitCode=1;}finally{try{await send('Browser.close',{},null);}catch{}ws?.close();chrome.kill();for(const p of pending.values())clearTimeout(p.timer);}

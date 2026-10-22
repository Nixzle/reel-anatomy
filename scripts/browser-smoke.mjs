// Uses installed Chrome and Node's WebSocket. No browser/package installer.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
const root=process.cwd(), run=path.join(root,'.local','browser-'+Date.now());
fs.mkdirSync(run,{recursive:true});
const checks=[],errors=[],network=[],pending=new Map();let socket,session,id=0;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const pass=(name,detail=true)=>{checks.push({name,detail});console.log('PASS '+name);};
async function until(fn,label,limit=90000){const end=Date.now()+limit;while(Date.now()<end){const x=await fn();if(x)return x;await pause(150);}throw Error('Timed out: '+label);}
const py=path.join(root,'.venv','Scripts','python.exe');
const ff=process.env.RA_TEST_FFMPEG||spawnSync(py,['-c','import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())'],{encoding:'utf8'}).stdout.trim();
const video=path.join(run,'synthetic-reel.mp4');
const made=spawnSync(ff,['-hide_banner','-loglevel','error','-f','lavfi','-i','color=black:s=320x180:r=25:d=2','-f','lavfi','-i','color=white:s=320x180:r=25:d=2','-i',path.join(root,'tests','fixtures','speech.wav'),'-filter_complex','[0:v][1:v]concat=n=2:v=1:a=0[out]','-map','[out]','-map','2:a','-c:v','libx264','-threads','2','-pix_fmt','yuv420p','-c:a','aac','-shortest','-y',video],{encoding:'utf8',timeout:30000});
assert.equal(made.status,0,made.stderr);
const origin='http://127.0.0.1:18867';
const exe=process.env.RA_TEST_EXE||py;
const args=process.env.RA_TEST_EXE?[]:['app.py'];
const app=spawn(exe,args,{cwd:root,env:{...process.env,REEL_ANATOMY_HOME:path.join(run,'data'),REEL_ANATOMY_PORT:'18867',REEL_ANATOMY_NO_BROWSER:'1',HF_HUB_OFFLINE:'1'},stdio:['ignore','pipe','pipe']});
const appLog=fs.createWriteStream(path.join(run,'app.log'));app.stdout.pipe(appLog);app.stderr.pipe(appLog);
const chrome='C:/Program Files/Google/Chrome/Application/chrome.exe';assert.ok(fs.existsSync(chrome));
const profile=path.join(run,'chrome');fs.mkdirSync(profile);
const child=spawn(chrome,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','pipe','pipe']});
const log=fs.createWriteStream(path.join(run,'chrome.log'));child.stdout.pipe(log);child.stderr.pipe(log);
function send(method,params={},sid=session){return new Promise((resolve,reject)=>{const n=++id;const timer=setTimeout(()=>{pending.delete(n);reject(Error('CDP timeout: '+method));},15000);pending.set(n,{resolve,reject,timer});socket.send(JSON.stringify({id:n,method,params,...(sid?{sessionId:sid}:{})}));});}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value;}
async function shot(name){const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(run,name+'.png'),Buffer.from(r.data,'base64'));}
async function click(selector){await evaluate('document.querySelector('+JSON.stringify(selector)+').click()');}
async function input(selector,value){await evaluate('(()=>{const e=document.querySelector('+JSON.stringify(selector)+');e.value='+JSON.stringify(value)+';e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}));})()');}
async function files(selector,list){const doc=await send('DOM.getDocument');const n=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector});await send('DOM.setFileInputFiles',{nodeId:n.nodeId,files:list});}
try{
 await until(async()=>{try{return (await(await fetch(origin+'/api/health')).json()).ok;}catch{return false;}},'app health');
 const portFile=path.join(profile,'DevToolsActivePort');await until(()=>fs.existsSync(portFile),'Chrome endpoint');
 const [port,route]=fs.readFileSync(portFile,'utf8').trim().split('\n');socket=new WebSocket('ws://127.0.0.1:'+port+route);
 await new Promise((r,j)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',j,{once:true});});
 socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);else if(m.method==='Network.requestWillBeSent')network.push(m.params.request.url);else if(m.method==='Page.javascriptDialogOpening')void send('Page.handleJavaScriptDialog',{accept:true},m.sessionId);});
 const context=(await send('Target.createBrowserContext',{},null)).browserContextId;
 const target=(await send('Target.createTarget',{url:'about:blank',browserContextId:context},null)).targetId;
 session=(await send('Target.attachToTarget',{targetId:target,flatten:true},null)).sessionId;
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1050,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:origin});await until(()=>evaluate('document.getElementById("system-status")?.textContent.includes("ONLINE")'),'UI ready');
 await shot('desktop-home');pass('fresh user starts without account or key');
 await files('#video-file',[video]);await click('#analyze-button');
 await until(()=>evaluate('!document.getElementById("analysis-view").hidden'),'video analysed');
 assert.ok((await evaluate('document.getElementById("sentence-rows").textContent+Array.from(document.querySelectorAll(".row-text")).map(x=>x.value).join(" ")')).toLowerCase().includes('stop making this mistake'));
 assert.equal(await evaluate('document.querySelectorAll(".shot-card").length'),2);pass('upload produces real speech and two actual shot intervals');
 await until(()=>evaluate('document.querySelectorAll(".shot-card img").length===2 && [...document.querySelectorAll(".shot-card img")].every(x=>x.complete && x.naturalWidth>0)'),'thumbnails loaded');pass('both frame thumbnails load');
 await shot('desktop-analysis');
 await input('.row-text','Reviewed synthetic sentence.');await input('.role-select','Hook');await click('#save-button');
 await until(()=>evaluate('document.getElementById("save-indicator").textContent==="SAVED LOCALLY"'),'saved');
 const first=(await(await fetch(origin+'/api/projects')).json())[0];const saved=await(await fetch(origin+'/api/project/'+first.id)).json();
 assert.equal(saved.segments[0].text,'Reviewed synthetic sentence.');assert.equal(saved.segments[0].role,'Hook');pass('text and role corrections persist');
 await evaluate('document.querySelectorAll(".time-button")[1].click()');await until(()=>evaluate('document.getElementById("player").currentTime>2'),'seek');pass('sentence selection seeks video');
 const downloads=path.join(run,'downloads');fs.mkdirSync(downloads);await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads,browserContextId:context},null);
 await click('#export-json');await click('#export-csv');await click('#export-report');
 await until(()=>fs.readdirSync(downloads).filter(x=>/\.(json|csv|md)$/.test(x)).length===3,'exports');
 const report=fs.readdirSync(downloads).find(x=>x.endsWith('.md'));assert.ok(fs.readFileSync(path.join(downloads,report),'utf8').includes('rule-based'));pass('JSON CSV and readable report downloads');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await evaluate('window.scrollTo(0,0)');await pause(200);
 assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);await shot('mobile-analysis');pass('390px analysis has no horizontal overflow');
 await click('#new-project');const a=path.join(run,'batch-one.mp4'),b=path.join(run,'batch-two.mp4');fs.copyFileSync(video,a);fs.copyFileSync(video,b);
 await files('#video-file',[a,b]);await click('#analyze-button');await until(async()=>{const p=await(await fetch(origin+'/api/projects')).json();return p.length===3;},'batch complete');
 await until(()=>evaluate('!document.getElementById("analysis-view").hidden'),'batch report');pass('batch upload saves two distinct projects');
 const csv=path.join(run,'metrics.csv');fs.writeFileSync(csv,'title,views,likes,saves,shares,comments\nbatch-one,100,2,1,1,1\nbatch-two,100,,,,\n');await files('#import-metrics',[csv]);
 await until(()=>evaluate('document.getElementById("toast").textContent.includes("Metrics imported for 2")'),'metric import');
 const table=await evaluate('document.getElementById("comparison-table").textContent');assert.ok(table.includes('5.00%'));assert.ok(table.includes('—'));pass('CSV metrics calculate complete ratios and preserve missing values');
 await click('#export-comparison');await until(()=>fs.existsSync(path.join(downloads,'reel-anatomy-comparison.csv')),'comparison export');pass('cross-video comparison export');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await evaluate('document.querySelector(".comparison").scrollIntoView()');await pause(200);
 assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);await shot('mobile-comparison');pass('comparison fits narrow viewport');
 assert.equal(errors.length,0,JSON.stringify(errors));pass('no uncaught browser exceptions');
 assert.ok(network.every(u=>u.startsWith('data:')||u.startsWith('blob:')||u==='about:blank'||new URL(u).origin===origin),network.filter(u=>!u.startsWith('data:')).join('\n'));pass('page makes no external requests');
 fs.writeFileSync(path.join(run,'result.json'),JSON.stringify({passed:true,checks,errors,network},null,2));
 fs.writeFileSync(path.join(root,'.local','browser-latest.json'),JSON.stringify({run,passed:true,count:checks.length},null,2));
 console.log('BROWSER_CHECKS='+checks.length+' EVIDENCE='+run);
}catch(e){try{if(session)await shot('failure');}catch{}fs.writeFileSync(path.join(run,'result.json'),JSON.stringify({passed:false,checks,errors,error:String(e)},null,2));console.error(e);process.exitCode=1;
}finally{try{if(socket?.readyState===1)await send('Browser.close',{},null);}catch{}socket?.close();child.kill();app.kill();for(const p of pending.values())clearTimeout(p.timer);}

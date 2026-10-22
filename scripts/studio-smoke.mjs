// Uses installed Chrome and Node's WebSocket. No browser/package installer.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
const root=process.cwd(), run=path.join(root,'.local','studio-browser-'+Date.now());
fs.mkdirSync(run,{recursive:true});
const checks=[],errors=[],network=[],pending=new Map();let socket,session,id=0;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const pass=(name,detail=true)=>{checks.push({name,detail});console.log('PASS '+name);};
async function until(fn,label,limit=45000){const end=Date.now()+limit;while(Date.now()<end){const x=await fn();if(x)return x;await pause(150);}throw Error('Timed out: '+label);}
const py=path.join(root,'.venv','Scripts','python.exe');
const ff=process.env.RA_TEST_FFMPEG||spawnSync(py,['-c','import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())'],{encoding:'utf8'}).stdout.trim();
const video=path.join(run,'synthetic-reel.mp4');
const made=spawnSync(ff,['-hide_banner','-loglevel','error','-f','lavfi','-i','color=black:s=320x180:r=25:d=2','-f','lavfi','-i','color=white:s=320x180:r=25:d=2','-i',path.join(root,'tests','fixtures','speech.wav'),'-filter_complex','[0:v][1:v]concat=n=2:v=1:a=0[out]','-map','[out]','-map','2:a','-c:v','libx264','-threads','2','-pix_fmt','yuv420p','-c:a','aac','-shortest','-y',video],{encoding:'utf8',timeout:30000});
assert.equal(made.status,0,made.stderr);
const origin='http://127.0.0.1:18873';
const exe=process.env.RA_TEST_EXE||py;
const args=process.env.RA_TEST_EXE?[]:['app.py'];
const app=spawn(exe,args,{cwd:root,env:{...process.env,REEL_ANATOMY_HOME:path.join(run,'data'),REEL_ANATOMY_PORT:'18873',REEL_ANATOMY_NO_BROWSER:'1',HF_HUB_OFFLINE:'1'},stdio:['ignore','pipe','pipe']});
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

const post=async(route,data)=>{const r=await fetch(origin+'/api/studio/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const v=await r.json();assert.ok(r.ok,JSON.stringify(v));return v;};
const read=async route=>{const r=await fetch(origin+'/api/studio/'+route);const v=await r.json();assert.ok(r.ok,JSON.stringify(v));return v;};
const formInput=(form,name,value)=>input('#'+form+' [name="'+name+'"]',value);
const localDate=date=>new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,19);
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
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:origin});await until(()=>evaluate('document.getElementById("research-select")?.options.length>0'),'studio ready');
 await click('#new-research');
 for(const [name,value] of Object.entries({title:'Synthetic software research',topic:'Software demonstrations',audience:'Independent creators',objective:'Saves'}))await formInput('research-form',name,value);
 await click('#research-form .primary-button');
 await until(()=>evaluate('document.getElementById("research-select").selectedOptions[0]?.textContent==="Synthetic software research"'),'research created');
 const workspace=await evaluate('document.getElementById("research-select").value');
 pass('research project stores audience topic platform and goal');
 const one=path.join(run,'software_clip_one.mp4'),two=path.join(run,'software_clip_two.mp4');fs.copyFileSync(video,one);fs.copyFileSync(video,two);
 const captions='1\n00:00:00,000 --> 00:00:01,500\nWhy compare software openings?\n\n2\n00:00:02,000 --> 00:00:03,900\nFollow the evidence, not a promise.\n';
 const srt1=path.join(run,'software_clip_one.srt'),srt2=path.join(run,'software_clip_two.srt');fs.writeFileSync(srt1,captions);fs.writeFileSync(srt2,captions);
 await click('#queue-toggle');await until(async()=>(await read('jobs')).paused,'pause persisted');
 await files('#queue-files',[one,two]);await files('#queue-captions',[srt1,srt2]);
 await formInput('queue-form','creator','Synthetic Creator');await formInput('queue-form','cohort','software');await formInput('queue-form','distribution','organic');await click('#queue-form [name="rights_confirmed"]');await click('#queue-submit');
 await until(async()=>(await read('jobs')).jobs.length===2,'two jobs accepted');assert.ok((await read('jobs')).jobs.every(j=>j.status==='queued'));pass('batch upload enters a paused durable queue');
 await send('Page.reload',{ignoreCache:true});await until(()=>evaluate('document.getElementById("research-select")?.value==='+JSON.stringify(workspace)),'research selection survives reload');await click('[data-studio-tab="library"]');await until(()=>evaluate('document.getElementById("queue-toggle").textContent==="Resume queue"'),'pause survives reload');
 await click('#queue-toggle');await until(async()=>(await read('jobs')).jobs.every(j=>j.status==='complete'),'queued media completed');
 let posts=(await read('library?workspace='+workspace)).posts;assert.equal(posts.length,2);assert.equal(posts[0].asset_id,posts[1].asset_id);pass('identical media and matched subtitles reuse analysis without merging post records');
 const asset=await(await fetch(origin+'/api/project/'+posts[0].asset_id)).json();assert.equal(asset.segments[0].text,'Why compare software openings?');assert.equal(asset.transcript_source,'imported');pass('underscore subtitle filenames match and original timing is retained');
 await until(()=>evaluate('document.querySelectorAll("#research-posts [data-post]").length===2'),'library rendered');await shot('desktop-library');
 const first=posts[0],published=new Date(Date.now()-14*86400000),observed=new Date(published.getTime()+72*3600000);
 await click('[data-post="'+first.id+'"]');await until(()=>evaluate('document.getElementById("post-dialog").open'),'metadata dialog');
 await formInput('post-meta-form','published_at',localDate(published));await formInput('post-meta-form','source_url','https://example.com/synthetic-fixture');await click('#post-meta-form .primary-button');
 await until(async()=>Boolean((await read('post?id='+first.id)).post.published_at),'metadata saved');
 await formInput('snapshot-form','window','72h');await formInput('snapshot-form','observed_at',localDate(observed));await formInput('snapshot-form','views','100');await formInput('snapshot-form','retention_3s_pct','45.5');await formInput('snapshot-form','source','Synthetic test observation, not real social data');await click('#snapshot-form .primary-button');
 await until(async()=>(await read('post?id='+first.id)).snapshots.length===1,'snapshot appended');const snapshot=(await read('post?id='+first.id)).snapshots[0];assert.equal(snapshot.metrics.retention_3s_pct,45.5);assert.equal(snapshot.metrics.likes,undefined);pass('timed metrics retain provenance retention and unknown counts');await click('#close-post-dialog');
 await click('[data-studio-tab="patterns"]');await input('#pattern-window','72h');await click('#find-patterns');await until(()=>evaluate('document.querySelectorAll("[data-use-pattern]").length===5'),'pattern results');assert.ok((await evaluate('document.getElementById("pattern-output").textContent')).includes('insufficient matched evidence'));pass('sparse evidence is not promoted to a winning formula');await shot('desktop-patterns');
 await click('[data-use-pattern="early_demo"]');assert.equal(await evaluate('document.getElementById("brief-pattern").value'),'early_demo');
 const brief={topic:'Compare software video openings',audience:'Independent creators',goal:'Saves',promise:'Understand the opening before copying it',method:'Load two clips and inspect the first five seconds on the timeline.',proof:'This demonstration shows two synthetic test clips, not measured performance.',footage:'My own screen recording',tone:'Direct and practical',cta:'Save this comparison checklist.'};
 for(const [name,value] of Object.entries(brief))await formInput('brief-form',name,value);await click('#create-plan');await until(()=>evaluate('document.querySelectorAll(".plan-beat").length===5'),'filming plan created');
 let plan=(await read('plans?workspace='+workspace)).plans[0];assert.equal(plan.beats[3].spoken,brief.proof);assert.equal(plan.pattern_basis.feature.key,'early_demo');assert.ok(plan.limits.some(x=>x.includes('insufficient')));pass('pattern becomes an original five-beat brief with retained evidence limits');
 await input('[data-beat="0"][data-field="spoken"]','Here is our actual comparison, before the explanation.');await click('#save-plan');await until(async()=>(await read('plans?workspace='+workspace)).plans[0].revision===2,'plan edit persisted');plan=(await read('plans?workspace='+workspace)).plans[0];assert.equal(plan.history.length,1);pass('script edits preserve prior revisions');await shot('desktop-studio');
 const downloads=path.join(run,'downloads');fs.mkdirSync(downloads);await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads,browserContextId:context},null);
 await click('#export-filming-html');await click('#export-filming-md');await until(()=>fs.existsSync(path.join(downloads,'filming-brief.html'))&&fs.existsSync(path.join(downloads,'filming-brief.md')),'production exports');assert.ok(fs.readFileSync(path.join(downloads,'filming-brief.md'),'utf8').includes('Selected pattern hypothesis'));assert.ok(!fs.readFileSync(path.join(downloads,'filming-brief.html'),'utf8').includes('<script'));pass('phone filming brief and Markdown export include evidence without executable scripts');
 await click('[data-studio-tab="library"]');const draft=path.join(run,'our-draft.mp4');fs.copyFileSync(video,draft);await files('#queue-files',[draft]);await files('#queue-captions',[]);await formInput('queue-form','collection','draft');await evaluate('document.querySelector("#queue-form [name=rights_confirmed]").checked=true');await click('#queue-submit');await until(async()=>(await read('jobs')).jobs.length===3&&(await read('jobs')).jobs.every(j=>j.status==='complete'),'draft analysed');
 posts=(await read('library?workspace='+workspace)).posts;const own=posts.find(p=>p.collection==='draft');assert.ok(own);
 await click('[data-studio-tab="create"]');await until(()=>evaluate('[...document.getElementById("draft-review-post").options].some(o=>o.value==='+JSON.stringify(own.id)+')'),'draft selector');await input('#draft-review-post',own.id);await click('#draft-review-form .primary-button');await until(()=>evaluate('document.getElementById("draft-review-output").textContent.includes("Actual length")'),'rough cut review');assert.ok((await evaluate('document.getElementById("draft-review-output").textContent')).includes('planned length'));pass('rough-cut review compares actual footage with the saved brief');
 await click('[data-studio-tab="results"]');await input('#experiment-plan',plan.id);await input('#experiment-post',own.id);await formInput('experiment-form','change','Show the actual result before explaining the method.');await click('#experiment-form .primary-button');await until(async()=>(await read('results?workspace='+workspace)).experiments.length===1,'prospective test saved');
 const experiment=(await read('results?workspace='+workspace)).experiments[0];assert.equal(experiment.plan_revision,2);assert.equal(experiment.frozen_plan.beats[0].spoken,plan.beats[0].spoken);pass('prospective test freezes the chosen script and hypothesis');
 await pause(1200);await click('[data-result-post="'+own.id+'"]');await until(()=>evaluate('document.getElementById("post-dialog").open'),'own metadata');await formInput('post-meta-form','collection','own');await formInput('post-meta-form','published_at',localDate(new Date()));await click('#post-meta-form .primary-button');await until(async()=>(await read('post?id='+own.id)).post.collection==='own','publication metadata');await click('#close-post-dialog');await click('[data-publish="'+experiment.id+'"]');await until(async()=>(await read('results?workspace='+workspace)).experiments[0].status==='published','publication recorded');
 await click('[data-result-post="'+own.id+'"]');await formInput('snapshot-form','window','lifetime');await formInput('snapshot-form','observed_at',localDate(new Date()));await formInput('snapshot-form','views','10');await formInput('snapshot-form','source','Synthetic browser fixture; not a real campaign');await click('#snapshot-form .primary-button');await until(async()=>(await read('post?id='+own.id)).snapshots.length===1,'actual observation stored');await click('#close-post-dialog');
 await input('[data-assessment="'+experiment.id+'"]','Synthetic workflow check; no actual campaign improvement was measured.');await click('[data-assess="'+experiment.id+'"]');await until(async()=>(await read('results?workspace='+workspace)).experiments[0].status==='reviewed','outcome review retained');pass('published observations and outcome review retain the original hypothesis');
 await shot('desktop-results');
 await click('[data-studio-tab="settings"]');await click('#refresh-models');await until(()=>evaluate('!document.getElementById("model-status").textContent.includes("Checking")'),'local model status');assert.equal((await read('bootstrap')).model.enabled,false);pass('learned analysis remains explicitly disabled without configured model');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 for(const tab of ['library','patterns','create','results','settings']){await click('[data-studio-tab="'+tab+'"]');await pause(150);assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,'overflow in '+tab);await shot('mobile-'+tab);}pass('all five studio screens fit a 390px viewport');
 await evaluate('document.documentElement.style.setProperty("--phone-safe-top","59px");document.documentElement.style.setProperty("--phone-safe-bottom","34px");window.scrollTo(0,0)');await pause(200);
 const g=await evaluate('({top:document.querySelector(".brand").getBoundingClientRect().top,bottom:document.querySelector(".workspace-tabs button").getBoundingClientRect().bottom,height:innerHeight})');assert.ok(g.top>=59,JSON.stringify(g));assert.ok(g.bottom<=g.height-34,JSON.stringify(g));await shot('iphone-safe-areas');pass('simulated Dynamic Island and home indicator do not cover controls');
 await send('Page.reload',{ignoreCache:true});await until(()=>evaluate('document.getElementById("research-select")?.value==='+JSON.stringify(workspace)),'state after reload');assert.equal((await read('plans?workspace='+workspace)).plans[0].revision,2);assert.equal((await read('results?workspace='+workspace)).experiments[0].status,'reviewed');pass('library brief and outcome survive a browser restart');
 assert.equal(errors.length,0,JSON.stringify(errors));pass('no uncaught browser exceptions');
 assert.ok(network.every(u=>u.startsWith('data:')||u.startsWith('blob:')||u==='about:blank'||new URL(u).origin===origin),network.filter(u=>!u.startsWith('data:')).join('\n'));pass('research workflow makes no external browser requests');
 await send('Page.navigate',{url:'file:///'+path.join(downloads,'filming-brief.html').replaceAll('\\','/')});await until(()=>evaluate('document.title.includes("Filming brief")'),'offline filming brief');assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);await shot('phone-filming-brief');pass('exported filming brief opens offline at phone width');
 fs.writeFileSync(path.join(run,'result.json'),JSON.stringify({passed:true,checks,errors},null,2));fs.writeFileSync(path.join(root,'.local','studio-browser-latest.json'),JSON.stringify({run,passed:true,count:checks.length},null,2));console.log('STUDIO_BROWSER_CHECKS='+checks.length+' EVIDENCE='+run);
}catch(e){try{if(session)await shot('failure');}catch{}fs.writeFileSync(path.join(run,'result.json'),JSON.stringify({passed:false,checks,errors,error:String(e)},null,2));console.error(e);process.exitCode=1;
}finally{try{if(socket?.readyState===1)await send('Browser.close',{},null);}catch{}socket?.close();child.kill();app.kill();for(const p of pending.values())clearTimeout(p.timer);}

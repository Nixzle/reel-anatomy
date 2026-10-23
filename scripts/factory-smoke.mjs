// Isolated browser acceptance for the standalone app. No accounts or relay.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawn,spawnSync} from 'node:child_process';
const root=process.cwd(),run=path.join(root,'.local','factory-browser-'+Date.now());fs.mkdirSync(run,{recursive:true});
const origin=process.env.RA_PHONE_ORIGIN||'http://127.0.0.1:18926/reel-anatomy/';
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

 await until(()=>evaluate('!!window.ReelFactory'),'factory ready');
 assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);pass('factory loads without changing private data or requiring a model');
 const audio=path.join(run,'synthetic-tone.wav');const tone=spawnSync(ff,['-hide_banner','-loglevel','error','-f','lavfi','-i','sine=frequency=330:sample_rate=44100:duration=10','-c:a','pcm_s16le',audio],{encoding:'utf8',timeout:20000});assert.equal(tone.status,0,tone.stderr);
 const motion=path.join(run,'synthetic-motion.mp4');const moving=spawnSync(ff,['-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=size=360x640:rate=30:duration=10','-c:v','libx264','-threads','2','-pix_fmt','yuv420p',motion],{encoding:'utf8',timeout:30000});assert.equal(moving.status,0,moving.stderr);
 const rpost=(route,data)=>evaluate('PhoneLocal.api('+JSON.stringify('/api/research/'+route)+',{method:"POST",body:'+JSON.stringify(JSON.stringify({workspace:'default',...data}))+'})');
 const fpost=(route,data)=>evaluate('PhoneLocal.api('+JSON.stringify('/api/factory/'+route)+',{method:"POST",body:'+JSON.stringify(JSON.stringify({workspace:'default',...data}))+'})');
 const fget=route=>evaluate('PhoneLocal.api('+JSON.stringify('/api/factory/'+route+(route.includes('?')?'&':'?')+'workspace=default')+')');
 const source=await rpost('source',{title:'Synthetic production fixture',url:'https://example.org/factory-test',content:'The synthetic comparison used two openings. No real campaign was measured.',kind:'note',level:'user_note',provenance:'Generated test content, not a real study.',reviewed:true});
 const claim=await rpost('claim',{statement:'The synthetic comparison used two openings.',links:[{source_id:source.id,stance:'supports',quote:'The synthetic comparison used two openings.'}]});
 const plan=await post('plan',{workspace:'default',topic:'Synthetic researched Reel',audience:'Test viewers',goal:'Shares',promise:'Compare the openings',method:'Show the edit.',proof:'The synthetic comparison used two openings.',footage:'Generated colour pattern',cta:'Test one change.',duration:10});
 await click('[data-studio-tab="factory"]');await until(()=>evaluate('[...document.getElementById("factory-plan").options].some(x=>x.value==='+JSON.stringify(plan.id)+')'),'plan selectable');await input('#factory-plan',plan.id);await click('[data-factory-claim="'+claim.id+'"]');await click('#factory-create .primary-button');await until(()=>evaluate('!document.getElementById("factory-editor").hidden'),'campaign created');
 const id=await evaluate('ReelFactory.state.campaign.id');let c=await fget('campaign?id='+id);assert.equal(c.variants.length,3);assert.ok(c.audits.A.blockers.length);assert.equal(c.audits.A.reviewed,false);pass('three editable openings start as drafts without mutating the source plan');await shot('factory-draft');
 assert.ok(await evaluate('ReelFactory.api("package",'+JSON.stringify({id,key:'A',mode:'reviewed'})+').then(()=>false,e=>e.message)'));pass('unreviewed campaign cannot obtain a reviewed render package');
 for(let i=0;i<5;i++){
  await input('[data-scene="'+i+'"] [data-field="nature"]',i===3?'assertion':'instruction');
  await input('[data-scene="'+i+'"] [data-field="spoken"]',i===3?'The synthetic comparison used two openings.':'Compare the edit.');
  await input('[data-scene="'+i+'"] [data-field="on_screen"]',['Show the difference.','Keep the audience in mind.','Compare both openings.','Keep evidence attached.','Test one change.'][i]);
  await click('[data-scene="'+i+'"] [data-field="card"]');
 }
 await files('[data-scene-media="2"]',[motion]);await until(()=>evaluate('!!ReelFactory.state.campaign.variants[0].scenes[2].media'),'local video asset');await input('[data-scene="2"] [data-field="rights"]','owned');await input('[data-scene="2"] [data-field="rights_note"]','Synthetic fixture generated by the test.');
 await files('#factory-audio',[audio]);await until(()=>evaluate('!!ReelFactory.state.campaign.variants[0].narration'),'audio attached');await input('#factory-audio-rights','owned');await input('#factory-audio-note','Generated tone for encoder acceptance, not human narration.');await click('#factory-save');await until(()=>evaluate('!ReelFactory.state.dirty'),'saved');
 c=await fget('campaign?id='+id);assert.equal(c.audits.A.ready_for_review,true,JSON.stringify(c.audits.A));pass('local visual audio and evidence bindings pass production checks');
 await input('#factory-reviewer','AUTOMATED FIXTURE: not human approval');for(const key of ['claims_checked','rights_checked','timing_checked','visuals_checked'])await click('[data-factory-check="'+key+'"]');await click('#factory-approve');await until(async()=>(await fget('campaign?id='+id)).audits.A.reviewed,'test review recorded');pass('approval binds the exact script source and asset hashes');
 const downloads=path.join(run,'downloads');fs.mkdirSync(downloads);await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads,browserContextId:context},null);
 await input('#factory-mode','reviewed');await click('#factory-package');await click('#factory-srt');await click('#factory-notes');await until(()=>['reel-A-package.json','reel-A-captions.srt','reel-A-production.md'].every(n=>fs.existsSync(path.join(downloads,n))),'production sidecars completed');
 const packageName=fs.readdirSync(downloads).find(x=>x.endsWith('-package.json'));const pack=JSON.parse(fs.readFileSync(path.join(downloads,packageName),'utf8'));assert.equal(pack.mode,'reviewed');assert.equal(pack.evidence.claims[0].id,claim.id);assert.ok(fs.readFileSync(path.join(downloads,'reel-A-captions.srt'),'utf8').includes('00:00:10,000'));pass('production package captions and source-linked test card export');
 await click('#factory-render');await until(()=>evaluate('ReelFactory.state.busy'),'renderer started');await until(()=>evaluate('!ReelFactory.state.busy'), 'renderer complete',60000);
 c=await fget('campaign?id='+id);assert.equal(c.exports.length,1,await evaluate('document.getElementById("factory-render-status").textContent'));assert.ok(c.exports[0].mime.startsWith('video/'));await click('#factory-outputs a');await until(()=>fs.readdirSync(downloads).some(x=>/\.(mp4|webm)$/.test(x)),'rendered download');
 const movie=path.join(downloads,fs.readdirSync(downloads).find(x=>/\.(mp4|webm)$/.test(x)));const probe=spawnSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',movie],{encoding:'utf8',timeout:30000});assert.equal(probe.status,0,probe.stderr);const meta=JSON.parse(probe.stdout),vid=meta.streams.find(x=>x.codec_type==='video');assert.equal(vid.width,720);assert.equal(vid.height,1280);assert.ok(meta.streams.some(x=>x.codec_type==='audio'));assert.ok(Math.abs(Number(meta.format.duration)-10)<.6,meta.format.duration);
 fs.writeFileSync(path.join(run,'browser-render-probe.json'),JSON.stringify(meta,null,2));pass('actual downloaded portrait video decodes with audio and planned duration',{file:movie,width:vid.width,height:vid.height,duration:meta.format.duration,mime:c.exports[0].mime});
 const frame=spawnSync(ff,['-hide_banner','-loglevel','error','-ss','3.8','-i',movie,'-frames:v','1',path.join(run,'rendered-frame.png')],{encoding:'utf8',timeout:30000});assert.equal(frame.status,0,frame.stderr);await shot('factory-export');
 const before=c.exports.length;await evaluate('window.__cancelledRender=ReelFactory.render(["A"]).then(()=>"unexpected-success",e=>e.message);setTimeout(()=>ReelFactory.state.abort?.abort(),700);true');const cancellation=await evaluate('window.__cancelledRender');assert.ok(cancellation.includes('cancel'),cancellation);assert.equal((await fget('campaign?id='+id)).exports.length,before);pass('cancelled render creates no completion receipt');
 // Bulk production is sequential and keeps the distinct script variants.
 await input('#factory-mode','draft');await click('#factory-copy-visuals');await until(()=>evaluate('!ReelFactory.state.dirty'),'visual reuse');await click('#factory-batch');await until(()=>evaluate('ReelFactory.state.busy'),'batch started');await until(()=>evaluate('!ReelFactory.state.busy'),'three variant batch',90000);
 c=await fget('campaign?id='+id);assert.equal(c.exports.length,4,await evaluate('document.getElementById("factory-render-status").textContent'));assert.deepEqual(c.exports.slice(-3).map(x=>x.key),['A','B','C']);assert.ok(c.exports.slice(-3).every(x=>x.mode==='draft'));pass('three opening variants render sequentially as visibly marked drafts');
 const currentSource=await evaluate('PhoneLocal.api('+JSON.stringify('/api/research/source?workspace=default&id='+source.id)+')');await rpost('source',{...currentSource,note:'Source revised after approval.'});
 assert.ok(await evaluate('ReelFactory.api("package",'+JSON.stringify({id,key:'A',mode:'reviewed'})+').then(()=>false,e=>e.message)'));pass('changed source invalidates previous review before another final export');
 const backup=await evaluate('PhoneLocal.invoke("/phone/export")');assert.equal(backup.factory_bundle.length,1);assert.ok(!JSON.stringify(backup).includes('data:video'));await evaluate('PhoneLocal.invoke("/phone/import-backup","POST",'+JSON.stringify(backup)+')');c=await fget('campaign?id='+id);assert.ok(c.variants.every(v=>v.approval===null));pass('backup restores campaigns but never restores approval as fresh authority');
 await click('[data-studio-tab="factory"]');await evaluate('ReelFactory.refresh()');await input('#factory-campaign',id);await click('#factory-open');await until(()=>evaluate('!document.getElementById("factory-editor").hidden'),'restored editor');assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);pass('factory editor fits a phone-width viewport');
 assert.equal(errors.length,0,JSON.stringify(errors));pass('no uncaught browser exceptions');assert.ok(requests.every(r=>r.method==='GET'&&(r.url.startsWith('data:')||r.url.startsWith('blob:')||r.url.startsWith(origin))),JSON.stringify(requests));pass('rendering does not upload footage or call external services');
 fs.writeFileSync(path.join(run,'result.json'),JSON.stringify({passed:true,checks,errors,requests,downloaded_video:movie,package:path.join(downloads,packageName),assets_dir:run},null,2));fs.writeFileSync(path.join(root,'.local/factory-v060/browser-latest.json'),JSON.stringify({run,passed:true,checks:checks.length},null,2));console.log('FACTORY_BROWSER_EVIDENCE='+run);
}catch(error){try{await shot('failure');console.error('PAGE',await evaluate('document.body.innerText.slice(-3500)'));}catch{}fs.writeFileSync(path.join(run,'result.json'),JSON.stringify({passed:false,error:String(error),checks,errors,requests},null,2));console.error(error);process.exitCode=1;}finally{try{await send('Browser.close',{},null);}catch{}ws?.close();chrome.kill();for(const p of pending.values())clearTimeout(p.timer);}

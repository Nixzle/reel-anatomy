// Account responses are synthetic transport fixtures. No real Google account, token or cloud file is used.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';
const root=process.cwd(),run=path.join(root,'.local','google-sdk-browser-'+Date.now());fs.mkdirSync(run,{recursive:true});
const origin=process.env.RA_PHONE_ORIGIN||'http://127.0.0.1:18942/reel-anatomy/';
const profile=path.join(run,'chrome');fs.mkdirSync(profile);
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','pipe','pipe']});
const log=fs.createWriteStream(path.join(run,'chrome.log'));chrome.stdout.pipe(log);chrome.stderr.pipe(log);
let ws,session,sequence=0;const pending=new Map(),errors=[],requests=[],checks=[],cloud=new Map();let reserve=0,lostNext=false;
const fixtureChannel='UC'+'a'.repeat(22),fixtureVideo='b'.repeat(11),clientId='123456-testfixture.apps.googleusercontent.com';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label,limit=60000){const end=Date.now()+limit;while(Date.now()<end){if(await fn())return;await delay(150);}throw Error('Timed out: '+label);}
function send(method,params={},sid=session){return new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method));},60000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params,...(sid?{sessionId:sid}:{})}));});}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value;}
const click=selector=>evaluate('document.querySelector('+JSON.stringify(selector)+').click()');
const input=(selector,value)=>evaluate('(()=>{const e=document.querySelector('+JSON.stringify(selector)+');e.value='+JSON.stringify(value)+';e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}));})()');
async function files(selector,list){const doc=await send('DOM.getDocument');const n=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector});await send('DOM.setFileInputFiles',{nodeId:n.nodeId,files:list});}
const pass=(name,detail=true)=>{checks.push({name,detail});console.log('PASS',name,JSON.stringify(detail));};
async function shot(name){const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(run,name+'.png'),Buffer.from(r.data,'base64'));}
const mockSdk=`window.google={accounts:{oauth2:{initTokenClient:config=>({requestAccessToken:()=>{window.__fixtureScopes=config.scope;queueMicrotask(()=>config.callback({access_token:'TEST_ONLY_NOT_A_REAL_GOOGLE_TOKEN',expires_in:3600,scope:config.scope}));}}),revoke:(_token,callback)=>callback({successful:true})}}};`;
async function intercept(event){
 const {requestId,request}=event.params,url=new URL(request.url),method=request.method;
 requests.push({host:url.hostname,path:url.pathname,method,fixture:true});
 let status=200,data={};
 if(method==='OPTIONS'){}
 else if(url.pathname==='/drive/v3/about')data={user:{permissionId:'synthetic-account-owner',displayName:'Synthetic account'}};
 else if(url.pathname==='/drive/v3/files/generateIds')data={ids:['fixture-cloud-file-'+String(++reserve).padStart(4,'0')]};
 else if(url.pathname==='/drive/v3/files'){
  const query=url.searchParams.get('q')||'',space=/value='([a-f0-9]{32})'/.exec(query)?.[1];data={files:[...cloud.values()].filter(v=>v.meta.appProperties.raVault===space).map(v=>v.meta)};
 }else if(url.pathname==='/upload/drive/v3/files'&&method==='POST'){
  const contentType=Object.entries(request.headers).find(([k])=>k.toLowerCase()==='content-type')?.[1]||'';const boundary=/boundary=([^;]+)/.exec(contentType)?.[1];assert.ok(boundary,'multipart boundary');
  const body=request.postData||(await send('Network.getRequestPostData',{requestId},event.sessionId)).postData;
  const parts=body.split('--'+boundary).filter(v=>v.includes('Content-Type:')).map(v=>v.split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/,''));
  const meta=JSON.parse(parts[0]),payload=JSON.parse(parts[1]);assert.deepEqual(meta.parents,['appDataFolder']);assert.equal(meta.appProperties.raKind,'encrypted-v1');
  if(cloud.has(meta.id)){status=409;data={error:'exists'};}else{cloud.set(meta.id,{meta:{id:meta.id,size:String(Buffer.byteLength(parts[1])),appProperties:meta.appProperties},payload});data={id:meta.id};}
  if(lostNext){lostNext=false;await send('Fetch.failRequest',{requestId,errorReason:'ConnectionClosed'},event.sessionId);return;}
 }else if(url.pathname.startsWith('/drive/v3/files/')){const value=cloud.get(url.pathname.split('/').at(-1));if(value)data=value.payload;else{status=404;data={error:'missing'};}}
 else if(url.pathname==='/youtube/v3/channels')data={items:[{id:fixtureChannel,snippet:{title:'<img src=x onerror=window.__ytInjected=1> Fixture channel'},contentDetails:{relatedPlaylists:{uploads:'UU'+'a'.repeat(22)}}}]};
 else if(url.pathname==='/youtube/v3/playlistItems')data={items:[{contentDetails:{videoId:fixtureVideo}}]};
 else if(url.pathname==='/youtube/v3/videos')data={items:[{id:fixtureVideo,snippet:{channelId:fixtureChannel,title:'SESSION_ONLY_PRIVATE_API_TITLE',publishedAt:'2026-09-01T00:00:00Z'},contentDetails:{duration:'PT30S'},statistics:{viewCount:'9007199254740993',commentCount:'7'}}]};
 else if(url.hostname==='youtubeanalytics.googleapis.com'&&url.pathname==='/v2/reports')data=url.searchParams.has('dimensions')?{columnHeaders:[{name:'elapsedVideoTimeRatio'},{name:'audienceWatchRatio'}],rows:[[.01,1.2],[.5,.7],[1,.4]]}:{columnHeaders:[{name:'views'},{name:'engagedViews'},{name:'likes'},{name:'comments'},{name:'shares'},{name:'averageViewDuration'}],rows:[[100,80,10,7,2,18]]};
 else{throw Error('Unexpected mocked provider request: '+method+' '+url.href);}
 await send('Fetch.fulfillRequest',{requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:new URL(origin).origin},{name:'Access-Control-Allow-Headers',value:'authorization,content-type'},{name:'Access-Control-Allow-Methods',value:'GET,POST,DELETE,OPTIONS'}],body:Buffer.from(JSON.stringify(data)).toString('base64')},event.sessionId);
}
async function openDevice(name){
 const context=(await send('Target.createBrowserContext',{},null)).browserContextId;const target=(await send('Target.createTarget',{url:'about:blank',browserContextId:context},null)).targetId;
 const sid=(await send('Target.attachToTarget',{targetId:target,flatten:true},null)).sessionId;session=sid;
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
 await send('Fetch.enable',{patterns:[{urlPattern:'https://www.googleapis.com/*'},{urlPattern:'https://youtubeanalytics.googleapis.com/*'}]});
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 const downloads=path.join(run,name);fs.mkdirSync(downloads);await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads,browserContextId:context},null);
 await send('Page.navigate',{url:origin});await until(()=>evaluate('document.getElementById("boot")?.hidden&&!!document.getElementById("connections-panel")'),'app '+name);await click('[data-studio-tab="settings"]');return {sid,context,downloads};
}
async function configure(){await input('#google-client-id',clientId);await click('#connections-consent');await click('#google-load');await until(()=>evaluate('document.getElementById("connections-status").textContent.includes("sign-in loaded")'),'SDK ready');}
async function connectDrive(){await click('#sync-consent');await click('#drive-connect');await until(()=>evaluate('document.getElementById("sync-status").textContent.includes("Connected Drive account")'),'Drive fixture connected');}
const sourcePost=(data)=>evaluate('PhoneLocal.api("/api/research/source",{method:"POST",body:JSON.stringify('+JSON.stringify({workspace:'default',...data})+')})');
const readSource=id=>evaluate('PhoneLocal.api("/api/research/source?workspace=default&id='+id+'")');
const readSources=()=>evaluate('PhoneLocal.api("/api/research/sources?workspace=default")');
async function review(){await click('#sync-review');await until(()=>evaluate('document.getElementById("connections-panel").dataset.busy!=="true"&&(document.getElementById("sync-status").textContent.includes("Review completed")||document.getElementById("sync-status").textContent.includes("conflict(s)"))'),'sync preview');}
async function apply(){await click('#sync-apply');await until(()=>evaluate('document.getElementById("connections-panel").dataset.busy!=="true"&&document.getElementById("sync-status").textContent.includes("Metadata synced")'),'sync applied');}
try{
 await until(()=>fs.existsSync(path.join(profile,'DevToolsActivePort')),'Chrome');const [port,route]=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').trim().split('\n');ws=new WebSocket('ws://127.0.0.1:'+port+route);await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});
 ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);else if(m.method==='Fetch.requestPaused')void intercept(m).catch(error=>{errors.push({fixtureError:String(error)});void send('Fetch.failRequest',{requestId:m.params.requestId,errorReason:'Failed'},m.sessionId);});else if(m.method==='Page.javascriptDialogOpening')void send('Page.handleJavaScriptDialog',{accept:true},m.sessionId);});

 const a=await openDevice('sdk-only');
 assert.equal(await evaluate('Boolean(window.google?.accounts?.oauth2)'),false);assert.equal(requests.length,0);pass('no Google SDK is present before explicit consent');
 await input('#google-client-id',clientId);await click('#connections-consent');await click('#google-load');
 await until(()=>evaluate('Boolean(window.google?.accounts?.oauth2?.initTokenClient)&&document.getElementById("connections-panel").dataset.busy!=="true"'),'official Google SDK loaded',30000);
 assert.ok(await evaluate('document.getElementById("connections-status").textContent.includes("sign-in loaded")'));
 assert.equal(requests.length,0);assert.equal(await evaluate('window.__fixtureScopes'),undefined);
 pass('official Google Identity Services loads under the deployed CSP without starting account consent');
 const src=await evaluate('[...document.scripts].map(x=>x.src).filter(x=>x.startsWith("https://accounts.google.com/"))');assert.deepEqual(src,['https://accounts.google.com/gsi/client']);pass('only the official hosted SDK is used; no token client request or API account call occurred');
 assert.equal(errors.length,0,JSON.stringify(errors));await shot('official-sdk-loaded');
 fs.writeFileSync(path.join(run,'result.json'),JSON.stringify({passed:true,checks,errors,provider_requests:requests,scope:'Real official Google SDK fetch only, isolated Chrome, fixture-shaped public client ID stored locally. No sign-in popup, account authorisation, token, YouTube data or Drive file request.'},null,2));
 fs.writeFileSync(path.join(root,'.local/authorised-connections-20261024/sdk-latest.json'),JSON.stringify({run,passed:true,checks:checks.length},null,2));console.log('SDK_BROWSER_EVIDENCE='+run);
}catch(error){try{await shot('failure');console.error('PAGE',await evaluate('document.body.innerText.slice(-4500)'));}catch{}fs.writeFileSync(path.join(run,'result.json'),JSON.stringify({passed:false,error:String(error),checks,errors,provider_requests:requests},null,2));console.error(error);process.exitCode=1;}finally{try{await send('Browser.close',{},null);}catch{}ws?.close();chrome.kill();for(const p of pending.values())clearTimeout(p.timer);}

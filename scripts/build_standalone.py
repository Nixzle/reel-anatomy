"""Create the standalone site from an explicit public-source allowlist."""
import ast,hashlib,json,re,shutil,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[1];out=root/'phone-dist';out.mkdir(exist_ok=True)
release=json.loads((root/'standalone/RELEASE_TARGET.json').read_text())
from check_release_gate import assess
assert assess(release)['passed'],'Release identity contradicts acceptance status'
for name in ('web','python','runtime','vendor','icons'):(out/name).mkdir(exist_ok=True)
for name in ('style.css','studio.css','app.js','studio.js'):
    shutil.copy2(root/'web'/name,out/'web'/name)
for f in (root/'web/icons').glob('*.png'):shutil.copy2(f,out/'icons'/f.name)
model_pin=json.loads((root/'standalone/MODEL_RUNTIME_PIN.json').read_text())
assert hashlib.sha256((root/'standalone'/model_pin['file']).read_bytes()).hexdigest()==model_pin['sha256'],'Model runtime source changed'
for donor in json.loads((root/'standalone/DOCUMENT_RUNTIME_PINS.json').read_text()):
    for item in donor['files']:
        assert hashlib.sha256((root/'standalone'/item['path']).read_bytes()).hexdigest()==item['sha256'],'Document donor hash changed: '+item['path']
for f in (root/'standalone/vendor').rglob('*'):
    if f.is_file():
        dest=out/'vendor'/f.relative_to(root/'standalone/vendor');dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(f,dest)
pins=json.loads((root/'standalone/RUNTIME_PINS.json').read_text(encoding='utf-8'))
for item in pins:
    f=root/'.local/standalone-v040/runtime'/item['name']
    assert f.stat().st_size==item['bytes'] and hashlib.sha256(f.read_bytes()).hexdigest()==item['sha256'],'Runtime changed: '+f.name
    shutil.copy2(f,out/'runtime'/f.name)
for name in ('worker.mjs','media.mjs','phone.mjs','phone.css','research_services.mjs','sanctum.mjs','sanctum.css','model-worker.mjs','SANCTUM_PROFILE.json','factory.mjs','factory_render.mjs','factory.css','caption_editor.mjs','desktop_speech.mjs','google_connections.mjs','vault_sync.mjs','connections_ui.mjs','connections.css','CONNECTIONS.md','CONNECTIONS_PRIVACY.html','creative_lab.mjs','creative_lab.css','document_tools.mjs','article_reader.mjs','pack_worker.mjs','project_pack.mjs','release_desk.mjs','release_desk.css','RELEASE_TARGET.json'):shutil.copy2(root/'standalone'/name,out/name)
shutil.copy2(root/'standalone/backend.py',out/'python/backend.py')
shutil.copy2(root/'standalone/release_services.py',out/'python/release_services.py')
shutil.copy2(root/'standalone/creative_lab.py',out/'python/creative_lab.py')
shutil.copy2(root/'standalone/research_engine.py',out/'python/research_engine.py')
shutil.copy2(root/'standalone/factory_engine.py',out/'python/factory_engine.py')
shutil.copy2(root/'standalone/timed_captions.py',out/'python/timed_captions.py')
store_source=(root/'studio_store.py').read_text(encoding='utf-8')
store_source=store_source.replace('duration_band),snapshot_id=', 'duration_band,a.get("timing_method","imported")),snapshot_id=')
(out/'python/studio_store.py').write_text(store_source,encoding='utf-8')
source=(root/'app.py').read_text(encoding='utf-8');tree=ast.parse(source)
names={'parse_captions','classify','stamp','finite_number','validate_metrics','validate_intervals'}
parts=['import re, math','TAGS='+repr(('Hook','Problem','Context','Explanation','Demonstration','Proof','Payoff','Objection','CTA','Other')),'METRIC_KEYS='+repr(('views','likes','saves','shares','comments'))]
parts.extend(ast.get_source_segment(source,node) for node in tree.body if isinstance(node,ast.FunctionDef) and node.name in names)
(out/'python/embedded_core.py').write_text('\n\n'.join(parts),encoding='utf-8')
source=(root/'studio_api.py').read_text(encoding='utf-8');node=next(n for n in ast.parse(source).body if isinstance(n,ast.FunctionDef) and n.name=='csv_import')
(out/'python/embedded_csv.py').write_text('import csv,io,json\nfrom studio_store import text\n'+ast.get_source_segment(source,node),encoding='utf-8')
html=(root/'web/index.html').read_text(encoding='utf-8')
html=re.sub(r'  <script src="/web/[^"\n]+"></script>\n','',html)
html=html.replace('href="/','href="./').replace('href="./web/mobile.css"','href="./phone.css"')
html=html.replace('CREATIVE INTELLIGENCE / PRODUCTION STUDIO','ON-DEVICE RESEARCH / FILMING STUDIO').replace('<span class="version">02</span>','<span class="version">1.0 RC</span>')
html=html.replace('Video stays on this computer.','Video stays on this device.').replace('Max 200 MB','Max 100 MB on this device')
html=html.replace('Processing is local. The durable queue continues while the app runs.','Processing stays on this device. Keep the app visible while inspecting videos.')
html=html.replace('If local speech recognition is installed, this can be blank.','The desktop companion can recognise English speech locally. In the standalone phone app, import SRT/VTT or completed analysis JSON.')
html=html.replace('<label class="drop-zone"','<label class="check-label"><input type="checkbox" required> I have permission to process this video on this device.</label><label class="drop-zone"')
html=html.replace('<div class="header-right">','<button id="install-phone" class="outline-button">Install</button><div class="header-right">')
start=html.index('        <section id="studio-settings"');end=html.index('        <dialog id="post-dialog"',start)
old=html[start:end]
settings='        <section id="studio-settings" class="studio-pane" hidden><div class="studio-heading"><span class="kicker">ON-DEVICE WORKSPACE</span><h1>Your research.<br><em>In your hands.</em></h1><p>This edition works without an account. Research and video stay in this browser by default. Optional account reports and encrypted metadata sync require explicit setup and consent below; original media is not synced.</p></div>\n<div class="studio-card"><h3>Bring your work with you</h3><p>Import desktop analysis JSON, a research export, or a phone backup. Importing an analysis does not transfer its original video. Attach that separately for playback.</p><label class="file-mini">Import JSON files<input id="import-phone-json" type="file" accept=".json,application/json" multiple></label><div class="actions"><button id="export-backup" class="primary-button">Export library backup</button><button id="export-recovery" class="outline-button">Export pre-restore recovery</button><button id="share-export" class="outline-button" hidden>Share last export</button></div><p class="small-note">Backups include research, scripts, observations and analysis, not source video files. Browser storage can be evicted. Export important work.</p></div>\n<div class="studio-card"><h3>Playback and storage</h3><p>Open an imported video in Breakdown first, then attach its original file here.</p><label class="file-mini">Attach original video<input id="attach-media" type="file" accept="video/*,.mp4,.mov,.webm"></label><div class="actions"><button id="persist-storage" class="outline-button">Request persistent storage</button></div><p id="offline-status" class="small-note">The offline cache is being prepared.</p></div>\n<div class="studio-card"><h3>What is doing the work?</h3><p>The existing desktop comparison and planning code runs here inside a Pyodide browser worker. Scripts use the same transparent structured planner, not a learned language model. Local video inspection samples visual changes; it is not frame-accurate scene recognition.</p><p>The standalone phone app uses supplied subtitles. The desktop companion can add local English speech recognition; its availability is shown below. Optional local text-model reasoning is configured separately in Ask Ultron. No remote relay, remote desktop control or cloud-inference fallback is enabled by default.</p><p><a href="./DONORS.md">Open-source credits and provenance</a></p></div>\n<div hidden><button id="refresh-models">Models</button><p id="model-status"></p><form id="model-form"><select id="model-select"></select><input type="checkbox" id="model-enable"><button>Save</button></form></div></section>\n'
html=html[:start]+settings+html[end:]
html=html.replace('id="deep-analyse-post"','id="deep-analyse-post" disabled').replace('Queue local semantic analysis','Learned analysis: desktop only')
html=html.replace('Optional local-model refinement is available in Settings; it is never silently enabled.','Learned refinement belongs to the desktop edition; transfer its results by JSON.')
html=html.replace('</head>','<link rel="icon" href="./icons/icon-192.png"></head>')
html=html.replace('</body>','<div id="boot" role="status"><div><span class="kicker">REEL ANATOMY / ON DEVICE</span><h1>Opening your studio.</h1><p id="boot-status">Preparing the local engine. Application files are downloaded; your research is not uploaded.</p></div></div>\n<dialog id="install-dialog" class="post-dialog"><h2>Install on iPhone</h2><p>Open this page in Safari. Tap the More (…) or Share button, then <strong>Add to Home Screen</strong>. Turn on <strong>Open as Web App</strong>, then tap Add.</p><p>If Add to Home Screen is missing, scroll to Edit Actions and add it. In an embedded browser, open the page in Safari first.</p><p>Install before adding important work. Safari and the Home Screen app may use separate storage. Use Export library backup and Import JSON to transfer data when needed.</p><button id="close-install" class="primary-button">Done</button></dialog>\n<script type="module" src="./phone.mjs"></script></body>')
html=html.replace('<meta name="theme-color"','<meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\' \'unsafe-eval\' \'wasm-unsafe-eval\'; worker-src \'self\' blob:; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: blob:; media-src \'self\' blob:; connect-src \'self\'; object-src \'none\'; base-uri \'self\'; form-action \'none\'"><meta name="theme-color"')
html=html.replace('<button data-studio-tab="library">','<button data-studio-tab="sanctum">Sanctum</button><button data-studio-tab="library">')
html=html.replace('        <section id="studio-library"', (root/'standalone/sanctum.html').read_text(encoding='utf-8')+'\n        <section id="studio-library"',1)
html=html.replace('</head>','<link rel="stylesheet" href="./sanctum.css"><link rel="stylesheet" href="./factory.css"></head>')
html=html.replace('<button data-studio-tab="create">Studio</button>', '<button data-studio-tab="create">Studio</button><button data-studio-tab="factory">Reel Factory</button>')
html=html.replace('        <section id="studio-library"',(root/'standalone/factory.html').read_text(encoding='utf-8')+'\n        <section id="studio-library"',1)
html=html.replace("connect-src \'self\';", "connect-src \'self\' https://api.crossref.org https://en.wikipedia.org https://huggingface.co https://*.huggingface.co https://*.hf.co https://raw.githubusercontent.com;")
html=html.replace('<button data-studio-tab="sanctum">','<button data-studio-tab="home">Start</button><button data-studio-tab="sanctum">')
html=html.replace('        <section id="studio-library"',(root/'standalone/release_desk.html').read_text(encoding='utf-8')+'\n        <section id="studio-library"',1)
html=html.replace('</head>','<link rel="stylesheet" href="./release_desk.css"></head>')
html=html.replace('https://api.crossref.org ', 'https://api.crossref.org https://www.ebi.ac.uk ')
html=html.replace('<!-- CREATIVE_LAB -->',(root/'standalone/creative_lab.html').read_text(encoding='utf-8'))
html=html.replace('</head>','<link rel="stylesheet" href="./creative_lab.css"></head>')
html=html.replace("script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval';","script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' https://accounts.google.com/gsi/client;")
html=html.replace("style-src 'self' 'unsafe-inline';","style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style; frame-src https://accounts.google.com/gsi/;")
html=html.replace("connect-src 'self' ","connect-src 'self' https://accounts.google.com/gsi/ https://www.googleapis.com https://youtubeanalytics.googleapis.com ")
html=html.replace('</head>','<link rel="stylesheet" href="./connections.css"></head>')
(out/'index.html').write_text(html,encoding='utf-8')
js=(out/'web/app.js').read_text(encoding='utf-8')
a=js.index('async function api(path, options) {');b=js.index('async function loadLibrary()',a)
js=js[:a]+"async function api(path,options){return window.PhoneLocal.api(path,options); }\n"+js[b:]
# Media URLs are browser-local object URLs; no /media or /thumb request leaves the device.
old='src="/thumb/\'+current.id+\'/\'+i+\'"'
new='src="\'+HTML(current.thumbnails?.[i]||\'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22240%22 height=%22135%22%3E%3C/svg%3E\')+\'"'
assert old in js;js=js.replace(old,new)
a=js.index('function download(filename,text,type) {');b=js.index('const CSV =',a)
js=js[:a]+"function download(filename,text,type){window.PhoneLocal.exportFile(filename,text,type); }\n"+js[b:]
js=js.replace('200*1024*1024','100*1024*1024').replace('200 MB','100 MB')
js=js.replace('    if (!health.speech)', '    $("system-status").textContent="ON-DEVICE STUDIO";\n    if (!health.speech)')
js=js.replace('No local transcription package detected. Upload SRT/VTT or paste a transcript; video cut detection is available.','Import subtitles, paste a transcript, or import desktop analysis JSON. Video inspection is sampled locally; automatic speech recognition is not included here.')
js+='\nwindow.PhoneLocal.current=()=>current;\n'
(out/'web/app.js').write_text(js,encoding='utf-8')
js=(out/'web/studio.js').read_text(encoding='utf-8').replace('200*1024*1024','100*1024*1024').replace('200 MB','100 MB')
js=js.replace('["library","patterns","create","results","settings"]','["library","patterns","create","results","settings","sanctum","factory","home"]')
js=js.replace('function show(tab){','function show(tab){document.body.dataset.view=tab;')
js=js.replace('initStudio().catch(', 'window.StudioUI.ready=initStudio().catch(')
# Desktop semantic controls remain unavailable on the phone; Ultron has a separate opt-in local text model.
js=js.replace('data-deep=', 'disabled title="Automatic semantic analysis requires the desktop edition" data-deep=')
js=js.replace('id="refine-plan"','id="refine-plan" disabled title="Use the desktop edition for learned refinement"').replace('Refine with configured local model','Desktop refinement')
js=js.replace('...values,duration:Number(values.duration),workspace:S.workspace','...values,duration:Number(values.duration),workspace:S.workspace,lab_signal_ids:window.CreativeLab?.pendingSignalIds()||[]')
js=js.replace('notice("Original filming brief saved.");','window.CreativeLab?.clearPending();notice("Original filming brief saved.");')
(out/'web/studio.js').write_text(js,encoding='utf-8')
manifest={'id':'./','name':'Reel Anatomy Studio','short_name':'Reel Anatomy','start_url':'./','scope':'./','display':'standalone','background_color':'#eceae4','theme_color':'#eceae4','icons':[{'src':'./icons/icon-192.png','sizes':'192x192','type':'image/png'},{'src':'./icons/icon-512.png','sizes':'512x512','type':'image/png'}]}
(out/'manifest.webmanifest').write_text(json.dumps(manifest,indent=2),encoding='utf-8');(out/'.nojekyll').write_text('')
shutil.copy2(root/'LICENSE',out/'LICENSE')
(out/'examples').mkdir(exist_ok=True)
for name in ('reel-factory-A-draft.mp4','reel-factory-B-draft.mp4','reel-factory-C-draft.mp4','demo-captions.srt','demo-package.json','demo-render-receipt.json','README.md'):
    shutil.copy2(root/'standalone/examples'/name,out/'examples'/name)
for name in ('DONORS.md','ACCEPTANCE.md','RUNTIME_PINS.json','MODEL_RUNTIME_PIN.json','DOCUMENT_RUNTIME_PINS.json','FACTORY.md','CREATIVE_LAB.md'):
    if (root/'standalone'/name).exists():shutil.copy2(root/'standalone'/name,out/name)
files=sorted(str(f.relative_to(out)).replace('\\','/') for f in out.rglob('*') if f.is_file() and f.name not in ('sw.js','BUILD.json'))
version=hashlib.sha256(''.join(hashlib.sha256((out/f).read_bytes()).hexdigest() for f in files).encode()).hexdigest()[:16]
source_commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
expected={f:hashlib.sha256((out/f).read_bytes()).hexdigest() for f in files}
cache_assets=['./','./BUILD.json']+['./'+f for f in files if f not in ('vendor/webllm.mjs','model-worker.mjs')]
sw="const CACHE="+json.dumps('reel-phone-'+version+'-'+source_commit[:12])+";\nconst BUILD="+json.dumps(version)+";\nconst SOURCE="+json.dumps(source_commit)+";\nconst EXPECTED="+json.dumps(expected)+";\nconst ASSETS="+json.dumps(cache_assets)+";\n"+r"""
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 try{
  for(const path of ASSETS){
   const request=new Request(new URL(path,self.registration.scope),{cache:'no-store',credentials:'same-origin'});
   const response=await fetch(request);if(!response.ok)throw Error('Application asset unavailable: '+path);
   const data=await response.clone().arrayBuffer();const relative=path==='./'?'index.html':path.slice(2);
   if(relative==='BUILD.json'){
    const manifest=JSON.parse(new TextDecoder().decode(data));if(manifest.build!==BUILD||manifest.source_commit!==SOURCE)throw Error('Application build manifest changed during installation.');
   }else if(!EXPECTED[relative]||hex(await crypto.subtle.digest('SHA-256',data))!==EXPECTED[relative])throw Error('Application asset failed its build checksum: '+relative);
   await cache.put(request,response);
  }
 }catch(error){await caches.delete(CACHE);throw error;}
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const name of await caches.keys())if(name.startsWith('reel-phone-')&&name!==CACHE)await caches.delete(name);
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const u=new URL(event.request.url);
 if(event.request.method!=='GET'||u.origin!==self.location.origin||u.pathname.includes('/api/'))return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE);const saved=await cache.match(event.request,{ignoreSearch:true});return saved||fetch(event.request);})());
});
"""
(out/'sw.js').write_text(sw,encoding='utf-8')
(out/'BUILD.json').write_text(json.dumps({'version':release['candidate'],'source_commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'source_dirty':bool(subprocess.check_output(['git','status','--porcelain'],cwd=root,text=True).strip()),'build':version,'files':{f:hashlib.sha256((out/f).read_bytes()).hexdigest() for f in files}},indent=2),encoding='utf-8')
print('STANDALONE_BUILD',len(files),'files',sum(f.stat().st_size for f in out.rglob('*') if f.is_file()),'bytes',version)

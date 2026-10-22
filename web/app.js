"use strict";
const $ = id => document.getElementById(id);
const roles = ["Hook","Problem","Context","Explanation","Demonstration","Proof","Payoff","Objection","CTA","Other"];
let projects = [], current = null, comparison = [], toastTimer = null, dirty = false;
const HTML = str => String(str ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const number = n => Number.isFinite(Number(n)) ? Number(n) : 0;
const readable = n => n === "" || n === null || n === undefined ? "—" : Number(n).toLocaleString("en-AU");
const timestamp = sec => {
  sec = Math.max(0, number(sec));
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = Math.floor(sec % 60);
  return (h ? String(h).padStart(2,"0") + ":" : "") + String(m).padStart(2,"0") + ":" + String(s).padStart(2,"0");
};
const seconds = sec => Number(sec || 0).toFixed(1) + "s";
const pct = (x,duration) => Math.max(0,Math.min(100,number(x)/Math.max(duration,1)*100));
function notice(msg) {
  const toast = $("toast");
  toast.textContent = msg;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"),3500);
}
async function api(path, options) {
  const r = await fetch(path,options);
  let data;
  try { data = await r.json(); } catch { data = {}; }
  if (!r.ok) throw Error(data.error || "Local operation failed (" + r.status + ")");
  return data;
}
async function loadLibrary() {
  projects = await api("/api/projects");
  $("project-count").textContent = String(projects.length).padStart(2,"0");
  const nav = $("project-list");
  if (!projects.length) {
    nav.innerHTML = '<div class="empty-library">No saved analyses yet.<br>Drop in your first video to begin.</div>';
    return;
  }
  nav.innerHTML = projects.map(p =>
    '<button class="project-nav'+ (current && p.id === current.id ? " active" : "") +'" data-id="' + p.id +
    '"><strong>'+HTML(p.title)+'</strong><small>'+timestamp(p.duration)+" · "+p.segments+" UTTERANCES · "+p.shots+" SHOTS</small></button>"
  ).join("");
  nav.querySelectorAll("button").forEach(b => b.addEventListener("click",() => openProject(b.dataset.id)));
}
function showStart() {
  if (dirty && !window.confirm("Discard unsaved corrections?")) return;
  dirty = false; $("player").pause();
  if(window.StudioUI)window.StudioUI.show("breakdown");
  current = null; $("analysis-view").hidden = true; $("start-view").hidden = false;
  $("video-file").value = ""; $("captions-file").value = ""; $("chosen-name").textContent = "NO FILE SELECTED";
  $("transcript-input").value = ""; window.scrollTo(0,0);loadLibrary().catch(console.error);
}
async function openProject(id) {
  if (dirty && !window.confirm("Discard unsaved corrections?")) return;
  try {
    current = await api("/api/project/"+id); dirty = false;
    if(window.StudioUI)window.StudioUI.show("breakdown");
    $("start-view").hidden = true; $("analysis-view").hidden = false;
    renderCurrent(); await loadLibrary(); window.scrollTo(0,0);
  } catch(err){ notice(err.message); }
}
function seek(sec) {
  const v = $("player");
  if (!Number.isFinite(sec)) return;
  const go = () => { v.currentTime = Math.max(0,sec); v.play().catch(() => {}); };
  if (v.readyState) go(); else v.addEventListener("loadedmetadata",go,{once:true});
}
function renderCurrent() {
  if (!current) return;
  const p=current;
  $("report-title").textContent=p.title;
  $("report-no").textContent="/ "+p.id.slice(0,4).toUpperCase();
  $("report-duration").textContent=timestamp(p.duration)+" TOTAL";
  $("report-utterances").textContent=p.segments.length+" UTTERANCES";
  $("report-cuts").textContent=p.shots.length ? Math.max(0,p.shots.length-1)+" ESTIMATED CUTS" : "CUTS UNAVAILABLE";
  $("report-source").textContent="SPEECH: "+String(p.transcript_source).toUpperCase();
  $("player").src=p.media; $("player").load();
  $("video-time").textContent="00:00";
  $("notice-list").innerHTML=(p.notices || []).map(n=>'<div class="notice">'+HTML(n)+'</div>').join("");
  $("stat-sentences").textContent=p.segments.length;
  $("stat-shots").textContent=p.shots.length;
  $("stat-cut-rate").textContent=p.duration && p.shots.length ? ((Math.max(0,p.shots.length-1)/p.duration)*60).toFixed(1) : "—";
  renderRoles();
  renderTimeline();
  renderSentences();
  renderShots();
  renderMetrics();
  renderComparison().catch(console.error);
  $("save-indicator").textContent="SAVED LOCALLY";
}
function renderRoles() {
  const count={};current.segments.forEach(s=>count[s.role]=(count[s.role]||0)+1);
  const filled=Object.entries(count).sort((a,b)=>b[1]-a[1]);
  $("role-breakdown").innerHTML=filled.length ? filled.map(([name,n]) =>
    '<div class="role-line '+(name==="Hook"?"is-hook":"")+'"><label>'+HTML(name)+'</label><div class="meter"><div style="width:'+(100*n/current.segments.length)+'%"></div></div><b>'+String(n).padStart(2,"0")+'</b></div>'
  ).join("") : '<div class="row-reason">No transcript yet. Import subtitles or enable a local model.</div>';
  const opens=current.segments.filter(s=>s.start < 5);
  const hook=opens.find(s=>s.role==="Hook");
  const cuts=Math.max(0,current.shots.length-1);
  let text=hook ? "The opening has a suggested hook at "+seconds(hook.start)+". Verify whether the footage actually delivers what the words promise." :
    "No opening hook was identified. A label is not an assessment of creative quality.";
  if (current.duration && cuts) text+=" The edit map contains "+cuts+" possible scene changes.";
  $("structure-note").textContent=text;
}
function renderTimeline() {
  const d=Math.max(1,current.duration,...current.segments.map(s=>number(s.end)),...current.shots.map(s=>number(s.end)));
  const element=(arr,kind) => arr.map(item => {
    const left=pct(item.start,d),width=Math.max(.4,pct(item.end,d)-left);
    const cls=kind==="speech" ? (item.role==="Hook"?"hook":item.role==="CTA"?"cta":item.role==="Problem"?"problem":"") : "";
    const label=(kind==="speech" ? item.role+" · "+item.text : "Shot "+(item.index+1));
    return '<button class="'+cls+'" title="'+HTML(label)+'" aria-label="'+HTML(label)+'" data-time="'+item.start+'" style="left:'+left+'%;width:'+width+'%"></button>';
  }).join("");
  $("speech-track").innerHTML=element(current.segments,"speech");
  $("shot-track").innerHTML=element(current.shots,"shot");
  for(const el of [$("speech-track"),$("shot-track")]){
    el.querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>seek(Number(b.dataset.time))));
  }
  $("timeline-key").innerHTML='<span><i class="legend-dot hook"></i>Hook</span><span><i class="legend-dot problem"></i>Problem</span><span><i class="legend-dot cta"></i>CTA</span><span><i class="legend-dot"></i>Other speech</span>';
}
function markDirty(){ dirty = true; $("save-indicator").textContent="UNSAVED CHANGES"; }
function renderSentences() {
  const rows=$("sentence-rows");
  $("sentence-count").textContent=current.segments.length+" ROWS";
  if (!current.segments.length) {
    rows.innerHTML='<p class="no-comparison">No speech was detected. Import a timestamped transcript to populate this section.</p>';return;
  }
  rows.innerHTML=current.segments.map((s,i)=>
    '<div class="sentence-row"><button class="time-button" data-time="'+s.start+'">'+
    timestamp(s.start)+'<br>→ '+timestamp(s.end)+'</button>'+
    '<select aria-label="Narrative role for sentence '+(i+1)+'" class="role-select" data-index="'+i+'">'+
    roles.map(r=>'<option value="'+r+'" '+(s.role===r?"selected":"")+'>'+r+'</option>').join("")+'</select>'+
    '<div class="row-content"><textarea class="row-text" rows="2" aria-label="Spoken sentence '+(i+1)+'" data-index="'+i+'">'+HTML(s.text)+'</textarea>'+
    '<div class="row-reason">'+HTML(s.reason || "Manually edited")+'</div></div></div>'
  ).join("");
  rows.querySelectorAll(".time-button").forEach(b=>b.addEventListener("click",()=>seek(Number(b.dataset.time))));
  rows.querySelectorAll(".role-select").forEach(sel=>sel.addEventListener("change",()=>{
    const x=current.segments[Number(sel.dataset.index)];x.role=sel.value;x.roles=[sel.value];x.edited=true;x.reason="Manually reviewed";markDirty();renderRoles();renderTimeline();
  }));
  rows.querySelectorAll(".row-text").forEach(field=>field.addEventListener("input",()=>{
    const x=current.segments[Number(field.dataset.index)];x.text=field.value;x.edited=true;markDirty();
  }));
}
function renderShots() {
  const grid=$("shot-grid");
  if (!current.shots.length){grid.innerHTML='<p class="no-comparison">No shot boundaries. FFmpeg may be unavailable or the video could not be decoded.</p>';return;}
  grid.innerHTML=current.shots.map((shot,i)=>
    '<div class="shot-card"><img loading="lazy" src="/thumb/'+current.id+'/'+i+'" alt="Frame sample from shot '+(i+1)+'" data-time="'+shot.start+'">'+
    '<div class="shot-body"><div class="shot-time"><span>SHOT '+String(i+1).padStart(2,"0")+'</span><span>'+timestamp(shot.start)+' → '+timestamp(shot.end)+'</span></div>'+
    '<input type="text" aria-label="Edit shot description" data-index="'+i+'" value="'+HTML(shot.kind)+'" maxlength="160"></div></div>'
  ).join("");
  grid.querySelectorAll("img").forEach(img=>img.addEventListener("click",()=>seek(Number(img.dataset.time))));
  grid.querySelectorAll("input").forEach(input=>input.addEventListener("input",()=>{
    current.shots[Number(input.dataset.index)].kind=input.value;markDirty();
  }));
}
function renderMetrics() {
  $("metric-fields").querySelectorAll("input").forEach(input=>{
    input.value=current.metrics && current.metrics[input.name] !== undefined ? current.metrics[input.name] : "";
    input.oninput=()=>{
      if (!current.metrics) current.metrics={};
      current.metrics[input.name]=input.value===""?null:Math.max(0,Math.floor(number(input.value)));
      markDirty();
    };
  });
}
async function renderComparison() {
  const list=await api("/api/projects");
  comparison=await Promise.all(list.map(x=>api("/api/project/"+x.id)));
  const parent=$("comparison-table");
  if (comparison.length<2) {
    parent.innerHTML='<div class="no-comparison">Analyse at least two videos to compare their structure and reported metrics.</div>';return;
  }
  const entries=comparison.map(p=>{
    const {engagement:e,cuts}=metricSummary(p);
    const opening=p.segments.filter(s=>s.start<5).map(s=>s.role).join(", ") || "—";
    return {title:p.title,id:p.id,views:p.metrics?.views ?? null,engagement:e,cuts,opening};
  });
  parent.innerHTML='<table class="comparison-table"><thead><tr><th>VIDEO</th><th>VIEWS</th><th>ENGAGEMENT / VIEWS</th><th>CUTS / MIN</th></tr></thead><tbody>'+
    entries.map(x=>'<tr class="'+(x.id===current.id?"current":"")+'"><td>'+HTML(x.title)+'</td><td class="number">'+readable(x.views)+'</td><td class="number">'+(x.engagement===null?"—":x.engagement.toFixed(2)+"%")+'</td><td class="number">'+(x.cuts===null?"—":x.cuts.toFixed(1))+'</td></tr>').join("")+
    '</tbody></table>';
}
async function saveCorrections() {
  if (!current) return;
  const answer=await api("/api/save",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(current)});
  current.revision=answer.revision; dirty=false;
  $("save-indicator").textContent="SAVED LOCALLY";
  await renderComparison();notice("Corrections saved to this computer.");
}
function download(filename,text,type) {
  const url=URL.createObjectURL(new Blob([text],{type:type || "text/plain"}));
  const a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const CSV = v => {const s=String(v??"");const safe=/^\s*[=+@-]/.test(s)?"\'"+s:s;return '"' + safe.replace(/"/g,'""') + '"';};
function exportSentences() {
  if (!current) return;
  const rows=[["video","start_seconds","end_seconds","role","spoken_text","basis","manually_edited"]];
  current.segments.forEach(s=>rows.push([current.title,s.start,s.end,s.role,s.text,s.reason,Boolean(s.edited)]));
  download(current.title+"-sentences.csv",rows.map(row=>row.map(CSV).join(",")).join("\r\n"),"text/csv");
}
function exportComparison() {
  const rows=[["title","views","likes","saves","shares","comments","cuts_per_minute","opening_roles"]];
  comparison.forEach(p=>rows.push([p.title,p.metrics?.views??"",p.metrics?.likes??"",p.metrics?.saves??"",p.metrics?.shares??"",p.metrics?.comments??"",
    metricSummary(p).cuts === null ? "" : metricSummary(p).cuts.toFixed(2),
    p.segments.filter(s=>s.start<5).map(s=>s.role).join("; ")]));
  download("reel-anatomy-comparison.csv",rows.map(r=>r.map(CSV).join(",")).join("\r\n"),"text/csv");
}
function parseCsvRows(raw) {
  raw=raw.replace(/^\uFEFF/, "");
  const rows=[];let row=[],cell="",quoted=false;
  for(let i=0;i<raw.length;i++){
    const ch=raw[i];
    if(ch==='"' && quoted && raw[i+1]==='"'){cell+='"';i++;continue;}
    if(ch==='"'){quoted=!quoted;continue;}
    if(!quoted && ch===','){row.push(cell);cell="";continue;}
    if(!quoted && (ch==='\n' || ch==='\r')){
      row.push(cell);if(row.some(v=>v.trim()))rows.push(row);
      row=[];cell="";if(ch==='\r' && raw[i+1]==='\n')i++;continue;
    }
    cell+=ch;
  }
  if(quoted) throw Error("CSV contains an unclosed quoted field.");
  row.push(cell);if(row.some(v=>v.trim()))rows.push(row);
  return rows;
}
function normalizedTitle(name) {
  return String(name||"").normalize("NFKC").trim().replace(/\.(mp4|mov|m4v|webm)$/i,"").toLowerCase();
}
async function importMetricsCsv(file) {
  if(dirty)throw Error("Save your corrections before importing metrics.");
  if(file.size>2*1024*1024)throw Error("Metrics CSV exceeds 2 MB.");
  const rows=parseCsvRows(await file.text());
  if(rows.length<2)throw Error("CSV must include a header and at least one data row.");
  const heads=rows.shift().map(s=>s.trim().toLowerCase().replace(/[\s-]+/g,"_"));
  const nameCol=["title","video","filename","name"].map(x=>heads.indexOf(x)).find(x=>x>=0);
  if(nameCol===undefined)throw Error("Include a title, video, filename or name column.");
  const keys=["views","likes","saves","shares","comments"];
  if(!keys.some(key=>heads.includes(key)))throw Error("Include at least one metrics column: views, likes, saves, shares, comments.");
  const all=await Promise.all((await api("/api/projects")).map(p=>api("/api/project/"+p.id)));
  let matched=0, ambiguous=0;
  for(const row of rows){
    const matches=all.filter(p=>normalizedTitle(p.title)===normalizedTitle(row[nameCol]));
    if(matches.length!==1){if(matches.length>1)ambiguous++;continue;}
    const target=matches[0];
    target.metrics=target.metrics||{};
    for(const key of keys){
      const i=heads.indexOf(key);if(i<0 || row[i]===undefined || !row[i].trim())continue;
      const n=Number(row[i].replace(/,/g,""));
      if(!Number.isFinite(n) || n<0)continue;
      target.metrics[key]=Math.floor(n);
    }
    const saved=await api("/api/save",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(target)});
    target.revision=saved.revision;
    if(current && current.id===target.id){current.metrics=target.metrics;current.revision=saved.revision;}
    matched++;
  }
  if(current){renderMetrics();await renderComparison();}
  notice("Metrics imported for "+matched+" of "+rows.length+" rows. "+(ambiguous ? ambiguous+" duplicate titles skipped." : ""));
}
function metricSummary(p) {
  const m=p.metrics||{}, keys=["likes","saves","shares","comments"];
  const complete=keys.every(k=>typeof m[k]==="number" && Number.isFinite(m[k]) && m[k]>=0);
  const engagement=complete && typeof m.views==="number" && m.views>0 ? keys.reduce((a,k)=>a+m[k],0)/m.views*100 : null;
  const cuts=p.duration>0 && p.shots.length>0 ? Math.max(0,p.shots.length-1)/p.duration*60 : null;
  return {engagement,cuts};
}
function reportMarkdown(p) {
  const escape=x=>String(x??"").replace(/\|/g,"\\|").replace(/[\r\n]+/g," ");
  const mix={};p.segments.forEach(x=>mix[x.role]=(mix[x.role]||0)+1);
  const metrics=metricSummary(p);
  const lines=["# "+p.title, "", "Reel Anatomy / local analysis", "",
    "Duration: "+seconds(p.duration)+". Transcript source: "+p.transcript_source+".",
    "Role labels are editable rule-based suggestions, not a measured explanation of performance.",
    "Shot boundaries are visual-change estimates. Shot descriptions are user-reviewed labels.", "",
    "## Structure", "", Object.entries(mix).map(([k,v])=>k+": "+v).join("; ")||"No transcript.",
    "Estimated cuts per minute: "+(metrics.cuts===null?"unavailable":metrics.cuts.toFixed(1)), "",
    "## Speech timeline", "", "| Start | End | Suggested role | Spoken text |", "|---|---|---|---|"];
  p.segments.forEach(x=>lines.push("| "+[seconds(x.start),seconds(x.end),x.role,x.text].map(escape).join(" | ")+" |"));
  lines.push("", "## Shot inventory", "");
  p.shots.forEach((x,i)=>lines.push((i+1)+". "+seconds(x.start)+" to "+seconds(x.end)+": "+x.kind));
  lines.push("", "## Supplied performance", "");
  ["views","likes","saves","shares","comments"].forEach(k=>lines.push(k+": "+(p.metrics?.[k]??"not supplied")));
  lines.push("Engagement / views: "+(metrics.engagement===null?"not available (all four engagement counts and positive views are required)":metrics.engagement.toFixed(2)+"%"),
    "", "These values are user-supplied. Correlation is not evidence of causation.", "", "## Review and test", "",
    "Check the opening against the promised payoff. Review the first demonstration and the final call to action.",
    "To test an edit, change one element and compare against your normal baseline, not only selected successful posts.");
  if(p.notices?.length) lines.push("", "## Limitations", "", ...p.notices.map(x=>"- "+x));
  return lines.join("\n");
}
async function init() {
  try {
    const health=await api("/api/health");
    $("system-status").textContent=health.ffmpeg?(health.speech?"LOCAL ANALYSIS ONLINE":"VIDEO ANALYSIS ONLINE"):"LIMITED ENGINE";
    if (!health.speech) $("upload-hint").textContent="No local transcription package detected. Upload SRT/VTT or paste a transcript; video cut detection is available.";
  } catch {
    $("system-status").textContent="LOCAL ENGINE OFFLINE";notice("Cannot reach the local analyser.");
  }
  await loadLibrary();
  $("new-project").addEventListener("click",showStart);
  $("back-to-library").addEventListener("click",showStart);
  $("save-button").addEventListener("click",()=>saveCorrections().catch(e=>notice(e.message)));
  $("export-json").addEventListener("click",()=>{if(current)download(current.title+"-analysis.json",JSON.stringify(current,null,2),"application/json");});
  $("export-csv").addEventListener("click",exportSentences);
  $("export-report").addEventListener("click",()=>{if(current)download(current.title+"-report.md",reportMarkdown(current),"text/markdown");});
  window.addEventListener("beforeunload",e=>{if(dirty){e.preventDefault();e.returnValue="";}});
  $("export-comparison").addEventListener("click",exportComparison);
  $("import-metrics").addEventListener("change",async e=>{
    const file=e.target.files[0];if(!file)return;
    try{await importMetricsCsv(file);}catch(err){notice(err.message);}finally{e.target.value="";}
  });
  $("player").addEventListener("timeupdate",()=>{$("video-time").textContent=timestamp($("player").currentTime);});
  $("video-file").addEventListener("change",e=>{$("chosen-name").textContent=e.target.files.length>1 ? e.target.files.length+" VIDEOS SELECTED" : (e.target.files[0]?.name || "NO FILE SELECTED");});
  $("captions-file").addEventListener("change",async e=>{
    const f=e.target.files[0];if(f){$("transcript-input").value=await f.text();notice("Imported transcript "+f.name);}
  });
  const drop=$("drop-zone");
  drop.addEventListener("dragover",e=>{e.preventDefault();drop.classList.add("dragover");});
  drop.addEventListener("dragleave",()=>drop.classList.remove("dragover"));
  drop.addEventListener("drop",e=>{
    e.preventDefault();drop.classList.remove("dragover");
    const files=[...e.dataTransfer.files].filter(x=>/\.(mp4|mov|webm|m4v)$/i.test(x.name));
    if(!files.length){notice("Use MP4, MOV, WEBM or M4V files.");return;}
    const dt=new DataTransfer();files.forEach(f=>dt.items.add(f));$("video-file").files=dt.files;
    $("chosen-name").textContent=files.length>1 ? files.length+" VIDEOS SELECTED" : files[0].name;
  });
  $("upload-form").addEventListener("submit",async e=>{
    e.preventDefault();
    const files=[...$("video-file").files];
    if (!files.length){notice("Choose a video first.");return;}
    if(files.some(f=>f.size>200*1024*1024)){notice("One or more videos exceed the 200 MB limit.");return;}
    const transcript=$("transcript-input").value;
    if(files.length>1 && transcript.trim()){notice("For batch imports, leave the shared transcript blank.");return;}
    $("upload-progress").hidden=false;$("analyze-button").disabled=true;
    let completed=0;
    try {
      for(const file of files){
        $("progress-label").textContent="Analysing "+(completed+1)+" of "+files.length+": "+file.name;
        const form=new FormData();form.append("video",file);form.append("transcript",transcript);
        current=await api("/api/analyze",{method:"POST",body:form});completed++;
      }
      $("start-view").hidden=true;$("analysis-view").hidden=false;
      renderCurrent();await loadLibrary();window.scrollTo(0,0);
      notice(completed+" "+(completed===1?"analysis":"analyses")+" saved locally.");
    } catch(err) {notice(completed+" completed; "+err.message);if(completed){$("start-view").hidden=true;$("analysis-view").hidden=false;renderCurrent();await loadLibrary();}}
    finally {$("upload-progress").hidden=true;$("analyze-button").disabled=false;}
  });
}
if(typeof document!=="undefined")init().catch(err=>notice(err.message));
if(typeof module!=="undefined")module.exports={parseCsvRows,normalizedTitle,CSV,metricSummary,reportMarkdown};

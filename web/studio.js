"use strict";
(() => {
  const S={workspace:"default",posts:[],plans:[],plan:null,post:null,planDirty:false,paused:false,jobsKey:"",activeTab:"breakdown",polling:false};
  const el=id=>document.getElementById(id), esc=value=>HTML(value);
  const req=(path,data)=>api("/api/studio/"+path,data===undefined?undefined:{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
  const ws=()=>"workspace="+encodeURIComponent(S.workspace);
  const localDate=value=>{const d=new Date(value||Date.now());return Number.isNaN(d.getTime())?"":new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,19);};
  const iso=value=>value?new Date(value).toISOString():null;
  const dataOf=form=>Object.fromEntries(new FormData(form).entries());
  const links=post=>post.source_url?'<a href="'+esc(post.source_url)+'" target="_blank" rel="noopener noreferrer">Source ↗</a>':"No source link";
  function on(id,event,fn){el(id).addEventListener(event,async ev=>{try{await fn(ev);}catch(error){notice(error.message);const form=ev.target.closest?.("form");if(form){let box=form.querySelector(".form-error");if(!box){box=document.createElement("p");box.className="small-note inline-error form-error";box.setAttribute("role","alert");form.append(box);}box.textContent=error.message;}}});}
  function show(tab){
    S.activeTab=tab;
    for(const name of ["library","patterns","create","results","settings","sanctum","factory"])el("studio-"+name).hidden=tab!==name;
    el("start-view").hidden=tab!=="breakdown"||Boolean(current);
    el("analysis-view").hidden=tab!=="breakdown"||!current;
    document.querySelectorAll("[data-studio-tab]").forEach(b=>{b.classList.toggle("selected",b.dataset.studioTab===tab);b.setAttribute("aria-current",b.dataset.studioTab===tab?"page":"false");});
    if(tab!=="breakdown")el("player").pause();
    window.scrollTo(0,0);
  }
  window.StudioUI={show,refresh:()=>refreshAll(),state:S};
  async function bootstrap(){
    const b=await req("bootstrap");
    const saved=localStorage.getItem("reel-anatomy.research");
    if(saved&&b.research.some(r=>r.id===saved))S.workspace=saved;
    el("research-select").innerHTML=b.research.map(r=>'<option value="'+esc(r.id)+'">'+esc(r.title)+'</option>').join("");el("research-select").value=S.workspace;
    S.research=b.research;S.paused=b.queue_paused;S.config=b.model;renderJobs(b.jobs);
    const research=b.research.find(r=>r.id===S.workspace);el("research-context").textContent=[research?.topic,research?.audience].filter(Boolean).join(" / ");
    el("model-status").textContent=b.model.enabled?"Configured local model: "+b.model.model:"Semantic analysis is not active. The structured planner and media engine work without it.";
    await refreshAll();
  }
  async function refreshAll(){await Promise.all([refreshPosts(),refreshPlans(),refreshResults()]);}
  async function refreshPosts(){
    const r=await req("library?"+ws()+"&q="+encodeURIComponent(el("research-search").value)+"&collection="+encodeURIComponent(el("collection-filter").value));
    S.posts=r.posts;
    const parent=el("research-posts");
    parent.innerHTML=r.posts.length?r.posts.map(p=>'<article class="research-post"><div><span class="pill">'+esc(p.collection)+'</span><span class="pill">'+esc(p.distribution)+'</span><h3>'+esc(p.title)+'</h3><p>'+esc(p.creator||"Creator not entered")+' · '+esc(p.platform)+' · '+timestamp(p.duration)+' · '+p.segment_count+' speech segments</p><p>'+esc(p.cohort||"No topic cohort")+' · '+links(p)+'</p></div><div class="actions"><button class="outline-button" data-open-asset="'+p.asset_id+'">Breakdown</button><button class="outline-button" data-post="'+p.id+'">Metadata & metrics</button><button class="outline-button" disabled title="Automatic semantic analysis requires the desktop edition" data-deep="'+p.id+'">Deep analysis</button></div></article>').join(""):'<div class="empty-state">No posts in this research project yet. Import authorised footage above. Existing single-video analyses appear in My research.</div>';
    parent.querySelectorAll("[data-open-asset]").forEach(b=>b.onclick=()=>openProject(b.dataset.openAsset));
    parent.querySelectorAll("[data-post]").forEach(b=>b.onclick=()=>openPost(b.dataset.post).catch(e=>notice(e.message)));
    parent.querySelectorAll("[data-deep]").forEach(b=>b.onclick=async()=>{try{await req("semantic",{post_id:b.dataset.deep});notice("Local semantic job queued.");await pollJobs();}catch(e){notice(e.message);}});
    // Creation selectors use the entire workspace, not the current search filter.
    const all=(await req("library?"+ws())).posts;
    const own=all.filter(p=>p.collection==="own"||p.collection==="draft");
    for(const id of ["draft-review-post","experiment-post"]){const old=el(id).value;el(id).innerHTML='<option value="">Select our draft or post</option>'+own.map(p=>'<option value="'+p.id+'">'+esc(p.title)+'</option>').join("");if(own.some(p=>p.id===old))el(id).value=old;}
  }
  function renderJobs(jobs){
    el("queue-toggle").textContent=S.paused?"Resume queue":"Pause queue";
    const unfinished=jobs.filter(j=>["queued","running","paused","failed"].includes(j.status));
    const visible=[...unfinished,...jobs.filter(j=>!unfinished.includes(j))].slice(0,50);
    el("queue-list").innerHTML=visible.length?visible.map(j=>'<div class="queue-row" data-state="'+esc(j.status)+'"><div><span class="pill">'+esc(j.status)+'</span><strong>'+esc(j.title)+'</strong><small>'+esc(j.stage)+(j.error?' · '+esc(j.error):'')+'</small>'+(j.result?.reused_analysis?'<small>Reused existing media analysis.</small>':'')+'</div><div class="actions">'+(["paused","failed"].includes(j.status)?'<button class="outline-button" data-job="'+j.id+'" data-action="resume">Resume</button>':'')+(["queued","paused","failed"].includes(j.status)?'<button class="outline-button" data-job="'+j.id+'" data-action="cancel">Cancel</button>':'')+'</div></div>').join(""):'<p class="small-note">The queue is empty.</p>';
    if(jobs.length>50)el("queue-list").insertAdjacentHTML("beforeend",'<p class="small-note">Showing '+visible.length+' of '+jobs.length+' recent jobs, unfinished work first.</p>');
    el("queue-list").querySelectorAll("[data-job]").forEach(b=>b.onclick=async()=>{try{await req("queue",{id:b.dataset.job,action:b.dataset.action});await pollJobs();}catch(e){notice(e.message);}});
  }
  async function pollJobs(){
    if(S.polling)return;S.polling=true;
    try{const r=await req("jobs");S.paused=r.paused;renderJobs(r.jobs);const key=r.jobs.map(j=>j.id+":"+j.status).join("|");if(key!==S.jobsKey){S.jobsKey=key;await refreshAll();await loadLibrary();}}finally{S.polling=false;}
  }
  async function enqueueCollection(event){
    event.preventDefault();const form=event.currentTarget;const files=Array.from(el("queue-files").files);
    if(!files.length)throw Error("Choose video files.");if(files.length>200)throw Error("Submit at most 200 files in one batch.");
    const captions=new Map();for(const f of el("queue-captions").files){const key=normalizedTitle(f.name.replace(/\.(srt|vtt|txt)$/i,""));if(captions.has(key))throw Error("Duplicate subtitle filenames are ambiguous.");if(f.size>200000)throw Error("A subtitle file exceeds 200 KB.");captions.set(key,await f.text());}
    const research=S.research.find(r=>r.id===S.workspace);const values=dataOf(form);
    const metadata={...values,workspace:S.workspace,platform:research.platform,format:research.platform==="youtube"?"short":research.platform==="instagram"?"reel":"video",rights_confirmed:form.elements.rights_confirmed.checked};
    let count=0;el("queue-submit").disabled=true;
    try{for(const file of files){if(file.size>100*1024*1024)throw Error(file.name+" exceeds 100 MB.");const body=new FormData();body.append("video",file);body.append("metadata",JSON.stringify(metadata));body.append("transcript",captions.get(normalizedTitle(file.name))||"");await api("/api/studio/import",{method:"POST",body});count++;el("queue-upload-note").textContent=count+" of "+files.length+" accepted.";}notice(count+" videos entered the durable queue.");el("queue-files").value="";await pollJobs();}catch(e){el("queue-upload-note").textContent=count+" accepted; remaining files were not submitted. "+e.message;throw e;}finally{el("queue-submit").disabled=false;}
  }
  async function openPost(id,reveal=true){
    const changed=S.post?.post?.id!==id;
    const data=await req("post?id="+encodeURIComponent(id));S.post=data;
    const p=data.post;el("post-dialog-title").textContent=p.title;
    const form=el("post-meta-form");for(const key of ["title","creator","cohort","collection","distribution","platform","format","source_url"])form.elements[key].value=p[key]||"";
    form.elements.published_at.value=p.published_at?localDate(p.published_at):"";form.elements.rights_confirmed.checked=p.rights_confirmed;
    const snap=el("snapshot-form");if(changed||!snap.elements.observed_at.value){snap.reset();snap.elements.observed_at.value=localDate();snap.elements.definition.value=p.platform==="other"?"manual_views":p.platform+"_views";}
    el("post-snapshots").innerHTML=data.snapshots.length?'<h3>Observation history</h3>'+data.snapshots.map(x=>'<div class="snapshot-entry"><span class="pill">'+esc(x.window)+'</span>'+esc(x.definition)+' · '+esc(new Date(x.observed_at).toLocaleString())+'<br>'+esc(Object.entries(x.metrics).map(([k,v])=>k+": "+v).join(" · "))+'<br><span class="small-note">Source: '+esc(x.source)+' · supplied, not independently verified</span></div>').join(""):'<p class="small-note">No recorded observations.</p>';
    renderSemantic(data.semantic);
    if(reveal&&!el("post-dialog").open)el("post-dialog").showModal();
  }
  function renderSemantic(a){
    if(!a){el("semantic-output").innerHTML='<p class="small-note">No learned analysis exists for this post. Rule-based labels in Breakdown are not a substitute for it.</p>';return;}
    el("semantic-output").innerHTML='<p class="small-note">'+esc(a.model)+' · '+a.coverage.speech_segments+' segments · '+a.coverage.sampled_frames+' sampled frames. Generated '+esc(new Date(a.generated_at).toLocaleString())+'</p><div class="limits-box">'+a.limits.map(x=>'<p>'+esc(x)+'</p>').join("")+'</div>'+a.summaries.map(x=>'<p>'+esc(x)+'</p>').join("")+
      a.segments.map(x=>'<div class="semantic-entry"><label><input class="semantic-check" type="checkbox" value="'+x.index+'"><span>'+timestamp(x.start)+' · '+esc(x.labels.join(" + "))+'<br>'+esc(x.reason)+'<br><small>Model-reported confidence: '+esc(x.confidence)+', not calibrated</small></span></label></div>').join("")+(a.segments.length?'<button id="apply-semantics" class="outline-button">Apply selected role suggestions</button>':'')+
      a.frames.map(x=>'<div class="semantic-entry"><strong>Sample at '+seconds(x.at)+'</strong> · '+esc(x.framing)+'<p>'+esc(x.description)+'</p></div>').join("")+a.unknowns.map(x=>'<p class="small-note">Unknown: '+esc(x)+'</p>').join("");
    if(el("apply-semantics"))el("apply-semantics").onclick=async()=>{try{const indices=Array.from(document.querySelectorAll(".semantic-check:checked")).map(x=>Number(x.value));await req("apply-semantic",{post_id:S.post.post.id,indices});notice("Applied as model suggestions, not verified labels.");await openPost(S.post.post.id,false);}catch(e){notice(e.message);}};
  }
  async function importCsv(file,kind){
    if(!file)return;if(file.size>2*1024*1024)throw Error("CSV exceeds 2 MB.");
    const result=await req("import-"+kind,{workspace:S.workspace,csv:await file.text()});
    el("csv-import-result").innerHTML='<p>'+result.imported+' of '+result.rows.length+' rows imported.</p>'+result.rows.filter(x=>x.status!=="imported").map(x=>'<p>Row '+x.row+': '+esc(x.reason)+'</p>').join("");await refreshAll();
  }
  function metadataTemplate(){const headers=["post_id","title","creator","cohort","platform","format","collection","distribution","published_at","source_url"];return [headers,...S.posts.map(p=>headers.map(k=>k==="post_id"?p.id:p[k]??""))].map(r=>r.map(CSV).join(",")).join("\r\n");}
  function snapshotTemplate(){return ["post_id,title,window,definition,observed_at,source,views,likes,saves,shares,comments,engaged_views,conversions,average_watch_seconds,retention_3s_pct,completion_pct",...S.posts.map(p=>[p.id,p.title,"72h",p.platform==="other"?"manual_views":p.platform+"_views","","","","","","","","","","","",""].map(CSV).join(","))].join("\r\n");}
  async function patterns(){
    const result=await req("patterns?"+ws()+"&window="+el("pattern-window").value+"&definition="+el("pattern-definition").value);S.patterns=result;
    const num=x=>x===null||x===undefined?"not available":Number(x).toFixed(2)+"×";
    el("pattern-output").innerHTML='<div class="mini-stats"><div><strong>'+result.total_posts+'</strong><span>POSTS IN LIBRARY</span></div><div><strong>'+result.matched_posts+'</strong><span>MATCHED OBSERVATIONS</span></div><div><strong>'+result.creator_n+'</strong><span>CREATORS</span></div></div><div class="limits-box">'+result.limits.map(x=>'<p>'+esc(x)+'</p>').join("")+'</div><p class="small-note">Excluded: '+esc(Object.entries(result.excluded).map(([k,v])=>v+" "+k).join("; ")||"none")+'</p><div class="pattern-grid">'+result.features.map(f=>'<article class="studio-card"><span class="pill">'+esc(f.status)+'</span><h3>'+esc(f.label)+'</h3><div class="pattern-numbers">'+num(f.with_median)+' <small>WITH / </small>'+num(f.without_median)+' <small>WITHOUT</small></div><p class="small-note">Median views relative to each creator baseline. '+f.with_n+' with; '+f.without_n+' without; '+f.creator_n+' creators.</p>'+(f.cluster_bootstrap_95?'<p class="small-note">Creator-cluster bootstrap interval for the median difference: '+f.cluster_bootstrap_95.map(x=>x.toFixed(2)).join(" to ")+'. Exploratory, not causal.</p>':'<p class="small-note">Insufficient evidence for an interval. Add comparable ordinary and weak posts.</p>')+'<p class="small-note">'+(f.unmatched_feature_posts||0)+' posts excluded because their creator/cohort has no comparison with the opposite feature.</p><button class="outline-button" data-use-pattern="'+f.key+'">Use as a test hypothesis</button><strong>Supporting examples</strong>'+f.support.map(p=>'<button class="evidence-link" data-evidence="'+p.asset_id+'">'+esc(p.title)+' · '+num(p.relative_views)+'</button>').join("")+'<strong>Counterexamples</strong>'+(f.counterexamples.length?f.counterexamples.map(p=>'<button class="evidence-link" data-evidence="'+p.asset_id+'">'+esc(p.title)+' · '+num(p.relative_views)+'</button>').join(""):'<p class="small-note">None in this selected sample; that is not proof that none exist.</p>')+(f.temporal_check?'<p class="small-note">Temporal diagnostic: '+f.temporal_check.older_n+' older vs '+f.temporal_check.later_n+' later observations. Not a validated predictor.</p>':'')+'</article>').join("")+'</div><div class="actions"><button id="export-patterns" class="outline-button">Export evidence report</button></div>';
    el("pattern-output").querySelectorAll("[data-evidence]").forEach(b=>b.onclick=()=>openProject(b.dataset.evidence));el("export-patterns").onclick=()=>download("reel-anatomy-patterns.json",JSON.stringify(result,null,2),"application/json");
    el("pattern-output").querySelectorAll("[data-use-pattern]").forEach(b=>b.onclick=()=>{
      el("brief-pattern").value=b.dataset.usePattern;
      el("brief-pattern-window").value=result.window;
      el("brief-pattern-definition").value=result.definition;
      show("create");
      const research=S.research.find(r=>r.id===S.workspace),form=el("brief-form");
      if(!form.elements.topic.value)form.elements.topic.value=research.topic||"";
      if(!form.elements.audience.value)form.elements.audience.value=research.audience||"";
      if(!form.elements.goal.value)form.elements.goal.value=research.objective||"";
      notice("Pattern selected as a hypothesis. Supporting evidence and limitations will be saved with the brief.");
    });
  }

  async function refreshPlans(){
    S.plans=(await req("plans?"+ws())).plans;
    for(const id of ["plan-select","experiment-plan"]){const old=el(id).value;el(id).innerHTML='<option value="">Choose a saved brief</option>'+S.plans.map(p=>'<option value="'+p.id+'">'+esc(p.brief.topic)+' · v'+p.revision+'</option>').join("");if(S.plans.some(p=>p.id===old))el(id).value=old;}
    if(S.plan&&!S.planDirty){const newer=S.plans.find(p=>p.id===S.plan.id);if(newer&&newer.revision!==S.plan.revision)renderPlan(newer);}
  }
  function planChanged(){S.planDirty=true;if(el("plan-save-state"))el("plan-save-state").textContent="UNSAVED EDITS";}
  function gatherPlan(){
    const copy=structuredClone(S.plan);
    el("plan-output").querySelectorAll("[data-beat]").forEach(input=>{copy.beats[Number(input.dataset.beat)][input.dataset.field]=input.value;});
    copy.hypothesis=el("plan-hypothesis").value;return copy;
  }
  function renderPlan(plan){
    S.plan=plan;S.planDirty=false;el("plan-select").value=plan.id;
    const refs=plan.references.length?plan.references.map(r=>'<p><button class="evidence-link" data-ref="'+r.asset_id+'">'+esc(r.title)+'</button><span class="small-note">'+esc(r.role_sequence.join(" → "))+' · '+esc(r.evidence_class)+'</span></p>').join(""):'<p class="small-note">No relevant reference examples were found. This brief is based on your supplied facts and a planning template, not a discovered performance pattern.</p>';
    el("plan-output").innerHTML='<article class="studio-card plan-editor"><div class="section-top"><div><span class="kicker">FILMING BRIEF / REVISION '+plan.revision+'</span><h2>'+esc(plan.brief.topic)+'</h2></div><span id="plan-save-state" class="pill">SAVED</span></div><p class="small-note">Engine: '+esc(plan.engine)+' · Audience: '+esc(plan.brief.audience)+' · Goal: '+esc(plan.brief.goal)+'</p>'+(plan.pattern_basis?'<div class="limits-box"><strong>Selected hypothesis: '+esc(plan.pattern_basis.feature.label)+'</strong><p>'+esc(plan.pattern_basis.feature.status)+' · '+plan.pattern_basis.feature.with_n+' with / '+plan.pattern_basis.feature.without_n+' without · '+esc(plan.pattern_basis.window)+'</p><p>'+esc(plan.suggested_change)+'</p><p>Supporting examples and counterexamples are frozen with this brief, not promoted to causal proof.</p></div>':'')+'<h3>Three openings to test</h3><div class="plan-openings">'+plan.openings.map((o,i)=>'<button type="button" class="opening-option" data-opening="'+i+'"><strong>'+esc(o.name)+'</strong>'+esc(o.spoken)+'</button>').join("")+'</div><p class="small-note">Selecting an opening changes the first beat and the proposed hypothesis. It does not make that opening a proven winner.</p>'+plan.beats.map((b,i)=>'<div class="plan-beat"><div class="beat-time"><strong>'+seconds(b.start)+' → '+seconds(b.end)+'</strong><span>'+esc(b.role)+'</span></div><div><label>Spoken script<textarea data-beat="'+i+'" data-field="spoken" rows="2">'+esc(b.spoken)+'</textarea></label><label>Shot / visual direction<textarea data-beat="'+i+'" data-field="visual" rows="2">'+esc(b.visual)+'</textarea></label><label>On-screen text<input data-beat="'+i+'" data-field="on_screen" value="'+esc(b.on_screen)+'"></label></div></div>').join("")+'<label class="hypothesis-label">TESTABLE HYPOTHESIS<textarea id="plan-hypothesis" rows="3">'+esc(plan.hypothesis)+'</textarea></label><p class="small-note">Primary metric: '+esc(plan.primary_metric)+'</p><div class="actions"><button id="save-plan" class="primary-button">Save brief</button><button id="export-filming-html" class="outline-button">Export phone-friendly filming brief</button><button id="export-filming-md" class="outline-button">Export Markdown</button><button id="refine-plan" disabled title="Use the desktop edition for learned refinement" class="outline-button">Desktop refinement</button></div><details><summary>Reference structures and evidence limits</summary>'+refs+'<div class="limits-box">'+plan.limits.map(x=>'<p>'+esc(x)+'</p>').join("")+'</div></details><details><summary>Saved revision history ('+plan.history.length+')</summary>'+plan.history.map((h,i)=>'<p>Revision '+h.revision+' · '+esc(new Date(h.saved_at).toLocaleString())+' <button class="outline-button" data-restore="'+i+'">Restore as new edit</button></p>').join("")+'</details></article>';
    el("plan-output").querySelectorAll("textarea,input[data-beat]").forEach(input=>input.addEventListener("input",planChanged));
    el("plan-output").querySelectorAll("[data-opening]").forEach(b=>b.onclick=()=>{const next=gatherPlan(),opening=next.openings[Number(b.dataset.opening)];next.beats[0].spoken=opening.spoken;next.beats[0].visual=opening.visual;next.hypothesis=opening.hypothesis;renderPlan(next);planChanged();});
    el("plan-output").querySelectorAll("[data-ref]").forEach(b=>b.onclick=()=>openProject(b.dataset.ref));
    el("plan-output").querySelectorAll("[data-restore]").forEach(b=>b.onclick=()=>{const next=gatherPlan(),h=next.history[Number(b.dataset.restore)];next.beats=structuredClone(h.beats);next.hypothesis=h.hypothesis;renderPlan(next);planChanged();});
    el("save-plan").onclick=async()=>{try{renderPlan(await req("save-plan",gatherPlan()));await refreshPlans();notice("Filming brief saved with revision history.");}catch(e){notice(e.message);}};
    el("export-filming-html").onclick=()=>{const p=gatherPlan();download("filming-brief.html",filmingHtml(p),"text/html");};
    el("export-filming-md").onclick=()=>{const p=gatherPlan();download("filming-brief.md",filmingMarkdown(p),"text/markdown");};
    el("refine-plan").onclick=async()=>{try{if(S.planDirty)throw Error("Save your brief before requesting refinement.");await req("enrich-plan",{plan_id:S.plan.id});notice("Local refinement queued. No cloud fallback will be used.");await pollJobs();}catch(e){notice(e.message);}};
  }
  function filmingMarkdown(p){
    const lines=["# "+p.brief.topic,"","Audience: "+p.brief.audience,"Goal: "+p.brief.goal,"Engine: "+p.engine,"Revision: "+p.revision+(S.planDirty?" (unsaved export)":""),"","## Hypothesis","",p.hypothesis,"","## Filming sequence",""];
    p.beats.forEach(b=>lines.push("### "+seconds(b.start)+" to "+seconds(b.end)+" / "+b.role,"","Say: "+b.spoken,"","Show: "+b.visual,"","On screen: "+b.on_screen,""));
    lines.push("## Checklist","",...p.checklist.map(x=>"- [ ] "+x),"","## Reference structures","");
    p.references.forEach(r=>lines.push(r.title+": "+r.role_sequence.join(" → ")+". "+r.evidence_class+". "+r.source_url));
    if(p.pattern_basis){
      const f=p.pattern_basis.feature;
      lines.push("","## Selected pattern hypothesis","",f.label+" / "+f.status,"",p.suggested_change,"",f.with_n+" with and "+f.without_n+" without; window "+p.pattern_basis.window+"; definition "+p.pattern_basis.definition,"","Supporting examples: "+f.support.map(x=>x.title).join("; "),"Counterexamples: "+f.counterexamples.map(x=>x.title).join("; "));
    }
    lines.push("","## Limits","",...p.limits.map(x=>"- "+x));return lines.join("\n");
  }
  window.StudioUI.mobileBrief=()=>{if(!S.plan)return null;const p=gatherPlan();return {id:p.id,title:p.brief.topic,revision:p.revision,html:filmingHtml(p)};};
  function filmingHtml(p){
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(p.brief.topic)+' / Filming brief</title><style>body{margin:0 auto;padding:28px 20px;max-width:780px;background:#f6f3eb;color:#282820;font:17px/1.6 Georgia,serif}h1{font-size:42px;line-height:1.1}small,header,label{font:12px/1.5 Arial,sans-serif;color:#6b675c}section{border-top:1px solid #c8c2b3;padding:22px 0}strong{color:#a64a2d}p{overflow-wrap:anywhere}input{width:19px;height:19px}label{display:block;padding:7px 0}@media print{body{background:white}.beat{break-inside:avoid}}</style></head><body><header>REEL ANATOMY / FILMING BRIEF / v'+p.revision+(S.planDirty?' / UNSAVED EXPORT':'')+'</header><h1>'+esc(p.brief.topic)+'</h1><p><strong>Audience:</strong> '+esc(p.brief.audience)+'<br><strong>Goal:</strong> '+esc(p.brief.goal)+'</p><p><strong>Test:</strong> '+esc(p.hypothesis)+'</p><small>'+esc(p.engine)+' · Planning suggestions, not predicted results.</small>'+p.beats.map(b=>'<section class="beat"><small>'+seconds(b.start)+'–'+seconds(b.end)+' / '+esc(b.role)+'</small><p><strong>SAY</strong><br>'+esc(b.spoken)+'</p><p><strong>SHOW</strong><br>'+esc(b.visual)+'</p><p><strong>ON SCREEN</strong><br>'+esc(b.on_screen)+'</p></section>').join("")+'<section><h2>Before publishing</h2>'+p.checklist.map(x=>'<label><input type="checkbox"> '+esc(x)+'</label>').join("")+'</section><section><h2>Evidence and limits</h2>'+(p.pattern_basis?'<p><strong>Selected hypothesis:</strong> '+esc(p.pattern_basis.feature.label)+' / '+esc(p.pattern_basis.feature.status)+'</p><p>'+esc(p.suggested_change)+'</p>':'')+p.references.map(r=>'<p>'+esc(r.title)+': '+esc(r.role_sequence.join(" → "))+'. '+esc(r.evidence_class)+'.</p>').join("")+p.limits.map(x=>'<p>'+esc(x)+'</p>').join("")+'</section></body></html>';
  }
  function outcomeHtml(o){
    if(!o)return "";
    const value=n=>n===null||n===undefined?"unknown":Number(n).toLocaleString(undefined,{maximumFractionDigits:2});
    return '<div class="limits-box"><strong>Measured outcome / '+esc(o.metric)+'</strong><p>'+value(o.value)+' '+esc(o.unit)+(o.window?' at '+esc(o.window):'')+'</p><p>Earlier own-post baseline: '+value(o.baseline_median)+' ('+o.baseline_n+' posts). Difference: '+value(o.difference)+(o.unit==='%'?' percentage points':'')+'.</p><p>'+esc(o.note)+'</p></div>';
  }
  async function refreshResults(){
    const results=(await req("results?"+ws())).experiments;
    el("experiment-output").innerHTML=results.length?results.map(x=>'<article class="studio-card experiment-card"><span class="pill">'+esc(x.status)+'</span><span class="pill">FROZEN BRIEF v'+x.plan_revision+'</span><h3>'+esc(x.change)+'</h3><p><strong>Hypothesis:</strong> '+esc(x.hypothesis)+'</p><p><strong>Primary metric:</strong> '+esc(x.primary_metric)+' at '+esc(x.window||'72h')+'</p><p class="small-note">Recorded '+esc(new Date(x.created_at).toLocaleString())+'. Organic distribution comparisons are not randomised A/B tests.</p><button class="outline-button" data-result-post="'+x.post_id+'">Post metadata & observations</button>'+(x.status==="planned"?'<button class="outline-button" data-publish="'+x.id+'">Mark as published</button>':'')+'<div>'+x.snapshots.map(s=>'<div class="snapshot-entry">'+esc(s.window)+' · '+esc(s.definition)+' · '+esc(Object.entries(s.metrics).map(([k,v])=>k+": "+v).join(" / "))+'<br><span class="small-note">'+esc(s.observed_at)+' · '+esc(s.source)+'</span></div>').join("")+'</div>' + outcomeHtml(x.outcome) +(x.status!=="planned"?'<label class="hypothesis-label">What happened and what did we learn?<textarea class="experiment-assessment" data-assessment="'+x.id+'" maxlength="4000">'+esc(x.assessment||"")+'</textarea></label><button class="outline-button" data-assess="'+x.id+'">Save outcome review</button>':'<p class="small-note">Before marking published, update the post collection and actual publication time. The hypothesis must predate publication.</p>')+'</article>').join(""):'<div class="empty-state">No tests recorded yet. Create a filming brief, import our draft, then record one change and a hypothesis before publication.</div>';
    el("experiment-output").querySelectorAll("[data-result-post]").forEach(b=>b.onclick=()=>openPost(b.dataset.resultPost).catch(e=>notice(e.message)));
    el("experiment-output").querySelectorAll("[data-publish]").forEach(b=>b.onclick=async()=>{try{const x=results.find(x=>x.id===b.dataset.publish);await req("update-experiment",{id:x.id,revision:x.revision,status:"published"});await refreshResults();notice("Publication recorded. Original hypothesis and brief remain frozen.");}catch(e){notice(e.message);}});
    el("experiment-output").querySelectorAll("[data-assess]").forEach(b=>b.onclick=async()=>{try{const x=results.find(x=>x.id===b.dataset.assess);await req("update-experiment",{id:x.id,revision:x.revision,status:"reviewed",assessment:el("experiment-output").querySelector('[data-assessment="'+x.id+'"]').value});await refreshResults();notice("Outcome review retained.");}catch(e){notice(e.message);}});
  }
  async function refreshModels(){
    el("model-status").textContent="Checking the local model service…";const r=await req("models");
    el("model-status").textContent=r.note;
    el("model-select").innerHTML=r.models.length?r.models.map(m=>'<option value="'+esc(m.name)+'">'+esc(m.name)+' / '+(m.size/1e9).toFixed(1)+' GB</option>').join(""):'<option value="">No installed local model found</option>';
    if(r.configured?.enabled)el("model-select").value=r.configured.model;
    el("model-enable").checked=r.configured?.enabled||false;
  }
  async function initStudio(){
    document.querySelectorAll("[data-studio-tab]").forEach(b=>b.onclick=()=>{show(b.dataset.studioTab);if(b.dataset.studioTab==="results")refreshResults().catch(e=>notice(e.message));});
    on("research-select","change",async ev=>{if(S.planDirty&&!confirm("Discard unsaved brief edits before changing research projects?")){ev.target.value=S.workspace;return;}S.workspace=ev.target.value;localStorage.setItem("reel-anatomy.research",S.workspace);S.plan=null;S.planDirty=false;el("plan-output").innerHTML="";el("pattern-output").innerHTML="";const r=S.research.find(x=>x.id===S.workspace);el("research-context").textContent=[r.topic,r.audience].filter(Boolean).join(" / ");await refreshAll();});
    on("new-research","click",()=>{show("library");el("research-form").hidden=!el("research-form").hidden;});
    on("research-form","submit",async ev=>{ev.preventDefault();const form=ev.currentTarget;const r=await req("research",dataOf(form));S.workspace=r.id;localStorage.setItem("reel-anatomy.research",r.id);form.reset();form.hidden=true;await bootstrap();show("library");notice("Research project created.");});
    on("queue-form","submit",enqueueCollection);
    on("queue-toggle","click",async()=>{await req("queue",{action:S.paused?"resume_all":"pause_all"});await pollJobs();});
    let searchTimer;on("research-search","input",()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>refreshPosts().catch(e=>notice(e.message)),180);});on("collection-filter","change",refreshPosts);
    on("close-post-dialog","click",()=>el("post-dialog").close());
    on("post-meta-form","submit",async ev=>{ev.preventDefault();const values=dataOf(ev.currentTarget);const p=await req("metadata",{...S.post.post,...values,published_at:iso(values.published_at),rights_confirmed:ev.currentTarget.elements.rights_confirmed.checked});await openPost(p.id,false);await refreshAll();notice("Metadata saved.");});
    on("snapshot-form","submit",async ev=>{ev.preventDefault();const form=ev.currentTarget,values=dataOf(form),metrics={};for(const key of ["views","engaged_views","likes","saves","shares","comments","conversions","average_watch_seconds","retention_3s_pct","completion_pct"])if(values[key]!=="")metrics[key]=Number(values[key]);await req("snapshot",{post_id:S.post.post.id,window:values.window,definition:values.definition,observed_at:iso(values.observed_at),source:values.source,metrics});form.reset();await openPost(S.post.post.id,false);await refreshResults();notice("Observation appended. Previous observations remain intact.");});
    on("deep-analyse-post","click",async()=>{await req("semantic",{post_id:S.post.post.id});notice("Semantic job queued. Refresh this post after it completes.");await pollJobs();});
    on("research-metadata-csv","change",async ev=>{await importCsv(ev.target.files[0],"metadata");ev.target.value="";});on("research-snapshot-csv","change",async ev=>{await importCsv(ev.target.files[0],"snapshots");ev.target.value="";});
    on("export-library-template","click",()=>download("post-metadata.csv",metadataTemplate(),"text/csv"));on("export-snapshot-template","click",()=>download("performance-snapshots.csv",snapshotTemplate(),"text/csv"));
    on("export-research","click",async()=>download("research-library.json",JSON.stringify(await req("export?"+ws()),null,2),"application/json"));
    on("find-patterns","click",patterns);
    on("brief-form","submit",async ev=>{ev.preventDefault();if(S.planDirty&&!confirm("Discard unsaved edits and create a new brief?"))return;const values=dataOf(ev.currentTarget);const p=await req("plan",{...values,duration:Number(values.duration),workspace:S.workspace});await refreshPlans();renderPlan(p);el("plan-output").scrollIntoView({behavior:"smooth"});notice("Original filming brief saved.");});
    on("load-plan","click",()=>{if(S.planDirty&&!confirm("Discard unsaved brief edits?"))return;const p=S.plans.find(p=>p.id===el("plan-select").value);if(!p)throw Error("Choose a saved brief.");renderPlan(structuredClone(p));});
    on("draft-review-form","submit",async ev=>{ev.preventDefault();if(!S.plan)throw Error("Open a filming brief first.");if(S.planDirty)throw Error("Save the brief before comparing it with a draft.");const r=await req("review",{plan_id:S.plan.id,post_id:el("draft-review-post").value});el("draft-review-output").innerHTML=r.observations.map(o=>'<div class="review-observation"><span class="pill">'+esc(o.kind)+'</span>'+esc(o.message)+(o.at!==null?'<button class="evidence-link" data-review-asset="'+o.asset_id+'" data-review-time="'+o.at+'">Inspect '+timestamp(o.at)+'</button>':'')+'</div>').join("");el("draft-review-output").querySelectorAll("[data-review-asset]").forEach(b=>b.onclick=async()=>{await openProject(b.dataset.reviewAsset);seek(Number(b.dataset.reviewTime));});});
    on("experiment-form","submit",async ev=>{ev.preventDefault();const values=dataOf(ev.currentTarget);for(const k of ["hypothesis","primary_metric"])if(!values[k])delete values[k];await req("experiment",{...values,plan_id:el("experiment-plan").value,post_id:el("experiment-post").value});await refreshResults();notice("Prospective test recorded with a frozen brief.");});
    on("refresh-models","click",refreshModels);on("model-form","submit",async ev=>{ev.preventDefault();const r=await req("configure",{enabled:el("model-enable").checked,model:el("model-select").value});S.config=r;el("model-status").textContent=r.enabled?"Enabled: "+r.model+". Jobs run only when requested.":"Semantic model disabled.";notice("Local model setting saved.");});
    window.addEventListener("beforeunload",ev=>{if(S.planDirty){ev.preventDefault();ev.returnValue="";}});
    await bootstrap();
    setInterval(()=>{if(!document.hidden)pollJobs().catch(()=>{});},4000);
  }
  window.StudioUI.ready=initStudio().catch(e=>notice(e.message));
})();

/* Local visual composition using native Canvas, Web Audio and MediaRecorder. */
export function captionCues(scenes){
  const out=[];
  for(const scene of scenes){
    const words=String(scene.spoken||'').trim().split(/\s+/).filter(Boolean);if(!words.length)continue;
    const groups=[];let group=[];
    for(const word of words){if(group.length&&((group.join(' ')+' '+word).length>66||group.length>=11)){groups.push(group.join(' '));group=[];}group.push(word);}if(group.length)groups.push(group.join(' '));
    const weights=groups.map(x=>x.split(/\s+/).length);const total=weights.reduce((a,b)=>a+b,0);let at=scene.start;
    groups.forEach((line,i)=>{const end=i===groups.length-1?scene.end:at+(scene.end-scene.start)*weights[i]/total;out.push({start:at,end,text:line,scene:scene.index});at=end;});
  }
  return out;
}
const stamp=n=>{const ms=Math.round(n*1000);return [Math.floor(ms/3600000),Math.floor(ms/60000)%60,Math.floor(ms/1000)%60].map(x=>String(x).padStart(2,'0')).join(':')+','+String(ms%1000).padStart(3,'0');};
export function srtText(scenes,track=null){return (track?.cues||captionCues(scenes)).map((x,i)=>(i+1)+'\n'+stamp(x.start)+' --> '+stamp(x.end)+'\n'+x.text+'\n').join('\n');}
export function chooseMime(Recorder=globalThis.MediaRecorder){
  if(!Recorder)return null;
  return ['video/mp4;codecs=avc1.42001E,mp4a.40.2','video/mp4','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(t=>Recorder.isTypeSupported(t))||null;
}
export function wrapped(ctx,text,maxWidth){
  const lines=[];let line='';
  for(const word of String(text||'').split(/\s+/).filter(Boolean)){
    if(ctx.measureText(word).width>maxWidth){
      if(line){lines.push(line);line='';}let part='';
      for(const ch of word){if(ctx.measureText(part+ch).width>maxWidth){lines.push(part);part='';}part+=ch;}line=part;continue;
    }
    const next=line?line+' '+word:word;
    if(line&&ctx.measureText(next).width>maxWidth){lines.push(line);line=word;}else line=next;
  }
  if(line)lines.push(line);return lines;
}
function textBlock(ctx,text,x,y,width,height,size,{family='Georgia',colour='#f6f3eb',align='left',weight='400'}={}){
  let lines=[];
  while(size>=22){ctx.font=weight+' '+size+'px '+family;lines=wrapped(ctx,text,width);if(lines.length*size*1.22<=height)break;size-=2;}
  if(lines.length*size*1.22>height)throw Error('Text does not fit this frame. Shorten the on-screen text.');
  ctx.fillStyle=colour;ctx.textAlign=align;ctx.textBaseline='top';
  lines.forEach((line,i)=>ctx.fillText(line,align==='center'?x+width/2:x,y+i*size*1.22));return lines.length*size*1.22;
}
export function drawFrame(canvas,p,time,media=new Map(),{safeGuides=false}={}){
  const ctx=canvas.getContext('2d',{alpha:false});ctx.save();ctx.scale(canvas.width/1080,canvas.height/1920);
  const scene=p.variant.scenes.find(s=>time>=s.start&&time<s.end)||p.variant.scenes.at(-1);
  const visual=scene.media?media.get(scene.media.sha256)?.element:null;
  ctx.fillStyle='#eeeae1';ctx.fillRect(0,0,1080,1920);
  if(visual){
    const vw=visual.videoWidth||visual.naturalWidth,vh=visual.videoHeight||visual.naturalHeight;
    if(vw&&vh){
      const factor=scene.fit==='contain'?Math.min(1080/vw,1920/vh):Math.max(1080/vw,1920/vh);
      const w=vw*factor,h=vh*factor;ctx.drawImage(visual,(1080-w)/2,(1920-h)/2,w,h);
    }
    ctx.fillStyle='rgba(20,22,20,.79)';ctx.fillRect(45,145,990,350);
    textBlock(ctx,scene.on_screen||scene.role,85,200,910,245,76,{colour:'#faf8f1',family:'Arial',weight:'700'});
  }else{
    ctx.strokeStyle='#c1baac';ctx.lineWidth=2;ctx.strokeRect(48,145,984,1590);
    ctx.fillStyle='#aa492c';ctx.fillRect(84,245,100,5);
    textBlock(ctx,scene.on_screen||scene.role,84,330,900,670,105,{colour:'#282924'});
    ctx.font='400 340px Georgia';ctx.fillStyle='rgba(40,41,36,.06)';ctx.textAlign='right';ctx.fillText(String(scene.index+1).padStart(2,'0'),1000,1270);
  }
  const dark=!!visual;
  ctx.fillStyle=dark?'#ffffff':'#4c4a42';ctx.font='26px Arial';ctx.textAlign='left';ctx.fillText('REEL ANATOMY  /  '+p.variant.key,84,105);
  const cue=(p.variant.timed_captions?.cues||captionCues([scene])).find(c=>time>=c.start&&time<c.end);
  if(cue){ctx.fillStyle='rgba(22,24,22,.9)';ctx.fillRect(72,1370,936,260);textBlock(ctx,cue.text,105,1414,870,180,52,{family:'Arial',weight:'600',align:'center'});}
  const refs=scene.claim_ids.flatMap(id=>p.evidence.claims.find(c=>c.id===id)?.links?.map(l=>l.citation)||[]);
  ctx.fillStyle=dark?'#ffffff':'#696355';ctx.font='23px Arial';ctx.textAlign='left';ctx.fillText([...new Set(refs)].slice(0,3).join(' · '),84,1690);
  ctx.fillStyle='#aa492c';ctx.fillRect(84,1750,912*Math.min(1,time/p.duration),5);
  if(p.mode!=='reviewed'){ctx.fillStyle='#922c1d';ctx.fillRect(650,70,350,60);ctx.fillStyle='#fff';ctx.font='bold 24px Arial';ctx.textAlign='center';ctx.fillText('DRAFT · REVIEW REQUIRED',825,111);}
  if(safeGuides){ctx.strokeStyle='#a34d30';ctx.setLineDash([10,10]);ctx.strokeRect(72,180,936,1500);ctx.setLineDash([]);}
  ctx.restore();return scene;
}
function waitEvent(el,event,timeout=15000){return new Promise((resolve,reject)=>{const done=()=>{cleanup();resolve();},error=()=>{cleanup();reject(Error('Local media could not be decoded.'));};const timer=setTimeout(()=>{cleanup();reject(Error('Local media decoding timed out.'));},timeout);function cleanup(){clearTimeout(timer);el.removeEventListener(event,done);el.removeEventListener('error',error);}el.addEventListener(event,done,{once:true});el.addEventListener('error',error,{once:true});});}
export async function loadAssets(p,getBlob){
  const media=new Map();
  try{
    for(const s of p.variant.scenes){
      if(!s.media||media.has(s.media.sha256))continue;
      const blob=await getBlob(s.media.sha256);if(!blob)throw Error('Reattach the local file: '+s.media.name);
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
      if(hash!==s.media.sha256)throw Error('Local visual hash differs from the reviewed asset.');
      const url=URL.createObjectURL(blob);const element=s.media.type.startsWith('video/')?document.createElement('video'):new Image();
      media.set(s.media.sha256,{element,url});
      if(s.media.type.startsWith('video/')){element.muted=true;element.playsInline=true;element.preload='auto';const waiting=waitEvent(element,'loadeddata');element.src=url;await waiting;}
      else{const waiting=waitEvent(element,'load');element.src=url;await waiting;}
    }
    return media;
  }catch(error){releaseAssets(media);throw error;}
}
export function releaseAssets(media){for(const x of media.values()){if(x.element.tagName==='VIDEO'){x.element.pause();x.element.removeAttribute('src');x.element.load();}URL.revokeObjectURL(x.url);}media.clear();}
export async function seekPreview(p,at,media){
  const scene=p.variant.scenes.find(s=>at>=s.start&&at<s.end)||p.variant.scenes.at(-1);const x=scene.media&&media.get(scene.media.sha256);
  if(x?.element.tagName==='VIDEO'){
    const target=Math.min(x.element.duration-.03,scene.clip_in+Math.max(0,at-scene.start));
    if(Math.abs(x.element.currentTime-target)>.03){const wait=waitEvent(x.element,'seeked');x.element.currentTime=Math.max(0,target);await wait;}
  }
}
export async function renderReel(p,getBlob,{width=720,signal,onProgress,canvas:providedCanvas}={}){
  if(![360,720,1080].includes(width))throw Error('Choose 360, 720 or 1080 output width.');
  const mime=chooseMime();if(!mime)throw Error('This browser has no supported video recorder. Export the production package for the desktop renderer.');
  if(document.hidden)throw Error('Keep this app visible during video export.');
  if(signal?.aborted)throw Error('Export cancelled.');
  const canvas=providedCanvas||document.createElement('canvas');canvas.width=width;canvas.height=width*16/9;
  if(!canvas.captureStream)throw Error('Canvas video capture is not supported. Use the desktop renderer.');
  let media=new Map(),audioCtx,source,stream,recorder,frame,timer,hidden=false,recordingError=null;
  const chunks=[];let finish;const stopped=new Promise(resolve=>{finish=resolve;});
  const visibility=()=>{if(document.hidden){hidden=true;stop();}};
  const stop=()=>{if(recorder&&recorder.state!=='inactive')recorder.stop();};
  try{
    media=await loadAssets(p,getBlob);
    if(signal?.aborted||document.hidden)throw Error('Export cancelled or backgrounded before recording. No completed file was saved.');
    drawFrame(canvas,p,0,media);
    stream=canvas.captureStream(30);
    if(p.variant.narration){
      const audio=await getBlob(p.variant.narration.sha256);if(!audio)throw Error('Reattach the narration file.');
      const bytes=await audio.arrayBuffer();const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
      if(hash!==p.variant.narration.sha256)throw Error('Narration differs from the reviewed audio.');
      audioCtx=new AudioContext();await audioCtx.resume();if(audioCtx.state!=='running')throw Error('Tap export again to enable local audio playback.');
      const decoded=await audioCtx.decodeAudioData(bytes);source=audioCtx.createBufferSource();source.buffer=decoded;
      const destination=audioCtx.createMediaStreamDestination();source.connect(destination);destination.stream.getAudioTracks().forEach(t=>stream.addTrack(t));
    }
    if(signal?.aborted||document.hidden)throw Error('Export cancelled or backgrounded before recording. No completed file was saved.');
    recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:width===1080?8000000:width===720?5000000:1600000,audioBitsPerSecond:192000});
    recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
    recorder.onerror=event=>{recordingError=event.error||Error('The encoder failed.');stop();finish();};recorder.onstop=()=>finish();
    signal?.addEventListener('abort',stop,{once:true});document.addEventListener('visibilitychange',visibility);
    if(signal?.aborted)throw Error('Export cancelled before recording.');
    recorder.start(500);const start=performance.now();source?.start();
    let lastScene=-1,lastTick=start;
    function tick(){
      try{
        if(recorder.state==='inactive')return;
        const current=performance.now(),time=(current-start)/1000;
        if(current-lastTick>1500){recordingError=Error('Rendering stalled. No completed video is claimed; keep the app active and retry.');stop();return;}lastTick=current;
        if(time>=p.duration){drawFrame(canvas,p,p.duration-.001,media);stop();return;}
        const scene=p.variant.scenes.find(s=>time>=s.start&&time<s.end)||p.variant.scenes.at(-1);
        if(scene.index!==lastScene){
          for(const x of media.values())if(x.element.tagName==='VIDEO')x.element.pause();
          const x=scene.media&&media.get(scene.media.sha256);
          if(x?.element.tagName==='VIDEO'){x.element.currentTime=scene.clip_in+Math.max(0,time-scene.start);x.element.play().catch(error=>{recordingError=error;stop();});}
          lastScene=scene.index;
        }
        drawFrame(canvas,p,time,media);onProgress?.(Math.min(1,time/p.duration));frame=requestAnimationFrame(tick);
      }catch(error){recordingError=error;stop();}
    }
    frame=requestAnimationFrame(tick);timer=setTimeout(()=>{recordingError=Error('Export exceeded its runtime budget.');stop();},(p.duration+15)*1000);
    await stopped;
    if(signal?.aborted)throw Error('Export cancelled. No partial file was marked complete.');
    if(hidden)throw Error('Export paused by backgrounding. Keep the app visible and retry; no complete file was saved.');
    if(recordingError)throw recordingError;
    const blob=new Blob(chunks,{type:recorder.mimeType});if(blob.size<1024)throw Error('Encoder returned an empty or incomplete video.');
    const actualMime=recorder.mimeType;const extension=actualMime.includes('mp4')?'mp4':'webm';
    const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
    onProgress?.(1);return {blob,mime:actualMime,extension,sha256,width,height:canvas.height,duration:p.duration,bytes:blob.size};
  }finally{
    clearTimeout(timer);cancelAnimationFrame(frame);signal?.removeEventListener('abort',stop);document.removeEventListener('visibilitychange',visibility);
    if(recorder?.state!=='inactive')try{recorder?.stop();}catch{}
    try{source?.stop();}catch{}stream?.getTracks().forEach(t=>t.stop());if(audioCtx)await audioCtx.close();releaseAssets(media);
  }
}

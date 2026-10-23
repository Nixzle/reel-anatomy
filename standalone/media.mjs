// Browser-native inspection. No network uploads, speech model or external decoder.
export async function inspectVideo(file) {
  const video=document.createElement('video');
  video.muted=true;video.playsInline=true;video.preload='auto';
  const url=URL.createObjectURL(file);video.src=url;
  const wait=(event,timeout=12000)=>new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>finish(Error('Video decoding timed out. Try H.264 MP4 or import desktop analysis.')),timeout);
    const onError=()=>finish(Error('This browser cannot decode that video. Convert it on desktop to H.264 MP4.'));
    function finish(error){clearTimeout(timer);video.removeEventListener(event,onReady);video.removeEventListener('error',onError);error?reject(error):resolve();}
    const onReady=()=>finish();video.addEventListener(event,onReady,{once:true});video.addEventListener('error',onError,{once:true});
  });
  try {
    if(video.readyState<1)await wait('loadedmetadata');
    const duration=video.duration;
    if(!Number.isFinite(duration)||duration<=0||duration>3600)throw Error('Use a readable video under one hour.');
    const small=document.createElement('canvas');small.width=64;small.height=36;
    const ctx=small.getContext('2d',{willReadFrequently:true});
    const thumb=document.createElement('canvas');thumb.width=240;thumb.height=Math.max(2,Math.round(240*video.videoHeight/video.videoWidth));
    const tc=thumb.getContext('2d');
    const interval=Math.max(.5,duration/120),cuts=[0],frames=[];let previous=null;
    for(let t=0;t<duration-.02;t+=interval){
      if(document.hidden)throw Error('Keep this app visible while inspecting video. Resume the job when you return.');
      const at=Math.min(Math.max(.001,t),duration-.02);
      if(Math.abs(video.currentTime-at)>.0001){const seek=wait('seeked');video.currentTime=at;await seek;}
      else if(video.readyState<2)await wait('loadeddata');
      ctx.drawImage(video,0,0,64,36);const pixels=ctx.getImageData(0,0,64,36).data;let delta=0;
      if(previous){for(let i=0;i<pixels.length;i+=4)delta+=Math.abs(pixels[i]-previous[i])+Math.abs(pixels[i+1]-previous[i+1])+Math.abs(pixels[i+2]-previous[i+2]);delta/=64*36*3*255;}
      if(!previous||delta>.27){
        if(previous)cuts.push(Number(t.toFixed(3)));
        tc.drawImage(video,0,0,thumb.width,thumb.height);frames.push(thumb.toDataURL('image/jpeg',.65));
      }
      previous=pixels;
    }
    const edges=[...cuts,duration];
    return {duration,shots:cuts.map((start,i)=>({index:i,start,end:edges[i+1],kind:'Sampled visual interval',confidence:'estimated'})),
      notices:['Visual transitions were sampled every '+interval.toFixed(2)+' seconds, not frame-accurate cuts. Fast edits and camera motion can be missed or confused.'],timing_method:'browser-sampled-v1',thumbnails:frames};
  } finally {video.pause();video.removeAttribute('src');video.load();URL.revokeObjectURL(url);}
}

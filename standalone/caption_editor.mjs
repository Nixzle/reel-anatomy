import {get,createStore} from './vendor/idb-keyval.js';
import {recognise,available,discover} from './desktop_speech.mjs';
import {srtText} from './factory_render.mjs';
const $=id=>document.getElementById(id),db=createStore('reel-anatomy-on-device-v1','library');
let controller=null,method='imported-subtitles',provenance='User-supplied timed subtitles; inspect timing and words against narration.',binding=null;
const current=()=>{const s=window.ReelFactory.state;return {state:s,c:s.campaign,v:s.campaign?.variants.find(v=>v.key===s.key)};};
function guard(needsAudio=true){const x=current();if(!x.c||x.state.dirty)throw Error('Save this variant before preparing timed captions.');if(x.state.busy)throw Error('Finish the active render first.');if(needsAudio&&!x.v.narration)throw Error('Attach and save narration first.');return x;}
const note=text=>$('caption-timing-status').textContent=text;
function bind(id,event,fn){$(id).addEventListener(event,async e=>{try{await fn(e);}catch(error){note(error.message);window.notice(error.message);}});}
function refresh(){
 const {c,v}=current();if(!c||!v)return;
 const track=v.timed_captions;
 $('caption-timing-text').value=track?srtText(v.scenes,track):'';
 binding=track?{id:c.id,key:v.key,sha256:track.narration_sha256,revision:c.revision}:null;
 method=track?.method||'imported-subtitles';provenance=track?.provenance||'User-supplied timed subtitles; inspect timing and words against narration.';
 $('caption-recognise').disabled=!available()||Boolean(controller);
 note(track?track.cues.length+' timed cues · '+track.method+'. The existing production checks also verify audio and script bindings.':'No narration-timed track. Current captions use proportional planned timing. Import SRT/VTT or recognise saved narration on desktop.');
}
async function saveTrack(clear=false){
 const {c,v}=guard(!clear);
 if(!clear&&binding&&(binding.id!==c.id||binding.key!==v.key||binding.sha256!==v.narration.sha256||binding.revision!==c.revision))throw Error('Campaign or narration changed since captions were prepared. Reimport or regenerate rather than binding stale text.');
 const data={id:c.id,key:v.key,revision:c.revision,narration_sha256:v.narration?.sha256||null,clear};
 if(!clear)Object.assign(data,{subtitles:$('caption-timing-text').value,method,provenance});
 const saved=await window.ReelFactory.api('captions',data,c.workspace);window.ReelFactory.update(saved);
 note(clear?'Timed captions removed. Planned timing is active.': 'Timed captions saved and earlier approval cleared. Check the actual narration before reviewing this version.');
}
async function init(){
 const panel=document.createElement('section');panel.className='studio-card';panel.id='caption-timing-panel';
 panel.innerHTML='<h3>Captions that follow the narration</h3><p>Use a timed SRT/VTT track or recognise the saved recording in the desktop app. Timing estimates and recognised words still need review; silence is preserved instead of stretching text through every shot.</p><div class="actions"><label class="file-mini">Import SRT / VTT<input id="caption-timing-file" type="file" accept=".srt,.vtt,text/plain"></label><button id="caption-recognise" class="outline-button">Recognise saved narration locally</button><button id="caption-stop" class="outline-button" disabled>Cancel recognition</button></div><label class="hypothesis-label">Timed captions, editable SRT<textarea id="caption-timing-text" rows="9" maxlength="200000" placeholder="1&#10;00:00:00,500 --> 00:00:02,100&#10;Your spoken words"></textarea></label><div class="actions"><button id="caption-apply" class="primary-button">Apply this timed track</button><button id="caption-clear" class="outline-button">Return to planned timing</button></div><p id="caption-timing-status" role="status" class="small-note"></p>';
 $('factory-shots').insertAdjacentElement('afterend',panel);
 await discover();
 window.addEventListener('reel-factory:rendered',refresh);
 bind('caption-timing-file','change',async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;if(file.size>200000)throw Error('Use a subtitle file up to 200 KB.');const {c,v}=guard();$('caption-timing-text').value=await file.text();method='imported-subtitles';provenance='Timed subtitles supplied by the user. Not automatically verified against audio.';binding={id:c.id,key:v.key,sha256:v.narration.sha256,revision:c.revision};note('Subtitles loaded for this saved narration. Apply to validate all timestamps.');});
 bind('caption-timing-text','input',()=>{if(controller)return;const {c,v}=current();if(c&&v?.narration&&!binding)binding={id:c.id,key:v.key,sha256:v.narration.sha256,revision:c.revision};method='manual-timing';provenance='User-edited timed subtitles; narration and wording require review.';});
 bind('caption-apply','click',()=>saveTrack());bind('caption-clear','click',()=>saveTrack(true));bind('caption-stop','click',()=>controller?.abort());
 bind('caption-recognise','click',async()=>{
  const {c,v}=guard();if(controller)throw Error('Caption recognition is already running.');
  const captured={id:c.id,key:v.key,sha256:v.narration.sha256,revision:c.revision};const blob=await get('factory-media:'+captured.sha256,db);if(!blob)throw Error('Reattach the saved narration file first.');
  controller=new AbortController();$('caption-recognise').disabled=true;$('caption-stop').disabled=false;$('caption-apply').disabled=true;
  try{
   const result=await recognise(blob,{signal:controller.signal,onProgress:note});const live=current();
   if(live.c?.id!==captured.id||live.c.revision!==captured.revision||live.v?.key!==captured.key||live.v.narration?.sha256!==captured.sha256)throw Error('The variant changed during recognition. Nothing was applied.');
   $('caption-timing-text').value=result.subtitles;method='local-whisper-words';provenance=result.provenance;binding=captured;
   note(result.words.length+' recognised words. Inspect and correct them, then apply. No editorial approval has been created.');
  }finally{controller=null;$('caption-recognise').disabled=!available();$('caption-stop').disabled=true;$('caption-apply').disabled=false;}
 });
 refresh();window.CaptionEditor={refresh,get busy(){return Boolean(controller);}};
}
export const ready=init();

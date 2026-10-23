import assert from 'node:assert/strict';
import {captionCues,srtText,chooseMime} from './standalone/factory_render.mjs';
let n=0;function check(name,f){f();console.log('PASS '+name);n++;}
const scenes=[{index:0,start:0,end:3,spoken:'This is our original first sentence.'},{index:1,start:3,end:10,spoken:'A longer sentence provides enough words to form multiple caption cues while preserving the whole timeline.'}];
check('caption cues are monotonic and cover each spoken shot',()=>{const cues=captionCues(scenes);assert.equal(cues[0].start,0);assert.equal(cues.at(-1).end,10);for(let i=1;i<cues.length;i++)assert.ok(cues[i].start>=cues[i-1].end-1e-8);});
check('long spoken text is split into readable cue groups',()=>{const c=captionCues(scenes);assert.ok(c.length>=3);assert.ok(c.every(x=>x.text.length<=66));});
check('empty speech creates no fake subtitle',()=>assert.equal(captionCues([{index:0,start:0,end:3,spoken:''}]).length,0));
check('SRT includes real planned timestamps',()=>{const s=srtText(scenes);assert.ok(s.includes('00:00:00,000 --> 00:00:03,000'));assert.ok(s.includes('00:00:10,000'));});
check('MP4 chosen only when supported',()=>assert.ok(chooseMime({isTypeSupported:t=>t==='video/mp4'}).includes('mp4')));
check('WebM is not relabelled as MP4',()=>assert.equal(chooseMime({isTypeSupported:t=>t==='video/webm'}),'video/webm'));
check('no encoder produces explicit unsupported result',()=>assert.equal(chooseMime({isTypeSupported:()=>false}),null));
console.log('FACTORY_FRONTEND_CHECKS='+n);

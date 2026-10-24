import assert from 'node:assert/strict';
import {normalizeResults,queryPlan,evidenceReply,modelPrompt,validateModelReply,LocalReasoner,publicURL} from './standalone/research_services.mjs';
let checks=0;const pass=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
const src={id:'a'.repeat(32),citation:'S-AAAAAAAAAA',content_hash:'b'.repeat(64),title:'Synthetic source',excerpt:'An early demonstration was tested. It did not reliably improve outcomes.',level:'excerpt',reviewed:false};
const context={question:'What is supported?',sources:[src],claims:[],warnings:['Synthetic, not real research.']};
pass('Crossref metadata is not a read paper',()=>{const x=normalizeResults('crossref',{message:{items:[{DOI:'10.1/example',title:['Fixture'],author:[{given:'A',family:'Author'}]}]}})[0];assert.equal(x.level,'metadata');assert.equal(x.reviewed,false);});
pass('Crossref abstract retains partial coverage',()=>{const x=normalizeResults('crossref',{message:{items:[{DOI:'10.1/example',title:['Fixture'],abstract:'<p>Study abstract</p>'}]}})[0];assert.equal(x.level,'excerpt');assert.equal(x.content,'Study abstract');});
pass('Wikipedia excerpt is not primary evidence',()=>{const x=normalizeResults('wikipedia',{query:{search:[{title:'Fixture',snippet:'<b>Text</b>',timestamp:'2020'}]}})[0];assert.equal(x.content,'Text');assert.ok(x.provenance.includes('not a primary'));});
pass('search plan bounded and explicit',()=>assert.equal(queryPlan('topic').length,6));
pass('source URLs reject credential and script injection',()=>{assert.throws(()=>publicURL('javascript:alert(1)'));assert.throws(()=>publicURL('https://x:y@example.org'));});
pass('evidence mode labels retrieval honestly',()=>{const x=evidenceReply(context);assert.equal(x.mode,'evidence');assert.ok(x.answer.includes('not a language-model answer'));assert.equal(x.citations.length,1);});
pass('empty evidence does not invent results',()=>assert.ok(evidenceReply({...context,sources:[]}).answer.includes('no matching saved sources')));
pass('public persona denies inherited tools and memories',()=>{const p=modelPrompt(context)[0].content;assert.ok(p.includes('no private chat memory'));assert.ok(p.includes('untrusted evidence'));});
pass('valid model citation remains a proposal',()=>{const x=validateModelReply(JSON.stringify({answer:'Provisional [S-AAAAAAAAAA]',citations:[{citation:src.citation,quote:'An early demonstration was tested.'}],unknowns:['Generalisation']}),context);assert.equal(x.mode,'local_model');});
pass('fabricated model quote is rejected',()=>assert.throws(()=>validateModelReply(JSON.stringify({answer:'Certain.',citations:[{citation:src.citation,quote:'Guaranteed success'}]}),context)));
pass('invented model source identity is rejected',()=>assert.throws(()=>validateModelReply(JSON.stringify({answer:'Claim [S-DEADBEEF]',citations:[]}),context)));
pass('malformed model response is not presented as evidence',()=>assert.throws(()=>validateModelReply('not JSON',context)));
pass('constructing local assistant does not load a model',()=>{const e=new LocalReasoner();assert.equal(e.engine,null);assert.equal(e.worker,null);});

pass('a source omitted from the bounded prompt cannot be cited',()=>{const many={...context,sources:[src,src,src,src,src,{...src,citation:'S-CCCCCCCCCC'}]};assert.throws(()=>validateModelReply(JSON.stringify({answer:'Claim [S-CCCCCCCCCC]',citations:[{citation:'S-CCCCCCCCCC',quote:'An early demonstration was tested.'}]}),many));});
pass('inline citation requires an actual matching quotation',()=>assert.throws(()=>validateModelReply(JSON.stringify({answer:'Claim [S-AAAAAAAAAA]',citations:[]}),context)));
{
 const e=new LocalReasoner();let complete;
 e.engine={chat:{completions:{create:()=>new Promise(resolve=>{complete=resolve;})}},interruptGenerate:()=>{}};
 const promise=e.answer(context);e.interrupt();complete({choices:[{message:{content:JSON.stringify({answer:'Stopped answer',citations:[]})}}]});
 await assert.rejects(promise,/stopped/);checks++;console.log('PASS cancelled generation cannot be saved as a completed answer');
}
{
 const e=new LocalReasoner();let cancelled=false,terminated=false;e.cancelLoad=()=>{cancelled=true;};e.worker={terminate:()=>{terminated=true;}};
 await e.unload();assert.ok(cancelled&&terminated);assert.equal(e.engine,null);checks++;console.log('PASS unloading cancels a pending model load and closes its worker');
}
console.log('RESEARCH_FRONTEND_CHECKS='+checks);

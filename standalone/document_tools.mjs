/** Device-local document intake. Source HTML is never inserted into the live page. */
import {createStore,get,set} from './vendor/idb-keyval.js';
const store=createStore('reel-anatomy-on-device-v1','library');
export const DOCUMENT_LIMITS=Object.freeze({bytes:20*1024*1024,pages:200,chars:1_000_000,pageChars:60_000});
export const sha256=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
const checked=(signal)=>{if(signal?.aborted)throw new DOMException('Document reading cancelled. No partial import was claimed.','AbortError');};
let pdfRuntime,readerRuntime;
async function pdfjs(){
 if(!pdfRuntime)pdfRuntime=import('./vendor/pdfjs/pdf.mjs').then(m=>{m.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.mjs',import.meta.url).href;return m;});
 return pdfRuntime;
}
async function reader(){
 if(!readerRuntime)readerRuntime=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL('./vendor/Readability.js',import.meta.url).href;script.onload=()=>resolve(globalThis.Readability);script.onerror=()=>{readerRuntime=null;reject(Error('The article reader could not load.'));};document.head.append(script);});
 return readerRuntime;
}
export function pageText(items){
 let text='';
 for(const item of items){if(typeof item.str!=='string')continue;text+=item.str+(item.hasEOL?'\n':' ');}
 return text.replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}
export async function readPDF(file,{signal,onProgress}={}){
 if(!(file instanceof Blob)||!file.size||file.size>DOCUMENT_LIMITS.bytes)throw Error('PDFs must be non-empty and at most 20 MB.');
 checked(signal);const bytes=new Uint8Array(await file.arrayBuffer());const hash=await sha256(bytes);const lib=await pdfjs();checked(signal);
 const loading=lib.getDocument({data:bytes,isEvalSupported:false,enableXfa:false,useSystemFonts:true,disableFontFace:true,disableAutoFetch:true,disableStream:true,stopAtErrors:true,maxImageSize:8_000_000});
 const abort=()=>void loading.destroy();signal?.addEventListener('abort',abort,{once:true});const deadline=setTimeout(abort,90000);
 let pdf;
 try{
  pdf=await loading.promise;checked(signal);if(pdf.numPages>DOCUMENT_LIMITS.pages)throw Error('Use PDFs up to 200 pages. Split a larger document into intentional sections.');
  const metadata=await pdf.getMetadata().catch(()=>null);const name=String(file.name||'Local PDF').slice(0,240),title=String(metadata?.info?.Title||name).slice(0,400);let chars=0;const pages=[];
  for(let n=1;n<=pdf.numPages;n++){
   checked(signal);const page=await pdf.getPage(n),content=await page.getTextContent({includeMarkedContent:false});let text=pageText(content.items);
   if(text.length>DOCUMENT_LIMITS.pageChars)throw Error('Page '+n+' exceeds the text limit. Nothing was silently truncated.');
   chars+=text.length;if(chars>DOCUMENT_LIMITS.chars)throw Error('Document text exceeds one million characters. Import a smaller section.');
   pages.push({number:n,text,empty:!text.trim()});onProgress?.(n,pdf.numPages);page.cleanup();
  }
  checked(signal);return {format:'pdf',hash,name,title,author:String(metadata?.info?.Author||'').slice(0,500),pages,bytes:file.size,
    limits:'Text extraction only. Reading order, mathematical notation and tables can be imperfect. Images are not interpreted; blank/scanned pages require manual review. No OCR or document scripts were executed.'};
 }catch(error){checked(signal);if(error?.name==='PasswordException')throw Error('This PDF is password-protected. Supply an authorised unlocked copy.');throw error;}
 finally{clearTimeout(deadline);signal?.removeEventListener('abort',abort);await loading.destroy().catch(()=>{});}
}
export async function readHTML(file,{signal}={}){
 if(!(file instanceof Blob)||!file.size||file.size>2_000_000)throw Error('Saved articles must be non-empty HTML files up to 2 MB.');
 const bytes=await file.arrayBuffer(),hash=await sha256(bytes);checked(signal);const html=new TextDecoder('utf-8',{fatal:true}).decode(bytes);const Readability=await reader();
 const template=document.createElement('template');template.innerHTML=html;
 const canonical=template.content.querySelector('link[rel=canonical]')?.getAttribute('href')||'';
 const title=template.content.querySelector('title')?.textContent||file.name||'Saved article';
 template.content.querySelectorAll('script,style,iframe,frame,object,embed,link,meta,base,img,video,audio,source,track,svg,math,form').forEach(n=>n.remove());
 for(const node of template.content.querySelectorAll('*'))for(const attr of [...node.attributes])if(/^on/i.test(attr.name)||['src','srcset','href','style','action','formaction','background','poster'].includes(attr.name.toLowerCase()))node.removeAttribute(attr.name);
 const doc=document.implementation.createHTMLDocument('');doc.title=title;doc.body.replaceChildren(template.content.cloneNode(true));
 const article=new Readability(doc,{charThreshold:100,maxElemsToParse:30000,keepClasses:false}).parse();
 const text=(article?.textContent||doc.body.textContent||'').trim();if(!text)throw Error('No readable article text was found.');if(text.length>100000)throw Error('The article exceeds 100,000 characters. Import a smaller section.');
 checked(signal);let url='';try{const u=new URL(canonical);if(u.protocol==='https:'&&!u.username&&!u.password)url=u.href;}catch{}
 return {format:'html',hash,name:String(file.name||'Saved article').slice(0,240),title:String(article?.title||title).slice(0,400),author:String(article?.byline||'').slice(0,500),url,bytes:file.size,
   pages:[{number:1,text,empty:false}],limits:'Text extracted from a user-supplied HTML file. Scripts, media, links and styles were not executed or loaded. The original URL is attribution, not evidence that it was fetched.'};
}
export function documentSources(doc){
 if(!doc?.pages?.length)throw Error('No document pages to import.');
 return doc.pages.filter(p=>!p.empty).map(page=>({title:doc.title+(doc.format==='pdf'?' / page '+page.number:''),url:doc.format==='html'?doc.url||'':'',content:page.text,
  author:doc.author,published:'',kind:doc.format==='pdf'?'paper':'web',level:'excerpt',reviewed:false,
  provenance:'User-supplied '+doc.format.toUpperCase()+' '+doc.name+'; SHA-256 '+doc.hash+'; page '+page.number+' of '+doc.pages.length+'. '+doc.limits,
  tags:[doc.format,'document-'+doc.hash.slice(0,32),'page-'+page.number],note:'Original document stored locally. Coverage: extracted text for this page, not verified interpretation of images, tables or the full argument.'}));
}
export async function importDocument(file,{workspace,signal,onProgress}={}){
 const format=/\.pdf$/i.test(file.name)||file.type==='application/pdf'?'pdf':/\.html?$/i.test(file.name)||file.type==='text/html'?'html':null;
 if(!format)throw Error('Choose a PDF or saved HTML article.');
 const doc=format==='pdf'?await readPDF(file,{signal,onProgress}):await readHTML(file,{signal});const sources=documentSources(doc);checked(signal);
 if(!sources.length)throw Error('No extractable text was found. This may be a scan. The document was not represented as read evidence.');
 // Original is retained before metadata; an interrupted import can be safely retried by source identity.
 await set('document:'+doc.hash,file,store);await set('document-info:'+doc.hash,{...doc,pages:doc.pages.map(({text,...p})=>({...p,chars:text.length}))},store);
 const result=await window.PhoneLocal.api('/api/documents/import',{method:'POST',body:JSON.stringify({workspace,sources,document_hash:doc.hash})});
 window.dispatchEvent(new CustomEvent('reel-document-imported',{detail:{hash:doc.hash,workspace}}));
 return {...result,document:doc.hash,total_pages:doc.pages.length,empty_pages:doc.pages.filter(p=>p.empty).map(p=>p.number),limits:doc.limits};
}
export async function renderPDFPage(hash,pageNumber,canvas,{signal}={}){
 if(!/^[a-f0-9]{64}$/.test(hash)||!Number.isInteger(pageNumber)||pageNumber<1)throw Error('Invalid document reference.');
 const file=await get('document:'+hash,store);if(!(file instanceof Blob))throw Error('The original document is not on this device. Import it again or restore a project pack.');
 const info=await get('document-info:'+hash,store);if(info?.format!=='pdf')throw Error('This source is not a PDF.');
 const lib=await pdfjs(),loading=lib.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,enableXfa:false,disableFontFace:true,useSystemFonts:true,maxImageSize:4_000_000});
 let task;const cancel=()=>{task?.cancel();void loading.destroy();};signal?.addEventListener('abort',cancel,{once:true});
 try{
  const pdf=await loading.promise;checked(signal);if(pageNumber>pdf.numPages)throw Error('Page is outside this PDF.');const page=await pdf.getPage(pageNumber);
  const initial=page.getViewport({scale:1});const scale=Math.min(2,1100/initial.width,1500/initial.height),viewport=page.getViewport({scale});
  canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
  task=page.render({canvasContext:canvas.getContext('2d'),viewport,annotationMode:0});await task.promise;checked(signal);return {page:pageNumber,pages:pdf.numPages,title:info.title,hash};
 }finally{signal?.removeEventListener('abort',cancel);await loading.destroy().catch(()=>{});}
}
export function documentReference(source){
 const hash=/SHA-256 ([a-f0-9]{64})/.exec(source.provenance||'')?.[1],page=Number(source.tags?.find(t=>/^page-\d+$/.test(t))?.slice(5));
 return hash&&Number.isInteger(page)&&page>0?{hash,page,pdf:source.tags.includes('pdf')}:null;
}

/** Allowlisted read-through for openly accessible article text. No arbitrary proxy or cookies. */
export function articleEndpoint(source){
 let u;try{u=new URL(source.url);}catch{return null;}
 if(u.protocol!=='https:'||u.username||u.password)return null;
 if(u.hostname==='en.wikipedia.org'&&u.pathname.startsWith('/wiki/'))return {provider:'wikipedia',title:decodeURIComponent(u.pathname.slice(6)),endpoint:'https://en.wikipedia.org/w/api.php?origin=*&action=query&prop=extracts&explaintext=1&exsectionformat=plain&redirects=1&format=json&titles='+encodeURIComponent(decodeURIComponent(u.pathname.slice(6)))};
 if(['europepmc.org','www.europepmc.org','pmc.ncbi.nlm.nih.gov'].includes(u.hostname)){
  const match=/^\/articles\/(PMC\d+)\/?$/.exec(u.pathname);if(match)return {provider:'europepmc',id:match[1],endpoint:'https://www.ebi.ac.uk/europepmc/webservices/rest/'+match[1]+'/fullTextXML'};
 }
 return null;
}
export async function readAvailableArticle(source,{signal}={}){
 const spec=articleEndpoint(source);if(!spec)throw Error('Automatic full-text reading is supported for Wikipedia and Europe PMC open-access articles only. Import a PDF or saved HTML for other sources.');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
 try{
  const r=await fetch(spec.endpoint,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer',redirect:'error'});if(!r.ok)throw Error('The source did not supply readable open-access full text (HTTP '+r.status+'). Nothing was replaced.');
  const raw=await r.text();if(raw.length>2_000_000)throw Error('Article response exceeds 2 MB. Save and import a smaller document section.');
  let content,title,license;
  if(spec.provider==='wikipedia'){
   const data=JSON.parse(raw),page=Object.values(data.query?.pages||{})[0];content=page?.extract;title=page?.title;license='Wikipedia contributors, CC BY-SA. The article may contain errors; inspect primary references.';
  }else{
   if(/<!DOCTYPE|<!ENTITY/i.test(raw))throw Error('External XML declarations are not accepted by this reader.');
   const doc=new DOMParser().parseFromString(raw,'application/xml');if(doc.querySelector('parsererror'))throw Error('The full-text response is not valid article XML.');
   title=doc.querySelector('article-title')?.textContent||source.title;
   const nodes=[...doc.querySelectorAll('abstract > p, body > sec, body > p')];
   content=nodes.map(node=>{const clone=node.cloneNode(true);clone.querySelectorAll('title,p').forEach(p=>p.append('\n\n'));return clone.textContent.trim();}).join('\n\n');
   license=doc.querySelector('permissions license')?.textContent?.trim()||'Open-access API text; consult the original article for exact reuse terms.';
  }
  if(typeof content!=='string'||content.trim().length<80)throw Error('No substantive article text was supplied. The saved source was not changed.');
  if(content.length>100000)throw Error('The article is too long for one source record. Import its PDF with page-level evidence instead.');
  return {...source,title:String(title||source.title).slice(0,500),content:content.trim(),level:'full_text',reviewed:false,
   provenance:(spec.provider==='wikipedia'?'Wikipedia plain-text article':'Europe PMC open-access XML article')+' retrieved '+new Date().toISOString()+'. Text only; figures and tables are not visually interpreted. '+license.slice(0,450),
   note:'Full available article text was fetched through a named public API. This does not certify that the argument, references or figures have been understood.',tags:[...new Set([...(source.tags||[]),'full-text-api'])].slice(0,15)};
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}

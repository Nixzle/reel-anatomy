/* Client-encrypted metadata commits. No token/key is included in a library snapshot. */
import {ApiError} from './google_connections.mjs';
export const MAX_PLAINTEXT=8*1024*1024,MAX_COMMITS=200;
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
const ID=/^[a-f0-9]{32}$/,FILE=/^[A-Za-z0-9_-]{8,160}$/;
const TABLES=['research','posts','snapshots','documents','experiments'];
const RESEARCH=['research_sources','research_claims','research_runs','research_messages'];
const clone=x=>structuredClone(x);
export function canonical(value){
  if(value===null)return 'null';
  if(typeof value==='number'){if(!Number.isFinite(value))throw Error('Non-finite sync value.');return JSON.stringify(value);}
  if(typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value&&typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype)return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  throw Error('Unsupported sync value.');
}
export const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',typeof value==='string'?encoder.encode(value):value)),b=>b.toString(16).padStart(2,'0')).join('');
const randomId=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
function b64(bytes){let text='';for(let i=0;i<bytes.length;i+=32768)text+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(text).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');}
function unb64(value,max){if(typeof value!=='string'||value.length>Math.ceil(max*4/3)+4||!/^[A-Za-z0-9_-]*$/.test(value))throw Error('Invalid encrypted data encoding.');const bytes=Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')+'='.repeat((4-value.length%4)%4)),c=>c.charCodeAt(0));if(bytes.length>max)throw Error('Encrypted data exceeds its size bound.');return bytes;}
function rows(items,label){if(!Array.isArray(items)||items.length>20000)throw Error('Invalid metadata collection: '+label);const ids=new Set();return items.map(r=>{if(!r||typeof r!=='object'||Array.isArray(r)||!(r.id==='default'||ID.test(r.id))||ids.has(r.id))throw Error('Duplicate or invalid sync identity in '+label);ids.add(r.id);return clone(r);}).sort((a,b)=>a.id.localeCompare(b.id));}
export function normaliseLibrary(value){
  if(!value||value.format!=='reel-anatomy-phone-backup'||value.schema!==1||!value.tables||!value.assets)throw Error('Sync expects an application metadata snapshot.');
  const allowed=new Set(['format','schema','version','exported_at','tables','assets','research_bundle','factory_bundle','creative_bundle','note']);if(Object.keys(value).some(k=>!allowed.has(k)))throw Error('This snapshot contains an unsupported extension. Update both devices before syncing.');
  if(Object.keys(value.tables).some(k=>!TABLES.includes(k))||Object.keys(value.research_bundle||{}).some(k=>!RESEARCH.includes(k)))throw Error('Unknown sync table.');
  const out={format:value.format,schema:1,version:'metadata-sync-v1',tables:{},assets:{},research_bundle:{},factory_bundle:[],creative_bundle:[]};
  for(const t of TABLES)out.tables[t]=rows(value.tables[t],t);
  if(Object.keys(value.assets).length>2000)throw Error('Too many analysis assets to sync.');
  for(const key of Object.keys(value.assets).sort()){if(!ID.test(key)||value.assets[key]?.id!==key)throw Error('Invalid analysis asset identity.');out.assets[key]=clone(value.assets[key]);}
  for(const t of RESEARCH)out.research_bundle[t]=rows(value.research_bundle?.[t]||[],t);
  out.factory_bundle=rows(value.factory_bundle||[],'campaigns').map(c=>{c.exports=[];delete c.restore_note;for(const v of c.variants||[])v.approval=null;return c;});
  out.creative_bundle=rows(value.creative_bundle||[],'creative');
  if(encoder.encode(canonical(out)).length>MAX_PLAINTEXT)throw Error('Encrypted metadata sync is limited to 8 MB per checkpoint. Original media is not included; use project packs for media.');
  return out;
}
export function flatten(value){const v=normaliseLibrary(value),out={};
  for(const t of TABLES)for(const r of v.tables[t])out['tables/'+t+'/'+r.id]=r;
  for(const t of RESEARCH)for(const r of v.research_bundle[t])out['research/'+t+'/'+r.id]=r;
  for(const [id,r]of Object.entries(v.assets))out['assets/'+id]=r;
  for(const r of v.factory_bundle)out['factory/'+r.id]=r;
  for(const r of v.creative_bundle)out['creative/'+r.id]=r;return out;
}
function unflatten(records){const out={format:'reel-anatomy-phone-backup',schema:1,version:'metadata-sync-v1',tables:Object.fromEntries(TABLES.map(t=>[t,[]])),assets:{},research_bundle:Object.fromEntries(RESEARCH.map(t=>[t,[]])),factory_bundle:[],creative_bundle:[]};
  for(const [path,value]of Object.entries(records)){const [group,name]=path.split('/');if(group==='tables')out.tables[name].push(value);else if(group==='research')out.research_bundle[name].push(value);else if(group==='assets')out.assets[name]=value;else if(group==='factory')out.factory_bundle.push(value);else if(group==='creative')out.creative_bundle.push(value);else throw Error('Unknown merged entity.');}return normaliseLibrary(out);
}
export function pristine(library){const v=normaliseLibrary(library),r=v.tables.research[0];const blank=r&&r.id==='default'&&r.title==='My research'&&r.audience===''&&r.topic===''&&r.objective==='Learn and test'&&r.platform==='instagram'&&r.revision===1;return v.tables.research.length===1&&blank&&TABLES.slice(1).every(t=>!v.tables[t].length)&&Object.keys(v.assets).length===0&&RESEARCH.every(t=>!v.research_bundle[t].length)&&!v.factory_bundle.length&&!v.creative_bundle.length;}
export function changeSummary(before,after){const a=before?flatten(before):{},b=flatten(after),result={added:0,updated:0,deleted:0,records:[]};for(const key of [...new Set([...Object.keys(a),...Object.keys(b)])].sort()){if(same(a[key],b[key]))continue;const change=a[key]===undefined?'added':b[key]===undefined?'deleted':'updated';result[change]++;if(result.records.length<30)result.records.push({key,change,label:String(b[key]?.title||a[key]?.title||b[key]?.statement||a[key]?.statement||key).slice(0,160)});}return result;}
const same=(a,b)=>a===undefined||b===undefined?a===b:canonical(a)===canonical(b);
export function mergeLibraries(base,local,remote,choices={}){
  const a=base?flatten(base):{},l=flatten(local),r=flatten(remote),merged={},conflicts=[];let changed=0;
  for(const key of [...new Set([...Object.keys(a),...Object.keys(l),...Object.keys(r)])].sort()){
    let value;if(same(l[key],r[key]))value=l[key];else if(same(l[key],a[key]))value=r[key];else if(same(r[key],a[key]))value=l[key];
    else{const fingerprint=canonical([a[key]??null,l[key]??null,r[key]??null]),choice=choices[key];
      if(choice?.fingerprint===fingerprint&&choice.side==='local')value=l[key];else if(choice?.fingerprint===fingerprint&&choice.side==='remote')value=r[key];
      else{conflicts.push({key,base:a[key]??null,local:l[key]??null,remote:r[key]??null,fingerprint});continue;}}
    if(value!==undefined)merged[key]=value;if(!same(l[key],value))changed++;
  }
  return {library:conflicts.length?null:unflatten(merged),conflicts,changed};
}
async function keysFrom(raw,space){
  const key=await crypto.subtle.importKey('raw',raw,'HKDF',false,['deriveKey']);const salt=encoder.encode('reel-anatomy-vault-v1:'+space);
  const aes=await crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt,info:encoder.encode('snapshot')},key,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const mac=await crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt,info:encoder.encode('authenticated-index')},key,{name:'HMAC',hash:'SHA-256',length:256},false,['sign','verify']);return {aes,mac};
}
export async function createVault(clientId,owner){
  const space=randomId(),raw=crypto.getRandomValues(new Uint8Array(32));const recovery={format:'reel-anatomy-vault-key',schema:1,space,key:b64(raw),clientId,owner};
  const keys=await keysFrom(raw,space);raw.fill(0);return {vault:{space,clientId,owner,...keys,baseId:null,base:null,pending:null,created:false},recovery};
}
export async function recoverVault(value,clientId){
  if(!value||value.format!=='reel-anatomy-vault-key'||value.schema!==1||!ID.test(value.space)||value.clientId!==clientId||typeof value.owner!=='string'||value.owner.length>200)throw Error('Invalid recovery file or different registered app client.');
  const raw=unb64(value.key,32);if(raw.length!==32)throw Error('Recovery key must contain 256 random bits.');const keys=await keysFrom(raw,value.space);raw.fill(0);
  return {space:value.space,clientId,owner:value.owner,...keys,baseId:null,base:null,pending:null,created:true};
}
function headerOf(value){
  if(!value||value.format!=='reel-encrypted-checkpoint'||value.schema!==1||!ID.test(value.space)||!ID.test(value.commit)||!Array.isArray(value.parents)||value.parents.length>2||value.parents.some(p=>!ID.test(p)||p===value.commit)||new Set(value.parents).size!==value.parents.length)throw Error('Invalid encrypted checkpoint header.');
  return {format:value.format,schema:1,space:value.space,commit:value.commit,parents:[...value.parents].sort()};
}
async function signIndex(keys,header,sha){return b64(new Uint8Array(await crypto.subtle.sign('HMAC',keys.mac,encoder.encode(canonical({...header,sha})))));}
export async function encryptCheckpoint(vault,library,parents=[]){
  const header=headerOf({format:'reel-encrypted-checkpoint',schema:1,space:vault.space,commit:randomId(),parents});
  const normal=normaliseLibrary(library),plaintext=encoder.encode(canonical({library:normal,at:new Date().toISOString()}));const iv=crypto.getRandomValues(new Uint8Array(12));
  const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(canonical(header)),tagLength:128},vault.aes,plaintext);
  const envelope={...header,iv:b64(iv),ciphertext:b64(new Uint8Array(cipher))};const content=canonical(envelope),sha=await hash(content),tag=await signIndex(vault,header,sha);
  return {header,content,sha,tag};
}
export async function decryptCheckpoint(vault,entry,envelope){
  const header=headerOf(envelope);if(header.space!==vault.space||header.commit!==entry.commit||canonical(header.parents)!==canonical(entry.parents))throw Error('Encrypted file does not match its authenticated index.');
  if(await hash(canonical(envelope))!==entry.sha)throw Error('Encrypted cloud bytes changed. Nothing was imported.');
  let raw;try{raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(envelope.iv,12),additionalData:encoder.encode(canonical(header)),tagLength:128},vault.aes,unb64(envelope.ciphertext,MAX_PLAINTEXT+5000));}catch{throw Error('The recovery key is wrong or the encrypted data was modified.');}
  const body=JSON.parse(decoder.decode(raw));return normaliseLibrary(body.library);
}
export async function verifyIndex(vault,files){
  if(!Array.isArray(files)||files.length>MAX_COMMITS)throw Error('Cloud checkpoint history exceeds the safe limit. Keep an exported backup and start a new vault.');
  const records=new Map();
  for(const file of files){const props=file.appProperties||{};
    if(props.raVault!==vault.space||props.raKind!=='encrypted-v1')continue;
    if(!FILE.test(file.id)||!ID.test(props.raCommit)||!/^\d+$/.test(String(file.size||''))||Number(file.size)>Math.ceil(MAX_PLAINTEXT*1.5)+10000)throw Error('Invalid cloud file metadata.');
    const header=headerOf({format:'reel-encrypted-checkpoint',schema:1,space:vault.space,commit:props.raCommit,parents:props.raParents?props.raParents.split(','):[]});
    if(!/^[a-f0-9]{64}$/.test(props.raSha)||!await crypto.subtle.verify('HMAC',vault.mac,unb64(props.raTag,32),encoder.encode(canonical({...header,sha:props.raSha}))))throw Error('Cloud index authentication failed. Do not choose a winner from unverified data.');
    if(records.has(header.commit))throw Error('Duplicate checkpoint identities require reconciliation.');
    records.set(header.commit,{id:file.id,commit:header.commit,parents:header.parents,sha:props.raSha,tag:props.raTag});
  }
  for(const r of records.values())if(r.parents.some(p=>!records.has(p)))throw Error('Cloud history is incomplete. No snapshot will be silently discarded.');
  const referenced=new Set([...records.values()].flatMap(r=>r.parents));const heads=[...records.keys()].filter(id=>!referenced.has(id)).sort();
  if(records.size&&!heads.length)throw Error('Cloud graph is cyclic.');
  const active=new Set(),finished=new Set();const visit=id=>{if(finished.has(id))return;if(active.has(id))throw Error('Cloud history contains a cycle.');active.add(id);for(const p of records.get(id).parents)visit(p);active.delete(id);finished.add(id);};
  for(const h of heads)visit(h);if(finished.size!==records.size)throw Error('Cloud history contains an unreachable cycle.');
  return {records,heads};
}
function ancestors(graph,id){const found=new Map(),queue=[[id,0]];while(queue.length){const [key,depth]=queue.shift();if(found.has(key))continue;found.set(key,depth);const row=graph.records.get(key);if(!row)throw Error('Missing history identity.');for(const p of row.parents)queue.push([p,depth+1]);}return found;}
export function commonAncestor(graph,a,b){const left=ancestors(graph,a),right=ancestors(graph,b);const shared=[...left.keys()].filter(x=>right.has(x)).sort((x,y)=>Math.max(left.get(x),right.get(x))-Math.max(left.get(y),right.get(y))||x.localeCompare(y));return shared[0]||null;}
export class DriveVault{
  constructor(session){this.session=session;}
  async owner(){const data=await this.session.request('drive','/drive/v3/about?fields=user(permissionId,displayName)');if(typeof data.user?.permissionId!=='string')throw Error('Drive did not return the authorising account identity.');return {id:data.user.permissionId,name:String(data.user.displayName||'Google account').slice(0,150)};}
  async list(space){if(!ID.test(space))throw Error('Invalid vault identity.');let token='',files=[];
    do{const params=new URLSearchParams({spaces:'appDataFolder',q:"trashed=false and appProperties has { key='raVault' and value='"+space+"' }",pageSize:'200',fields:'nextPageToken,files(id,size,appProperties)',...(token?{pageToken:token}:{})});const value=await this.session.request('drive','/drive/v3/files?'+params);if(!Array.isArray(value.files))throw Error('Unexpected Drive index.');files.push(...value.files);token=value.nextPageToken||'';if(files.length>MAX_COMMITS||token)throw Error('This vault reached its 200-checkpoint limit. Export recovery before starting another vault.');}while(token);return files;
  }
  async read(fileId){if(!FILE.test(fileId))throw Error('Invalid cloud file identity.');return this.session.request('drive','/drive/v3/files/'+fileId+'?alt=media',{maxBytes:Math.ceil(MAX_PLAINTEXT*1.5)+10000});}
  async reserve(){const data=await this.session.request('drive','/drive/v3/files/generateIds?count=1&space=appDataFolder&type=files');if(!FILE.test(data.ids?.[0]))throw Error('Drive did not reserve a file ID.');return data.ids[0];}
  async write(vault,pending){
    if(!FILE.test(pending.fileId))throw Error('No reserved cloud file ID.');
    const meta={id:pending.fileId,name:'Reel Anatomy encrypted checkpoint',mimeType:'application/json',parents:['appDataFolder'],appProperties:{raKind:'encrypted-v1',raVault:vault.space,raCommit:pending.header.commit,raParents:pending.header.parents.join(','),raSha:pending.sha,raTag:pending.tag}};
    const boundary='reel_'+randomId();const body=new Blob(['--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(meta)+'\r\n--'+boundary+'\r\nContent-Type: application/json\r\n\r\n'+pending.content+'\r\n--'+boundary+'--\r\n'],{type:'multipart/related; boundary='+boundary});
    return this.session.request('drive','/upload/drive/v3/files?uploadType=multipart&fields=id',{method:'POST',headers:{'Content-Type':body.type},body,maxBytes:10000});
  }
}
export class VaultSync{
  constructor({remote,vault,saveVault,readLocal,validateLocal,applyLocal,checkpointLocal}){this.remote=remote;this.vault=vault;this.saveVault=saveVault;this.readLocal=readLocal;this.validateLocal=validateLocal;this.applyLocal=applyLocal;this.checkpointLocal=checkpointLocal;this.cache=new Map();}
  async ownership(){const owner=await this.remote.owner();if(owner.id!==this.vault.owner)throw Error('Wrong Google account for this encrypted vault. Nothing was read or written.');return owner;}
  async graph(){await this.ownership();return verifyIndex(this.vault,await this.remote.list(this.vault.space));}
  async load(graph,id){if(this.cache.has(id))return this.cache.get(id);const entry=graph.records.get(id);if(!entry)throw Error('Cloud base revision is missing.');const library=await decryptCheckpoint(this.vault,entry,await this.remote.read(entry.id));this.cache.set(id,library);return library;}
  async plan(choices={}){
    if(this.vault.pending)throw Error('Reconcile the last cloud write before creating another checkpoint.');
    const local=await this.readLocal(),library=normaliseLibrary(local.library),localHash=await hash(canonical(library));const graph=await this.graph();
    if(this.vault.created&&!graph.heads.length)throw Error('This vault is not present in the connected account. No new history was invented.');
    if(graph.heads.length>2)throw Error('More than two concurrent cloud branches need pairwise recovery. Export local work before continuing.');
    const stages=[];let remoteLibrary=null,remoteHead=graph.heads[0]||null;
    if(remoteHead)remoteLibrary=await this.load(graph,remoteHead);
    if(graph.heads.length===2){const other=graph.heads[1],common=commonAncestor(graph,remoteHead,other);if(!common)throw Error('Two unrelated vault roots require manual recovery, not an automatic winner.');
      const merged=mergeLibraries(await this.load(graph,common),remoteLibrary,await this.load(graph,other),choices.cloud||{});if(merged.conflicts.length)return {stage:'cloud',conflicts:merged.conflicts,localRevision:local.revision,localHash,heads:graph.heads};remoteLibrary=merged.library;stages.push('Merged two concurrent cloud histories.');}
    let candidate=library,conflicts=[];
    if(remoteLibrary){let base=this.vault.base;
      if(this.vault.baseId){if(!graph.records.has(this.vault.baseId))throw Error('The last synced checkpoint disappeared. Recover explicitly.');for(const head of graph.heads)if(!ancestors(graph,head).has(this.vault.baseId)){const common=commonAncestor(graph,this.vault.baseId,head);if(!common)throw Error('No common cloud base.');base=await this.load(graph,common);break;}}
      if(!base&&pristine(library))candidate=remoteLibrary;
      else{const merge=mergeLibraries(base,library,remoteLibrary,choices.local||{});candidate=merge.library;conflicts=merge.conflicts;}
    }
    if(conflicts.length)return {stage:'local',conflicts,localRevision:local.revision,localHash,heads:graph.heads};
    candidate=normaliseLibrary(await this.validateLocal(candidate,local.revision));
    const hashCandidate=await hash(canonical(candidate));const remoteSame=graph.heads.length===1&&hashCandidate===await hash(canonical(remoteLibrary));
    return {stage:'ready',candidate,heads:graph.heads,localRevision:local.revision,localHash,contentHash:hashCandidate,publish:!remoteSame,localChanges:hashCandidate!==localHash,changes:{device:changeSummary(library,candidate),cloud:changeSummary(remoteLibrary,candidate)},notes:stages,conflicts:[]};
  }
  async execute(plan){
    if(plan.stage!=='ready')throw Error('Resolve every conflict before syncing.');
    if(this.vault.pending)throw Error('An earlier cloud write still needs reconciliation.');
    const local=await this.readLocal();if(local.revision!==plan.localRevision||await hash(canonical(normaliseLibrary(local.library)))!==plan.localHash)throw Error('This device changed after preview. Nothing was overwritten. Review again.');
    const graph=await this.graph();if(canonical(graph.heads)!==canonical(plan.heads))throw Error('Another device updated the cloud after preview. Review the new history first.');
    if(plan.publish){const encrypted=await encryptCheckpoint(this.vault,plan.candidate,plan.heads);const fileId=await this.remote.reserve();
      this.vault.pending={...encrypted,fileId,library:plan.candidate,expectedRevision:plan.localRevision,localHash:plan.localHash};await this.saveVault(this.vault);
      try{await this.remote.write(this.vault,this.vault.pending);}catch(error){throw Error('Cloud write outcome needs reconciliation. The pending identity is saved; do not create another checkpoint. '+(error.status?'HTTP '+error.status+'.':''));}
      return this.reconcile();
    }
    const next={...this.vault,baseId:plan.heads[0],base:plan.candidate,created:true,pending:null};
    if(plan.localChanges)await this.applyLocal(plan.candidate,plan.localRevision,next);else await this.checkpointLocal(next,plan.localRevision);this.vault=next;return {synced:true,published:false,commit:next.baseId,localChanged:plan.localChanges};
  }
  async reconcile({retryMissing=false}={}){
    const pending=this.vault.pending;if(!pending)throw Error('There is no pending cloud write.');await this.ownership();let value;
    try{value=await this.remote.read(pending.fileId);}catch(error){
      if(error.status!==404)throw Error('Cloud outcome remains unknown. Keep the pending write and reconnect.');
      if(!retryMissing)return {synced:false,state:'missing',message:'The reserved file is not visible. Explicitly retry the same file ID; do not create a second checkpoint.'};
      try{await this.remote.write(this.vault,pending);}catch(e){if(e.status!==409)throw Error('Retry outcome remains unknown. Reconcile again, without creating another checkpoint.');}
      value=await this.remote.read(pending.fileId);
    }
    const entry={commit:pending.header.commit,parents:pending.header.parents,sha:pending.sha};const confirmed=await decryptCheckpoint(this.vault,entry,value);
    const local=await this.readLocal();const unchanged=local.revision===pending.expectedRevision&&await hash(canonical(normaliseLibrary(local.library)))===pending.localHash;
    const next={...this.vault,pending:null,created:true};
    if(!unchanged){await this.saveVault(next);this.vault=next;return {synced:false,state:'cloud-saved-local-changed',message:'Encrypted checkpoint verified in Drive. This device changed meanwhile; no local work was replaced. Review sync again.'};}
    next.baseId=entry.commit;next.base=confirmed;
    if(await hash(canonical(confirmed))===pending.localHash)await this.checkpointLocal(next,pending.expectedRevision);else await this.applyLocal(confirmed,pending.expectedRevision,next);this.vault=next;
    return {synced:true,published:true,commit:entry.commit};
  }
}

/** Restrictive project-pack ZIP. Our format accepts stored entries only, never arbitrary archives. */
import {zipSync,unzipSync} from './vendor/fflate.mjs';
export const PACK_LIMIT=200*1024*1024;
const PATH=/^(?:manifest\.json|library\.json|blobs\/[a-f0-9]{64})$/;
export function inspectZip(data){
 if(!(data instanceof Uint8Array)||data.byteLength<22||data.byteLength>PACK_LIMIT+2_000_000)throw Error('Project pack exceeds the 200 MB import budget or is invalid.');
 const view=new DataView(data.buffer,data.byteOffset,data.byteLength);let eocd=-1;
 for(let i=data.length-22;i>=Math.max(0,data.length-65557);i--)if(view.getUint32(i,true)===0x06054b50){eocd=i;break;}
 if(eocd<0||eocd+22+view.getUint16(eocd+20,true)!==data.length)throw Error('Invalid ZIP footer.');
 const count=view.getUint16(eocd+10,true),size=view.getUint32(eocd+12,true),offset=view.getUint32(eocd+16,true);
 if(view.getUint16(eocd+4,true)||view.getUint16(eocd+6,true)||count!==view.getUint16(eocd+8,true)||count<2||count>1500||size===0xffffffff||offset===0xffffffff||offset+size!==eocd)throw Error('Multi-volume, ZIP64 and oversized archives are unsupported.');
 const names=new Set(),ranges=[];let at=offset,total=0;const entries=[];
 for(let i=0;i<count;i++){
  if(at+46>eocd||view.getUint32(at,true)!==0x02014b50)throw Error('Invalid directory entry.');
  const flags=view.getUint16(at+8,true),method=view.getUint16(at+10,true),compressed=view.getUint32(at+20,true),original=view.getUint32(at+24,true),nameLen=view.getUint16(at+28,true),extraLen=view.getUint16(at+30,true),commentLen=view.getUint16(at+32,true),local=view.getUint32(at+42,true);
  if(flags&~0x800||method!==0||compressed!==original||original>PACK_LIMIT||original===0xffffffff||local===0xffffffff||at+46+nameLen+extraLen+commentLen>eocd)throw Error('Compressed, encrypted, descriptor or oversized entry rejected.');
  const name=new TextDecoder('utf-8',{fatal:true}).decode(data.subarray(at+46,at+46+nameLen));
  if(!PATH.test(name)||names.has(name))throw Error('Unknown, duplicate or unsafe archive path.');names.add(name);
  if(local+30>offset||view.getUint32(local,true)!==0x04034b50)throw Error('Invalid local entry.');
  const localName=view.getUint16(local+26,true),localExtra=view.getUint16(local+28,true),begin=local+30+localName+localExtra,end=begin+compressed;
  if(end>offset||view.getUint16(local+6,true)!==flags||view.getUint16(local+8,true)!==0||view.getUint32(local+18,true)!==compressed||view.getUint32(local+22,true)!==original)throw Error('Entry sizes or flags disagree.');
  if(new TextDecoder().decode(data.subarray(local+30,local+30+localName))!==name)throw Error('Archive filename mismatch.');
  total+=original;if(total>PACK_LIMIT)throw Error('Expanded project pack exceeds 200 MB.');
  ranges.push([local,end]);entries.push({name,bytes:original});at+=46+nameLen+extraLen+commentLen;
 }
 ranges.sort((a,b)=>a[0]-b[0]);if(ranges.some((r,i)=>i&&r[0]<ranges[i-1][1])||at!==eocd||!names.has('manifest.json')||!names.has('library.json'))throw Error('Overlapping entries or missing pack metadata.');
 return {entries,total};
}
export function encodePack(files){
 let total=0;for(const [name,data]of Object.entries(files)){if(!PATH.test(name)||!(data instanceof Uint8Array))throw Error('Invalid pack entry.');total+=data.length;}
 if(total>PACK_LIMIT)throw Error('This project exceeds the 200 MB portable-pack limit. Export metadata and large media separately.');
 const bytes=zipSync(files,{level:0,mtime:new Date(1980,0,1)});inspectZip(bytes);return bytes;
}
export function decodePack(bytes){inspectZip(bytes);return unzipSync(bytes,{filter:file=>PATH.test(file.name)&&file.originalSize<=PACK_LIMIT});}
if(typeof self!=='undefined'&&typeof document==='undefined')self.onmessage=({data})=>{
 try{if(data.action==='encode'){const output=encodePack(data.files);self.postMessage({ok:true,output},[output.buffer]);}
 else{const output=decodePack(data.bytes);self.postMessage({ok:true,output},Object.values(output).map(x=>x.buffer));}}
 catch(e){self.postMessage({ok:false,error:e.message});}
};

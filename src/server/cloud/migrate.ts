import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {ID} from '../config';
import {encodeMetadata,type MetadataStore} from './metadata';
export interface LegacyRow {kind:string;key:string;value:unknown;}
interface Row extends LegacyRow {expiresAt?:number;}
const canonical=(value:unknown):string=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const object=(value:unknown):Record<string,any>=>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid migration object');return value as Record<string,any>;};
/** SQLite read transaction includes committed WAL contents without changing the live database. */
export function readLegacySnapshot(path:string,team:string):LegacyRow[]{
 if(!ID.team.test(team))throw new Error('Invalid workspace');
 const db=new DatabaseSync(path,{readOnly:true});
 try{db.exec('BEGIN');const rows=db.prepare('SELECT kind,key,value FROM records WHERE team=? ORDER BY kind,key').all(team).map(row=>({kind:String(row.kind),key:String(row.key),value:JSON.parse(String(row.value)) as unknown}));db.exec('COMMIT');return rows;}
 finally{db.close();}
}
export function prepareLegacy(rows:LegacyRow[],team:string,now=Date.now()):Row[]{
 const output:Row[]=[],cardIds=new Set(rows.filter(r=>r.kind==='cards').map(r=>r.key));
 for(const row of rows){
  if(row.kind==='jobs'&&['queued','downloading','running'].includes(object(row.value).state))throw new Error('Finish pending legacy jobs before migration');
  if(!['cards','channels','settings','threads','observed','saves'].includes(row.kind))continue;
  encodeMetadata(row.value);let value=structuredClone(row.value),expiresAt:number|undefined;
  if(row.kind==='cards'){
   const card=object(value),actor=object(card.actor);
   if(card.id!==row.key||actor.teamId!==team||!ID.channel.test(actor.channelId)||!ID.file.test(card.fileId)||!ID.file.test(card.rootFileId)||typeof card.messageTs!=='string')throw new Error('Invalid legacy card identity');
   if(card.pdf!=='ready'||card.imageState!=='ready')throw new Error('Finish pending legacy previews before migration');
   if(card.origin){const url=new URL(card.origin);if(url.protocol!=='https:'||url.origin!==card.origin)throw new Error('Invalid legacy origin');}
   if(Array.isArray(card.attempts))card.attempts=Object.fromEntries(card.attempts.map((entry:unknown)=>{if(!Array.isArray(entry)||entry.length!==2||!Number.isSafeInteger(entry[0])||entry[0]<1||entry[0]>10)throw new Error('Invalid page upload');return [String(entry[0]),entry[1]];}));
   delete card.imageWork;delete card.updates;delete card.fence;value=card;
  }else if(row.kind==='channels'){
   if(!ID.channel.test(row.key)||!['auto','mention','off'].includes(object(value).mode))throw new Error('Invalid channel policy');
  }else if(row.kind==='settings'){
   if(row.key!=='initialized'||typeof value!=='boolean')throw new Error('Unknown legacy setting');
  }else if(row.kind==='threads'){
   const key=JSON.parse(row.key);if(!Array.isArray(key)||key.length!==4||key[0]!==team||!ID.channel.test(key[1])||!ID.file.test(key[3]))throw new Error('Invalid thread identity');
   if(typeof value!=='string'||!cardIds.has(value))continue;
  }else if(row.kind==='observed'){
   const item=object(value);if(item.team!==team||!ID.channel.test(item.channel)||!ID.file.test(item.file))throw new Error('Invalid observed share');
   if(typeof item.expires!=='number'||item.expires<=now)continue;expiresAt=item.expires;delete item.expires;
  }else if(row.kind==='saves'){
   const op=object(value),key=JSON.parse(row.key);if(!Array.isArray(key)||key[0]!==team||!object(op.receipt).saved||!cardIds.has(op.cardId))throw new Error('Incomplete saved revision');
   value={hash:op.hash,cardId:op.cardId,attempt:op.attempt,receipt:op.receipt};
  }
  encodeMetadata(value);output.push({kind:row.kind,key:row.key,value,expiresAt});
 }
 return output;
}
/** Validate all rows and conflicts before writes. Each insert is atomic; interrupted import can resume. */
export async function migrateLegacy(store:MetadataStore,rows:LegacyRow[],team:string,apply=false){
 const prepared=prepareLegacy(rows,team),digest=createHash('sha256').update(canonical(prepared)).digest('hex');
 const counts:Record<string,number>={};let existing=0;
 for(const row of prepared){
  counts[row.kind]=(counts[row.kind]??0)+1;const current=await store.get(row.kind,row.key);
  if(current!==undefined){if(canonical(current)!==canonical(row.value))throw new Error('Migration conflicts with existing '+row.kind+' metadata');existing++;}
 }
 if(apply)for(const row of prepared)await store.atomic(row.kind,row.key,current=>{
  if(current!==undefined&&canonical(current)!==canonical(row.value))throw new Error('Metadata changed during migration');
  return {value:current??row.value,expiresAt:row.expiresAt,result:undefined};
 });
 return {digest,counts,existing,applied:apply,total:prepared.length};
}

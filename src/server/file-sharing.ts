import type {SlackApi} from './slack-api';
import {ID} from './config';
import {object} from './errors';

/** Unshare events do not identify a channel. Only a complete, current snapshot may remove links.
 * This is invalidation evidence, never an authorization cache: requests still use authorizeFile. */
export async function sharedChannels(api:SlackApi,teamId:string,fileId:string):Promise<ReadonlySet<string>>{
 const response=await api.call('files.info',{file:fileId}),file=object(response.file);
 if(response.ok!==true||file.id!==fileId||file.has_more_shares===true||file.skipped_shares===true||
    (file.user_team!==undefined&&file.user_team!==teamId))throw new Error('File sharing information unavailable');
 const shares=object(file.shares),result=new Set<string>();
 for(const kind of ['public','private']){
  const entries=shares[kind]===undefined?{}:object(shares[kind]);
  for(const [channel,records] of Object.entries(entries)){
   if(!ID.channel.test(channel)||!Array.isArray(records))throw new Error('Incomplete file shares');
   for(const value of records){
    const share=object(value);
    if(typeof share.team_id!=='string'||typeof share.ts!=='string'||!/^\d+\.\d+$/.test(share.ts))throw new Error('Incomplete file share');
    if(share.team_id===teamId)result.add(channel);
   }
  }
 }
 // If Slack lists a shared channel but omitted its share records, absence is not revocation evidence.
 for(const key of ['channels','groups'])if(file[key]!==undefined){
  if(!Array.isArray(file[key])||!file[key].every(id=>typeof id==='string'&&ID.channel.test(id)&&result.has(id)))throw new Error('Incomplete file sharing snapshot');
 }
 return result;
}

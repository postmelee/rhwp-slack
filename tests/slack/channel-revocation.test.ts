import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {State} from '../../src/server/state';
import {SqliteMetadata} from '../../src/server/cloud/sqlite-metadata';
import {DurableTasks} from '../../src/server/cloud/tasks';
import {CloudApplication} from '../../src/server/cloud/application';
import {createCloudReceiver} from '../../src/server/cloud/receiver';
import {createSlackReceiver} from '../../src/server/receiver';
import type {Card} from '../../src/server/documents';
import {FakeApi,actor,config,bytes,file,channel,signed} from './support';

async function fixture(cloud:boolean){
 const dir=mkdtempSync(join(tmpdir(),'rhwp-revocation-')),path=join(dir,'state.sqlite');
 const state=new State(path,config.teamId),store=new SqliteMetadata(state),api=new FakeApi();
 let shared=new Set(['CTEST','CPRIVATE']),outage=false,partial=false;
 api.handler=async(method,args)=>{
  if(method==='conversations.info')return {ok:true,channel:{...channel,id:args.channel,is_private:args.channel==='CPRIVATE'}};
  if(method==='files.info'){
   if(outage)throw new Error('synthetic Slack outage');
   const allowed=args.file==='FTEST'?shared:new Set(['CTEST','CPRIVATE']);
   const shares={public:{},private:{}} as Record<string,Record<string,unknown>>;
   for(const id of allowed)shares[id==='CPRIVATE'?'private':'public'][id]=[{team_id:'TTEST',ts:'123.456'}];
   return {ok:true,file:{...file,id:args.file,shares,has_more_shares:partial}};
  }
  return api.response(method,args);
 };
 const cards=['CTEST','CPRIVATE'].flatMap(channelId=>[false,true].map(revision=>({
  id:randomUUID(),actor:{...actor,channelId},fileId:revision?'FREVISION':'FTEST',rootFileId:'FTEST',revision:revision?1:0,
  name:file.name,size:bytes.length,createdAt:Date.now(),pdf:'ready' as const,imageState:'ready' as const,
 })));
 for(const card of cards){if(cloud)await store.atomic('cards',card.id,()=>({value:card,result:undefined}));else state.put('cards',card.id,card);}
 for(const channelId of shared){const value={team:'TTEST',channel:channelId,file:'FTEST',parent:'123.456',at:Date.now()};if(cloud)await store.atomic('observed',channelId,()=>({value,result:undefined}));else state.put('observed',channelId,value);}
 const cfg={...config,publicOrigin:'https://editor.example.com',...(cloud?{}:{statePath:path})};
 const pending:string[]=[],tasks=new DurableTasks(store,{async publish(id,notBefore){if(notBefore===undefined)pending.push(id);}});
 const app=cloud?new CloudApplication(cfg,api,store,tasks,{download:async()=>bytes}):undefined;
 if(!cloud)state.close();
 const local=cloud?undefined:createSlackReceiver(cfg,api,{botId:'BBOT',botUserId:'UBOT'},{download:async()=>bytes});
 const remote=app?createCloudReceiver(cfg,app,{botId:'BBOT',botUserId:'UBOT'}):undefined;
 const runtime=remote??local!,documents=app??local!.documents!;
 if(local){await local.ready;for(const c of cards)local.preparations.retain(c.id,c.actor,c.fileId,c.name,bytes);}
 const server=await runtime.receiver.start({host:'127.0.0.1',port:0}),addr=server.address();assert.ok(addr&&typeof addr!=='string');
 const origin=`http://127.0.0.1:${addr.port}`;
 return {cards,documents,api,store,local,setShares(ids:string[]){shared=new Set(ids);},setOutage(v:boolean){outage=v;},setPartial(v:boolean){partial=v;},
  async event(type='file_unshared',eventId=randomUUID(),fileId='FTEST'){
   const body={type:'event_callback',team_id:'TTEST',api_app_id:'ATEST',event_id:eventId,event:{type,file_id:fileId},authorizations:[{team_id:'TTEST',user_id:'UBOT',is_bot:true}]};
   assert.equal((await signed(origin,body,{json:true})).status,200);
   if(remote)while(pending.length)await tasks.execute(pending.shift()!,(s,c)=>remote.events.execute(s,c));
   else for(let i=0;i<20;i++)await new Promise<void>(r=>setImmediate(r));
  },
  async removed(c:Card){return cloud?!!(await store.get<Card&{removed?:boolean}>('cards',c.id))?.removed:!local!.documents!.has(c.id);},
  async close(){await runtime.receiver.stop();if(local)await local.close();else state.close();rmSync(dir,{recursive:true,force:true});}
 };
}
for(const cloud of [false,true]){
 const label=cloud?'cloud':'local';
 test(`${label}: signed unshare preserves the other private channel, its revision and active sessions`,async()=>{
  const f=await fixture(cloud);try{
   const bearers=await Promise.all(f.cards.map(c=>f.documents.sessions.exchange(f.documents.sessions.issue(c.id,c.actor))));
   f.setShares(['CPRIVATE']);await f.event();
   for(const [i,c] of f.cards.entries()){
    if(c.actor.channelId==='CTEST'){
     assert.equal(await f.removed(c),true);await assert.rejects(f.documents.sessions.require(bearers[i]));
     if(f.local)assert.equal(f.local.preparations.get(c.id)?.bytes?.length??0,0);
    }else{
     assert.equal(await f.removed(c),false);await f.documents.sessions.require(bearers[i]);
     assert.deepEqual(await f.documents.ensureSource(c.id,c.actor),bytes);
    }
   }
  }finally{await f.close();}
 });
 test(`${label}: delayed unshare after reshare preserves current grants; missing event still denies access`,async()=>{
  const f=await fixture(cloud);try{
   await f.event();for(const c of f.cards)assert.equal(await f.removed(c),false);
   f.setShares(['CPRIVATE']);for(const c of f.cards.filter(c=>c.actor.channelId==='CTEST'))await assert.rejects(f.documents.authorize(c.id,c.actor));
   f.setShares(['CTEST','CPRIVATE']);for(const c of f.cards)await f.documents.authorize(c.id,c.actor);
   await f.event('file_deleted');for(const c of f.cards)assert.equal(await f.removed(c),true);
  }finally{await f.close();}
 });
 test(`${label}: API outage or incomplete shares never permanently revoke unrelated cards`,async()=>{
  const f=await fixture(cloud);try{
   for(const kind of ['outage','partial']){
    f.setOutage(kind==='outage');f.setPartial(kind==='partial');
    if(cloud)await assert.rejects(f.event());else await f.event();
    for(const c of f.cards)assert.equal(await f.removed(c),false);
   }
   f.setOutage(false);f.setPartial(false);for(const c of f.cards)await f.documents.authorize(c.id,c.actor);
  }finally{await f.close();}
 });
}

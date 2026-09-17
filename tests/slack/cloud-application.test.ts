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
import {EditorApi} from './editor-support';
import {actor,config,bytes} from './support';
function fixture(){
 const dir=mkdtempSync(join(tmpdir(),'rhwp-cloud-app-')),state=new State(join(dir,'metadata.sqlite'),'TTEST'),store=new SqliteMetadata(state),api=new EditorApi();
 const pending:string[]=[];let failPublish=false,failUpload=false;const tasks=new DurableTasks(store,{async publish(id){if(failPublish)throw new Error('queue unavailable');pending.push(id);}});
 const make=()=>new CloudApplication({...config,publicOrigin:'https://cloud.example.com'},api,store,tasks,{download:async()=>bytes,fetcher:async(url)=>{assert.ok(String(url).startsWith('https://files.slack.com/upload/v1/'));if(failUpload)throw new Error('upload down');return new Response('ok');},convert:async()=>({pdf:Buffer.from('%PDF-synthetic'),pageCount:12,pages:[1,2,3].map(page=>({page,png:Buffer.from('png')}))}),images:async()=>({pageCount:12,pages:Array.from({length:10},(_,i)=>({page:i+1,png:Buffer.from('png')}))})});
 return {store,api,tasks,make,pending,setPublishFailure(v:boolean){failPublish=v;},setUploadFailure(v:boolean){failUpload=v;},async drain(){while(pending.length){const id=pending.shift()!;await tasks.execute(id,(spec,ctx)=>make().execute(spec,ctx));}},close(){state.close();rmSync(dir,{recursive:true,force:true});}};
}
test('replacement workers build one thread card and persist file IDs without document bytes or upload URLs',async()=>{
 const f=fixture();try{
  const who={...actor,threadTs:'100.001'},id=await f.make().submit(who,'FTEST','thread:original');await f.drain();
  let card=await f.make().authorize(id,actor);assert.equal(card.pdf,'ready');assert.equal(card.imageState,'ready');assert.equal(card.images?.length,3);
  assert.equal(f.api.calls.filter(c=>c.method==='chat.postMessage').length,1);assert.equal(f.api.messages.get(card.messageTs!)?.thread_ts,'100.001');
  const saved=JSON.stringify(await f.store.list('cards'));assert.equal(saved.includes('/upload/v1/'),false);assert.equal(saved.includes('png'),false);
  await f.make().submit(who,'FTEST','thread:original');await f.drain();assert.equal(f.api.calls.filter(c=>c.method==='chat.postMessage').length,1);
  await f.make().morePages(id,actor,card.messageTs!);await f.drain();card=await f.make().authorize(id,actor);assert.equal(card.images?.length,10);assert.equal(card.imageState,'ready');
  const session=await f.make().sessions.exchange(await f.make().sessions.issue(id,actor));assert.deepEqual(await f.make().ensureSource((await f.make().sessions.require(session)).cardId,actor),bytes);
 }finally{f.close();}
});
test('saving survives a queue outage and retries the same request without duplicating revisions',async()=>{
 const f=fixture();try{
  const id=await f.make().submit({...actor,threadTs:'100.001'},'FTEST','thread:save');await f.drain();
  const app=f.make(),bearer=await app.sessions.exchange(await app.sessions.issue(id,actor)),session=await app.sessions.require(bearer),request=randomUUID();
  f.setPublishFailure(true);await assert.rejects(app.save(session,request,'hwp',bytes),/queue unavailable/);
  f.setPublishFailure(false);const receipt=await f.make().save(session,request,'hwp',bytes);assert.equal(receipt.saved,true);await f.drain();
  assert.equal((await f.make().status(session,request)).pdf,'ready');
  assert.equal(f.api.calls.filter(c=>c.method==='chat.postMessage').length,2);
  assert.ok(receipt.name.endsWith('_편집본_1.hwp'));
  const next=await f.make().save(session,randomUUID(),'hwp',bytes);assert.ok(next.name.endsWith('_편집본_2.hwp'));await f.drain();
  const stored=JSON.stringify(await f.store.list('saves'));assert.equal(stored.includes('/upload/v1/'),false);
 }finally{f.close();}
});
test('failed transfer retries on a new worker while keeping the original card and permissions',async()=>{
 const f=fixture();try{
  const id=await f.make().submit({...actor,threadTs:'100.001'},'FTEST','thread:retry');const first=f.pending.shift()!;await f.tasks.execute(first,(spec,ctx)=>f.make().execute(spec,ctx));
  const preview=f.pending.shift()!;f.setUploadFailure(true);await assert.rejects(f.tasks.execute(preview,(spec,ctx)=>f.make().execute(spec,ctx)));
  f.setUploadFailure(false);await f.tasks.execute(preview,(spec,ctx)=>f.make().execute(spec,ctx));assert.equal((await f.make().authorize(id,actor)).pdf,'ready');
  await f.make().invalidate('FTEST');await assert.rejects(f.make().ensureSource(id,actor));
  assert.equal(f.api.calls.filter(c=>c.method==='chat.postMessage').length,1);
 }finally{f.close();}
});

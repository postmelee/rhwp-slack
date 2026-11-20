import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {State} from '../../src/server/state';
import {SqliteMetadata} from '../../src/server/cloud/sqlite-metadata';
import {DurableTasks,TaskBusy,type Work,type TaskSpec,type TaskContext} from '../../src/server/cloud/tasks';
import {denied,UserError} from '../../src/server/errors';
import {attachSlackDiagnostics} from '../../src/server/slack-diagnostics';

function fixture(){
 const dir=mkdtempSync(join(tmpdir(),'rhwp-first-failure-')),state=new State(join(dir,'state.sqlite'),'TTEST');let now=0;
 const store=new SqliteMetadata(state,()=>now),records:Record<string,unknown>[]=[],published:{id:string;at?:number}[]=[];
 const make=()=>new DurableTasks(store,{async publish(id,at){published.push({id,at});}},()=>now,60_000,r=>records.push(r));
 return {store,records,published,make,advance(n:number){now+=n;},close(){state.close();rmSync(dir,{recursive:true,force:true});}};
}
const spec:TaskSpec={teamId:'TTEST',cardId:'synthetic-card',kind:'preview'};
const deleted=()=>attachSlackDiagnostics(new UserError('slack_rejected','private-file-name'),200,'file_deleted');
const skip=(ctx:TaskContext)=>{if(ctx.terminalNotice){ctx.terminalNotice.result='skipped';ctx.terminalNotice.reason='superseded';return true;}return false;};

test('first business failure survives later access denial, replacement worker and duplicate terminal delivery',async()=>{
 const f=fixture();try{
  const id=await f.make().enqueue('first-deleted',spec);
  await assert.rejects(f.make().execute(id,async()=>{throw deleted();}));
  await assert.rejects(f.make().execute(id,async()=>denied('card_removed')));
  await f.make().execute(id,async(_s,ctx)=>{if(!skip(ctx))denied('card_removed');});
  const work=await f.store.get<Work>('tasks',id);
  assert.equal(work?.failureCode,'access_denied');assert.equal(work?.firstFailureCode,'slack_rejected');
  assert.equal(work?.firstFailureDiagnostics?.slackError,'file_deleted');
  const first=f.records[0]?.firstFailure as Record<string,unknown>;
  assert.equal(first.errorCode,'slack_rejected');assert.equal(first.slackError,'file_deleted');
  assert.equal(f.records[0]?.errorCode,'access_denied');assert.equal(f.records[0]?.denialReason,'card_removed');
  assert.equal(first.errorId,work?.firstFailureDetails?.errorId);
  await f.make().execute(id,async(_s,ctx)=>{skip(ctx);});assert.equal(f.records.length,1);
  assert.equal(JSON.stringify([work,f.records]).includes('private-file-name'),false);
 }finally{f.close();}
});

test('busy claims are not first failures and watchdog termination preserves earliest business evidence',async()=>{
 const f=fixture();try{
  const id=await f.make().enqueue('first-watchdog',spec);
  await assert.rejects(f.make().execute(id,async()=>{throw new TaskBusy('busy');}));
  assert.equal((await f.store.get<Work>('tasks',id))?.firstFailureCode,undefined);
  await assert.rejects(f.make().execute(id,async()=>{throw deleted();}));
  f.advance(15*60_000);
  const watcher=f.published.find(value=>value.at!==undefined)!;
  await f.make().execute(watcher.id,async(_s,ctx)=>{skip(ctx);});
  assert.equal((f.records[0]?.firstFailure as Record<string,unknown>).slackError,'file_deleted');
  assert.equal(f.records.length,1);
 }finally{f.close();}
});

test('persisted first failure summary is revalidated and cannot leak arbitrary fields',async()=>{
 const f=fixture();try{
  const id=await f.make().enqueue('first-untrusted',spec);
  await f.store.atomic<Work,void>('tasks',id,current=>({value:{...current!,state:'failed',terminalAt:0,failureCode:'access_denied',firstFailureCode:'private-code',firstFailureDiagnostics:{slackError:'private-code',httpStatus:999},firstFailureDetails:undefined},result:undefined}));
  await f.make().execute(id,async(_s,ctx)=>{skip(ctx);});
  const first=f.records[0]?.firstFailure as Record<string,unknown>;
  assert.equal(first.errorCode,'internal');assert.equal(first.slackError,'unknown');assert.equal(first.httpStatus,undefined);
  assert.equal(JSON.stringify(f.records).includes('private-code'),false);
 }finally{f.close();}
});

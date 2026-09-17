import test from 'node:test';
import assert from 'node:assert/strict';
import {Preparations} from '../../src/server/jobs';
import {FakeApi,config,actor,bytes,file} from './support';
test('request identity deduplicates downloads, retains source hash and expires bytes',async()=>{
  let now=0,downloads=0,notices=0;
  const jobs=new Preparations(config,new FakeApi(),{now:()=>now,ttlMs:10,download:async()=>{downloads++;return bytes;},notify:async()=>{notices++;}});
  try {
    const first=jobs.submit(actor,'FTEST','open','trigger');
    assert.deepEqual(jobs.submit(actor,'FTEST','open','trigger'),{id:first.id,duplicate:true});
    const distinct=jobs.submit(actor,'FTEST','pdf','another-trigger');
    await jobs.idle();assert.equal(downloads,2);assert.equal(notices,2);
    assert.equal(jobs.get(first.id)?.state,'ready');assert.equal(jobs.get(distinct.id)?.mode,'pdf');
    assert.match(jobs.get(first.id)?.contentHash??'',/^[a-f0-9]{64}$/);
    now=11;assert.equal(jobs.get(first.id)?.state,'expired');assert.equal(jobs.get(first.id)?.bytes,undefined);
  } finally {await jobs.close();}
});
test('permission revocation after download prevents ready bytes and ready notification',async()=>{
  const api=new FakeApi();let downloaded=false,notified='';
  api.handler=async(method,args)=>method==='files.info'&&downloaded?{ok:true,file:{...file,shares:{}}}:api.response(method,args);
  const jobs=new Preparations(config,api,{download:async()=>{downloaded=true;return bytes;},notify:async job=>{notified=job.state;}});
  try {const {id}=jobs.submit(actor,'FTEST','open','revoked');await jobs.idle();assert.equal(jobs.get(id)?.state,'failed');assert.equal(jobs.get(id)?.bytes,undefined);assert.equal(notified,'failed');}finally{await jobs.close();}
});
test('queue capacity, transfer cancellation, memory budget and notification failures are bounded',async()=>{
  const api=new FakeApi();let started!:()=>void;const entered=new Promise<void>(r=>{started=r;});
  const jobs=new Preparations(config,api,{concurrency:1,queueLimit:1,download:async(_file,_actor,_token,signal)=>{
    started();return new Promise<Buffer>((_resolve,reject)=>signal!.addEventListener('abort',()=>reject(signal!.reason),{once:true}));
  }});
  const first=jobs.submit(actor,'FTEST','open','first');await entered;
  jobs.submit(actor,'FTEST','open','queued');assert.throws(()=>jobs.submit(actor,'FTEST','open','overflow'),/요청이 많습니다/);
  jobs.invalidate('TTEST','FTEST');await jobs.idle();assert.equal(jobs.get(first.id)?.state,'expired');await jobs.close();
  const budget=new Preparations(config,api,{maxBytes:1,download:async()=>{throw new Error('must not download');}});
  const limited=budget.submit(actor,'FTEST','open','budget');await budget.idle();assert.equal(budget.get(limited.id)?.state,'failed');await budget.close();
  let downloads=0;
  const notified=new Preparations(config,api,{download:async()=>{downloads++;return bytes;},notify:async()=>{throw new Error('send failed');}});
  const ready=notified.submit(actor,'FTEST','open','notify');await notified.idle();assert.equal(notified.get(ready.id)?.state,'ready');assert.equal(downloads,1);await notified.close();
});
test('job deadline aborts API work before any download',async()=>{
  const api=new FakeApi();api.handler=async(_m,_a,signal)=>new Promise((_resolve,reject)=>signal!.addEventListener('abort',()=>reject(signal!.reason),{once:true}));
  const jobs=new Preparations(config,api,{timeoutMs:10,download:async()=>{throw new Error('must not download');}});
  try {const {id}=jobs.submit(actor,'FTEST','open','timeout');await jobs.idle();assert.equal(jobs.get(id)?.state,'failed');assert.match(jobs.get(id)?.error??'',/초과/);}finally{await jobs.close();}
});

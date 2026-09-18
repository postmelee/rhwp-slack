import test from 'node:test';
import assert from 'node:assert/strict';
import {Startup} from '../../src/editor/startup';
test('a stalled startup is bounded and disposes a late SDK instance',async()=>{
 let resolve!:(v:{destroy:()=>void})=>void;let destroyed=0;
 const startup=new Startup(10),late=new Promise<{destroy:()=>void}>(r=>resolve=r);
 await assert.rejects(startup.run(()=>late,v=>v.destroy()),/시간이 오래/);
 resolve({destroy(){destroyed++;}});await new Promise(r=>setImmediate(r));assert.equal(destroyed,1);
 await assert.rejects(startup.run(async()=>{throw new Error('must not start');}),/시간이 오래/);
});
test('successful initialization clears its deadline without canceling the editing session',async()=>{
 const startup=new Startup(10);assert.equal(await startup.run(async()=>1),1);startup.finish();
 await new Promise(r=>setTimeout(r,20));assert.equal(startup.signal.aborted,false);
});

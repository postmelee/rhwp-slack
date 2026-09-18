import test from 'node:test';
import assert from 'node:assert/strict';
import {BoundedWork,serialWrites} from '../../src/server/concurrency';
const gate=()=>{let release!:()=>void;const promise=new Promise<void>(r=>release=r);return {promise,release};};
test('uploads are bounded at two, keep completed work, and settle peers before surfacing failure',async()=>{
 const pool=new BoundedWork(2),a=gate(),b=gate(),started=gate();let active=0,peak=0,completed=false;
 await pool.add(async()=>{active++;peak=Math.max(peak,active);await a.promise;active--;throw new Error('transfer');});
 await pool.add(async()=>{active++;peak=Math.max(peak,active);started.release();await b.promise;active--;completed=true;});
 await started.promise;let thirdRan=false;
 const third=pool.add(async()=>{thirdRan=true;});a.release();await assert.rejects(third,/transfer/);
 let settled=false;const finish=pool.finish().finally(()=>{settled=true;});const checked=assert.rejects(finish,/transfer/);
 await new Promise(r=>setImmediate(r));assert.equal(settled,false);b.release();await checked;
 assert.equal(completed,true);assert.equal(thirdRan,false);assert.equal(active,0);assert.equal(peak,2);
});
test('metadata writes remain serial even after one failed checkpoint',async()=>{
 const serial=serialWrites(),a=gate(),events:string[]=[];
 const first=serial(async()=>{events.push('a:start');await a.promise;events.push('a:end');throw new Error('write');});
 const rejected=assert.rejects(first,/write/);
 const second=serial(async()=>{events.push('b');});await new Promise(r=>setImmediate(r));assert.deepEqual(events,['a:start']);
 a.release();await rejected;await second;assert.deepEqual(events,['a:start','a:end','b']);
});

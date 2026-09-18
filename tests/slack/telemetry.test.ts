import test from 'node:test';
import assert from 'node:assert/strict';
import {traceTask,measured,milestone,errorCode,conversionMetric} from '../../src/server/cloud/telemetry';
import {validMetric} from '../../src/conversion/convert.mjs';
import {UserError} from '../../src/server/errors';
const context={signal:new AbortController().signal,async checkpoint(){},id:'a'.repeat(64),attempt:2};
const spec={teamId:'TTEST',cardId:'private-card-name',kind:'preview' as const};
test('stage failures keep numeric timings and error codes without logging exception contents or document identifiers',async()=>{
 const rows:Record<string,unknown>[]=[];
 await assert.rejects(traceTask(spec,context,()=>measured('download',async()=>{throw new UserError('slack_unavailable','xoxb-secret https://files.slack.com/private document name');}),r=>rows.push(r)));
 const serialized=JSON.stringify(rows);for(const secret of ['xoxb-secret','files.slack.com','document name','private-card-name','TTEST'])assert.equal(serialized.includes(secret),false);
 assert.equal(rows.find(r=>r.event==='stage_finished')?.errorCode,'slack_unavailable');
 assert.equal(rows.at(-1)?.ok,false);assert.equal(rows.at(-1)?.attempt,2);assert.equal(rows.at(-1)?.taskId,'a'.repeat(64));
 assert.ok(rows.every(r=>typeof r.elapsedMs==='number'));assert.equal(errorCode({code:'xoxb-secret',message:'document'}),'internal');
});
test('overlapping async traces keep their own stages and metrics; failing log sinks never fail document work',async()=>{
 const first:Record<string,unknown>[]=[],second:Record<string,unknown>[]=[];
 await Promise.all([
  traceTask(spec,context,()=>measured('upload_pdf',async()=>{await new Promise(r=>setTimeout(r,10));milestone('pdf_ready');conversionMetric({stage:'pdf',phase:'finish',durationMs:12});}),r=>first.push(r)),
  traceTask(spec,{...context,id:'b'.repeat(64)},()=>measured('upload_png',async()=>{milestone('first_image');}),r=>second.push(r)),
 ]);
 assert.ok(first.every(r=>r.taskId==='a'.repeat(64)));assert.ok(second.every(r=>r.taskId==='b'.repeat(64)));
 assert.equal(first.some(r=>r.stage==='upload_png'),false);assert.equal(second.some(r=>r.name==='pdf_ready'),false);
 assert.equal(await traceTask(spec,context,async()=>42,()=>{throw new Error('sink unavailable');}),42);
 await assert.rejects(measured('secret-document-name',async()=>{}),/Unknown measurement/);
});
test('child metric protocol strips arbitrary fields and rejects invalid stages and unbounded numeric values',()=>{
 assert.deepEqual(validMetric({stage:'parse',phase:'finish',durationMs:15,rssBytes:1024,message:'secret',document:'private'}),{stage:'parse',phase:'finish',durationMs:15,rssBytes:1024});
 for(const value of [null,{stage:'secret',phase:'finish'},{stage:'pdf',phase:'xoxb-secret'},{stage:'pdf',phase:'finish',durationMs:Infinity},{stage:'png',phase:'finish',rssBytes:-1}])assert.equal(validMetric(value),undefined);
});

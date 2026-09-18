import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {convertPreview,convertPageImages} from '../../src/conversion/convert.mjs';
for(const format of ['hwp','hwpx'])test(`real ${format} conversion streams PDF first and reuses identical page pixels on range retry`,async()=>{
 const source=await readFile(`tests/fixtures/viewer-two-pages.${format}`),events=[];
 const result=await convertPreview(source,{onPdf:()=>events.push('pdf'),onPage:p=>events.push(p.page)});
 assert.deepEqual(events,['pdf',1,2]);assert.equal(result.pageCount,2);
 const retry=await convertPageImages(source,{start:2,end:3});assert.equal(retry.pages.length,1);assert.equal(retry.pages[0].page,2);
 assert.deepEqual(retry.pages[0].png,result.pages[1].png);
});

test('repeated documents compile once; malformed input, abort and timeout discard runtime and recover',async()=>{
 const {closeConversionRuntime,convertPdf}=await import('../../src/conversion/convert.mjs');
 await closeConversionRuntime();
 const a=await readFile('tests/fixtures/viewer-two-pages.hwp'),b=await readFile('tests/fixtures/viewer-two-pages.hwpx');
 const metrics=[];
 const options={onMetric:v=>metrics.push(v)};
 const first=await convertPreview(a,options);await convertPreview(b,options);const again=await convertPreview(a,options);
 assert.equal(metrics.filter(m=>m.stage==='wasm_compile'&&m.phase==='finish').length,1);
 assert.equal(metrics.filter(m=>m.stage==='runtime_reuse').length,2);
 assert.deepEqual(first.pages,again.pages);
 assert.ok(metrics.filter(m=>m.stage==='wasm_init'&&m.phase==='finish').length===3);
 for(const fail of [()=>convertPreview(Buffer.from('invalid')),()=>{
  const controller=new AbortController();return convertPreview(a,{signal:controller.signal,onMetric:m=>{if(m.stage==='parse')controller.abort();}});
 },()=>convertPreview(a,{timeoutMs:1})]){
  await assert.rejects(fail());const recovered=[];
  assert.equal((await convertPdf(b,{onMetric:m=>recovered.push(m)})).subarray(0,5).toString(),'%PDF-');
  assert.equal(recovered.filter(m=>m.stage==='wasm_compile'&&m.phase==='finish').length,1);
 }
 await closeConversionRuntime();
});

test('queue capacity bounds concurrent callers and keeps each result tied to its document',async()=>{
 const {closeConversionRuntime}=await import('../../src/conversion/convert.mjs');await closeConversionRuntime();
 const a=await readFile('tests/fixtures/viewer-two-pages.hwp');
 const jobs=Array.from({length:4},()=>convertPreview(a));
 await assert.rejects(convertPreview(a),e=>e.code==='conversion_busy');
 const values=await Promise.all(jobs);for(const v of values)assert.deepEqual(v.pages,values[0].pages);
 const controller=new AbortController();controller.abort();
 await assert.rejects(convertPreview(a,{signal:controller.signal}),e=>e.code==='conversion_aborted');
 await closeConversionRuntime();
});

test('queued cancellation is prompt and does not stop the active document',async()=>{
 const {closeConversionRuntime}=await import('../../src/conversion/convert.mjs');await closeConversionRuntime();
 const a=await readFile('tests/fixtures/viewer-two-pages.hwp');
 let release;const gate=new Promise(r=>release=r);let reached;const started=new Promise(r=>reached=r);
 const active=convertPreview(a,{onPdf:async()=>{reached();await gate;}});
 await started;
 try{await assert.rejects(convertPreview(a,{timeoutMs:20}),e=>e.code==='conversion_timeout');}
 finally{release();}
 assert.equal((await active).pageCount,2);await closeConversionRuntime();
});

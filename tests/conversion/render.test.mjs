import test from 'node:test';
import {AsyncLocalStorage} from 'node:async_hooks';
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

test('repeated documents compile once; malformed input and active abort discard runtime and recover',async()=>{
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
 }]){
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

test('bounded reuse recycles a long series without accumulating document state',async()=>{
 const {closeConversionRuntime}=await import('../../src/conversion/convert.mjs');await closeConversionRuntime();
 const a=await readFile('tests/fixtures/viewer-two-pages.hwp');let compiles=0,reuses=0,reference;
 for(let i=0;i<22;i++){
  const r=await convertPageImages(a,{start:1,end:1,onMetric:m=>{if(m.stage==='wasm_compile'&&m.phase==='finish')compiles++;if(m.stage==='runtime_reuse')reuses++;}});
  reference??=r.pages[0].png;assert.deepEqual(r.pages[0].png,reference);
 }
 assert.ok(compiles>=2);assert.ok(reuses>0);await closeConversionRuntime();
});


test('built converter deadline terminates real rendering and the next request recovers',async()=>{
 const {convertPdf,closeConversionRuntime}=await import('../../src/conversion/convert.mjs');await closeConversionRuntime();
 const bytes=await readFile('tests/fixtures/viewer-two-pages.hwp');
 await assert.rejects(convertPdf(bytes,{timeoutMs:1}),e=>e.code==='conversion_timeout');
 assert.equal((await convertPdf(bytes)).subarray(0,5).toString(),'%PDF-');await closeConversionRuntime();
});


test('deadline during active output discards the runtime before a recovery request',async()=>{
 const {convertPdf,closeConversionRuntime}=await import('../../src/conversion/convert.mjs');await closeConversionRuntime();
 const bytes=await readFile('tests/fixtures/viewer-two-pages.hwp');await convertPdf(bytes);
 let release;const gate=new Promise(r=>release=r);let outputStarted=false;
 try{await assert.rejects(convertPreview(bytes,{timeoutMs:5000,onPdf:async()=>{outputStarted=true;await gate;}}),e=>e.code==='conversion_timeout');}
 finally{release();}
 assert.equal(outputStarted,true,'deadline must exercise active output, not queue cancellation');
 const recovered=[];assert.equal((await convertPdf(bytes,{onMetric:m=>recovered.push(m)})).subarray(0,5).toString(),'%PDF-');
 assert.equal(recovered.filter(m=>m.stage==='wasm_compile'&&m.phase==='finish').length,1);await closeConversionRuntime();
});


test('reused child metrics retain the current request context',async()=>{
 const {convertPdf,closeConversionRuntime}=await import('../../src/conversion/convert.mjs');await closeConversionRuntime();
 const bytes=await readFile('tests/fixtures/viewer-two-pages.hwp'),context=new AsyncLocalStorage(),events=[];
 for(const request of ['first','second'])await context.run(request,()=>convertPdf(bytes,{onMetric:metric=>events.push({request,observed:context.getStore(),...metric})}));
 for(const event of events)assert.equal(event.observed,event.request,event.stage);
 assert.equal(events.filter(e=>e.stage==='wasm_compile'&&e.phase==='finish').length,1);
 assert.equal(events.filter(e=>e.stage==='wasm_init'&&e.phase==='finish').length,2);
 assert.equal(events.filter(e=>e.stage==='runtime_reuse').length,1);await closeConversionRuntime();
});

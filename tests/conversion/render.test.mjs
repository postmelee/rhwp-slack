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

import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {DevDocuments} from '../../src/server/dev-documents.mjs';
import {convertPdf} from '../../src/conversion/convert.mjs';
test('local tickets expire and concurrent conversion is rejected',async()=>{
  let now=0,release,entered;const started=new Promise(r=>{entered=r;});const pending=new Promise(r=>{release=r;});
  const store=new DevDocuments({now:()=>now,ttlMs:10,convert:async()=>{entered();await pending;return Buffer.from('%PDF-1.4');}});
  let origin;
  const server=createServer(async(req,res)=>{await store.handle(req,res,new URL(req.url,origin).pathname,origin);});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${server.address().port}`;
  try{
    const options={method:'POST',headers:{Origin:origin,'X-Document-Name':encodeURIComponent('문서.hwp')},body:'sample'};
    const first=fetch(origin+'/api/dev/documents',options);
    await started;
    let second=await fetch(origin+'/api/dev/documents',{...options,headers:{Origin:'https://other.invalid'}});assert.equal(second.status,403);
    second=await fetch(origin+'/api/dev/documents',options);assert.equal(second.status,429);
    release();const response=await first;assert.equal(response.status,201);const {id}=await response.json();
    assert.equal(store.get(id).name,'문서.hwp');assert.equal((await fetch(origin+`/api/dev/documents/${id}/pdf`)).status,200);
    now=11;assert.equal(store.get(id),undefined);assert.equal((await fetch(origin+`/api/dev/documents/${id}/source`)).status,404);
  }finally{release();await new Promise(r=>server.close(r));}
});
test('converter deadline rejects and terminates the isolated process',async()=>{
  await assert.rejects(convertPdf(Buffer.from('bad'),{timeoutMs:1}),/시간이 초과/);
});

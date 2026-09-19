import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {editorRoutes,type EditorDocuments,type EditorSaves} from '../../src/server/editor-routes';

test('only the configured editor can exchange tickets or use authenticated CORS; secrets stay uncacheable',async()=>{
 const api='https://api.example.com',editor='https://rhwp-editor.pages.dev';let exchanges=0;
 const documents={sessions:{exchange:async()=>{exchanges++;return 's'.repeat(43);},require:async()=>{throw Error('invalid session');}},authorize:async()=>{},ensureSource:async()=>{}} as unknown as EditorDocuments;
 const handler=editorRoutes(api,documents,{} as EditorSaves,editor);
 const server=createServer((req,res)=>{void handler(req,res,()=>res.writeHead(404).end());});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 const address=server.address();assert.ok(address&&typeof address!=='string');const origin=`http://127.0.0.1:${address.port}`;
 const url=origin+'/api/editor/exchange';
 try{
  for(const o of ['https://evil.pages.dev','https://rhwp-editor.pages.dev.evil.invalid','null']){
    const r=await fetch(url,{method:'OPTIONS',headers:{Origin:o,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}});assert.equal(r.status,403);assert.equal(r.headers.get('access-control-allow-origin'),null);assert.equal(r.headers.get('cache-control'),'no-store');
  }
  const options=await fetch(url,{method:'OPTIONS',headers:{Origin:editor,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization, content-type, x-save-request-id, x-document-format'}});
  assert.equal(options.status,204);assert.equal(options.headers.get('access-control-allow-origin'),editor);assert.equal(options.headers.get('vary'),'Origin');assert.equal(options.headers.get('access-control-allow-credentials'),null);assert.equal(options.headers.get('cache-control'),'no-store');
  const wrongHeader=await fetch(url,{method:'OPTIONS',headers:{Origin:editor,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'cookie'}});assert.equal(wrongHeader.status,403);
  const request=(o:string)=>fetch(url,{method:'POST',headers:{Origin:o,'Content-Type':'application/json'},body:JSON.stringify({ticket:'t'.repeat(43)})});
  assert.equal((await request('https://evil.pages.dev')).status,403);assert.equal(exchanges,0);
  for(const o of [api,editor]){const r=await request(o);assert.equal(r.status,200);assert.equal(r.headers.get('access-control-allow-origin'),o);assert.equal(r.headers.get('cache-control'),'no-store');}
  assert.equal(exchanges,2);
 }finally{await new Promise<void>((r,j)=>server.close(e=>e?j(e):r()));}
});

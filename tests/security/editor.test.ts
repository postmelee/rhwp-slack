import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Sessions} from '../../src/server/sessions';
import {Uploads} from '../../src/server/uploads';
import {editorServer,EditorApi} from '../slack/editor-support';
import {actor,config,bytes} from '../slack/support';
test('tickets are one-use, expire, and cannot survive invalidation while authorization is in flight',async()=>{
  let now=0;let resolve!:()=>void;let gate:Promise<void>|undefined;
  const sessions=new Sessions(()=>now,async()=>{await gate;});
  const ticket=sessions.issue('card',actor);const token=await sessions.exchange(ticket);await assert.rejects(sessions.exchange(ticket));
  now=10*60_000;await assert.rejects(sessions.require(token));
  const old=sessions.issue('card',actor);now+=60_000;await assert.rejects(sessions.exchange(old));
  gate=new Promise<void>(r=>resolve=r);const request=sessions.exchange(sessions.issue('card',actor));sessions.invalidate('card');resolve();await assert.rejects(request);
});
test('editor exchange/read/save/status enforce origin, session and current file membership',async()=>{
  let now=0;const server=await editorServer({now:()=>now});try{
    const card=await server.prepare();const ticket=server.documents!.sessions.issue(card,actor);
    const exchange=(origin:string)=>fetch(server.origin+'/api/editor/exchange',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({ticket})});
    assert.equal((await exchange('https://attacker.invalid')).status,403);
    const response=await exchange(server.publicOrigin);assert.equal(response.status,200);const token=(await response.json() as {token:string}).token;
    assert.equal((await exchange(server.publicOrigin)).status,403);
    assert.equal((await fetch(server.origin+'/api/editor/source')).status,403);
    const headers={Authorization:`Bearer ${token}`};const source=await fetch(server.origin+'/api/editor/source',{headers});assert.equal(source.status,200);assert.equal(source.headers.get('cache-control'),'no-store');assert.deepEqual(Buffer.from(await source.arrayBuffer()),bytes);
    const api=server.api;api.handler=async(method,args)=>method==='conversations.members'?{ok:true,members:[],response_metadata:{next_cursor:''}}:api.response(method,args);
    for(const path of ['source','document','saves/'+randomUUID()])assert.equal((await fetch(server.origin+'/api/editor/'+path,{headers})).status,403);
    const save=await fetch(server.origin+'/api/editor/save',{method:'POST',headers:{...headers,Origin:server.publicOrigin,'Content-Type':'application/octet-stream','X-Save-Request-Id':randomUUID(),'X-Document-Format':'hwp'},body:bytes});assert.equal(save.status,403);
    await assert.rejects(server.documents!.present(card,{...actor,channelId:'CPRIVATE'},'trigger'));
    now+=60*60_000;assert.equal((await fetch(server.origin+'/api/editor/source',{headers})).status,403);
  }finally{await server.stop();}
});
test('upload URL is allowlisted, receives no bearer, and sharing waits for fresh authorization',async()=>{
  const api=new EditorApi();let requests=0;const uploads=new Uploads(api,config,async(url,init)=>{requests++;assert.match(String(url),/^https:\/\/files.slack.com\/upload\/v1\//);assert.equal(new Headers(init?.headers).get('authorization'),null);assert.equal(init?.redirect,'error');return new Response('ok');});
  await assert.rejects(uploads.share({},bytes,'edit.hwp',actor,async()=>{throw new Error('revoked');}));
  assert.equal(requests,1);assert.equal(api.calls.filter(c=>c.method==='files.completeUploadExternal').length,0);
  api.handler=async()=>({ok:true,file_id:'FBAD',upload_url:'https://attacker.invalid/upload/v1/a'});
  await assert.rejects(uploads.share({},bytes,'edit.hwp',actor,async()=>{}));assert.equal(requests,1);
});
test('uncertain completion keeps the same file ID across retries without sharing another copy',async()=>{
  const api=new EditorApi();api.handler=async(method,args)=>{if(method==='files.completeUploadExternal')throw new Error('network');return api.response(method,args);};
  const uploads=new Uploads(api,config,async()=>new Response('ok'));const attempt={};
  await assert.rejects(uploads.share(attempt,bytes,'edit.hwp',actor,async()=>{}));await assert.rejects(uploads.share(attempt,bytes,'edit.hwp',actor,async()=>{}));
  assert.equal(api.calls.filter(c=>c.method==='files.getUploadURLExternal').length,1);assert.equal(api.calls.filter(c=>c.method==='files.completeUploadExternal').length,1);
});
test('saving parses the export in an isolated process and rejects malformed or over-page-limit documents before upload',async()=>{
  const {validateDocument}=await import('../../src/server/validate-document');
  const {default:init,HwpDocument}=await import('@rhwp/core');const {readFileSync}=await import('node:fs');
  await validateDocument(bytes);await validateDocument(readFileSync('tests/fixtures/viewer-two-pages.hwpx'));
  await assert.rejects(validateDocument(Buffer.from([80,75,3,4,0])));
  await init({module_or_path:readFileSync('node_modules/@rhwp/core/rhwp_bg.wasm')});
  const doc=HwpDocument.createEmpty();doc.createBlankDocument();let para=0;
  for(let i=0;i<200;i++)para=JSON.parse(doc.insertPageBreak(0,para,0)).paraIdx;
  const large=Buffer.from(doc.exportHwp());doc.free();await assert.rejects(validateDocument(large));
  await assert.rejects(validateDocument(bytes,1));
});

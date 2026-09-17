import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {editorServer,EditorApi} from './editor-support';
import {actor,bytes,signed} from './support';
import {object} from '../../src/server/errors';
async function until(check:()=>boolean){for(let i=0;i<100;i++){if(check())return;await delay(5);}assert.fail('operation not received');}
test('card opens Studio before PDF is ready; PDF link references a privately uploaded file in the same card',async()=>{
  let release!:()=>void;const gate=new Promise<void>(r=>release=r);
  const server=await editorServer({convert:async()=>{await gate;return Buffer.from('%PDF-test');}});
  try{
    const id=await server.prepare();const initial=JSON.stringify(server.api.calls.find(c=>c.method==='chat.postMessage')!.args);
    assert.doesNotMatch(initial,/문서 제목을 눌러 편집/);assert.doesNotMatch(initial,/rhwp_open|preview_url|ticket=|PDF로 변환/);
    await server.documents!.present(id,{teamId:'TTEST',userId:'UTEST',channelId:'CTEST'},'trigger');
    assert.match(JSON.stringify(server.api.calls.find(c=>c.method==='entity.presentDetails')!.args),/\/editor\/#ticket=/);
    release();await server.documents!.pdf.idle();await until(()=>server.api.calls.some(c=>c.method==='chat.update'));
    const updated=JSON.stringify(server.api.calls.find(c=>c.method==='chat.update')!.args);
    assert.match(updated,/PDF로 보기/);assert.match(updated,/rhwp-test.slack.com\/files\/UBOT\/FUPLOAD/);assert.doesNotMatch(updated,/preview_url|ticket=/);
  }finally{release();await server.stop();}
});
test('signed native entity event opens Studio; legacy button guides users without reusing its invalid trigger',async()=>{
  const server=await editorServer();try{
    const id=await server.prepare();
    const event={type:'event_callback',api_app_id:'ATEST',team_id:'TTEST',event_id:'EvDETAIL',event:{type:'entity_details_requested',user:'UTEST',channel:'CTEST',external_ref:{id,type:'document'},entity_url:server.documents!.url(id),trigger_id:'detail.trigger'}};
    assert.equal((await signed(server.origin,event,{json:true})).status,200);await signed(server.origin,event,{json:true});
    await until(()=>server.api.calls.filter(c=>c.method==='entity.presentDetails').length===1);
    const action={type:'block_actions',api_app_id:'ATEST',team:{id:'TTEST'},user:{id:'UTEST'},trigger_id:'action.trigger',container:{type:'entity_detail',channel_id:'CTEST',entity_url:server.documents!.url(id),external_ref:{id}},actions:[{type:'button',action_id:'rhwp_open',value:id}]};
    assert.equal((await signed(server.origin,action)).status,200);await signed(server.origin,action);
    await until(()=>server.api.calls.some(c=>c.method==='chat.postEphemeral'&&String(c.args.text).includes('문서 제목')));
    assert.equal(server.api.calls.filter(c=>c.method==='entity.presentDetails').length,1);
  }finally{await server.stop();}
});
test('same export has one HWP upload, a different payload conflicts, PDF failure preserves save receipt',async()=>{
  const server=await editorServer({convert:async()=>{throw new Error('conversion failed');}});try{
    const card=await server.prepare();await server.documents!.pdf.idle();const {session}=await server.session(card);const id=randomUUID();
    const [one,two]=await Promise.all([server.saves!.save(session,id,'hwp',bytes),server.saves!.save(session,id,'hwp',bytes)]);
    assert.equal(one.fileId,two.fileId);assert.equal(one.saved,true);await server.documents!.pdf.idle();
    assert.equal((await server.saves!.status(session,id)).pdf,'failed');
    const repeated=await server.saves!.save(session,id,'hwp',bytes);assert.equal(repeated.fileId,one.fileId);
    await assert.rejects(server.saves!.save(session,id,'hwp',Buffer.concat([bytes,Buffer.from('different')])) ,/같은 저장 요청/);
    assert.equal(server.api.calls.filter(c=>c.method==='files.completeUploadExternal').length,1);
  }finally{await server.stop();}
});
test('lost completion response reconciles original file ID and never repeats completion or original upload',async()=>{
  const api=new EditorApi();api.handler=async(method,args)=>{const result=api.response(method,args);if(method==='files.completeUploadExternal')throw new Error('lost response');return result;};
  const server=await editorServer({api,convert:async()=>{throw new Error('no pdf');}});try{
    const card=await server.prepare();await server.documents!.pdf.idle();const {session}=await server.session(card);const id=randomUUID();
    const first=await server.saves!.save(session,id,'hwp',bytes);assert.equal(first.saved,true);
    const again=await server.saves!.save(session,id,'hwp',bytes);assert.equal(again.fileId,first.fileId);
    assert.equal(api.calls.filter(c=>c.method==='files.getUploadURLExternal').length,1);
    assert.equal(api.calls.filter(c=>c.method==='files.completeUploadExternal').length,1);
  }finally{await server.stop();}
});

for(const parent of [undefined,'100.001'])test(`source PDF and saved revisions reply to ${parent?'existing parent, not card reply':'new card thread'}`,async()=>{
  const server=await editorServer();try{
    const {id}=server.preparations.submit({...actor,...(parent?{threadTs:parent}:{})},'FTEST','open','thread-test');
    await server.preparations.idle();await server.documents!.pdf.idle();
    const posted=server.api.calls.find(c=>c.method==='chat.postMessage')!;
    assert.equal(posted.args.thread_ts,parent);
    // Ignore any thread supplied by the opener; the trusted card owns the destination.
    await server.documents!.present(id,{...actor,threadTs:'999.999'},'thread.trigger');
    const presented=server.api.calls.find(c=>c.method==='entity.presentDetails')!;
    const preview=object(object(object(object(presented.args.metadata).entity_payload).attributes).full_size_preview);
    const ticket=new URLSearchParams(new URL(String(preview.preview_url)).hash.slice(1)).get('ticket')!;
    const bearer=await server.documents!.sessions.exchange(ticket);
    const session=await server.documents!.sessions.require(bearer);
    assert.equal(session.actor.threadTs,parent??'123.456');
    await server.saves!.save(session,randomUUID(),'hwp',bytes);
    await server.documents!.pdf.idle();
    const completions=server.api.calls.filter(c=>c.method==='files.completeUploadExternal');
    assert.equal(completions.length,3);
    for(const {args} of completions){assert.equal(args.channel_id,undefined);assert.equal(args.thread_ts,undefined);}
    const posts=server.api.calls.filter(c=>c.method==='chat.postMessage');assert.equal(posts.length,2);assert.equal(posts[1].args.thread_ts,parent??'123.456');
  }finally{await server.stop();}
});
test('missing card message timestamp never falls back to channel-wide file sharing',async()=>{
  const api=new EditorApi();api.handler=async(method,args)=>method==='chat.postMessage'?{ok:true}:api.response(method,args);
  const server=await editorServer({api});try{
    const id=await server.prepare();await server.documents!.pdf.idle();
    assert.equal(api.calls.filter(c=>c.method==='files.getUploadURLExternal').length,0);
    await assert.rejects(server.documents!.present(id,actor,'trigger'));
  }finally{await server.stop();}
});

test('revision card reopens its own bytes and resaves under the original thread; original revocation denies revisions',async()=>{
  const server=await editorServer({convert:async()=>{throw new Error('no pdf');}});try{
    const original=await server.prepare();const {session}=await server.session(original);
    const first=await server.saves!.save(session,randomUUID(),'hwp',bytes);
    const posts=server.api.calls.filter(c=>c.method==='chat.postMessage');assert.equal(posts.length,2);
    const revisionId=String(object((object(posts[1].args.metadata).entities as Record<string,unknown>[])[0].external_ref).id);
    assert.equal(first.name,'문서_편집본_1.hwp');assert.equal(posts[1].args.thread_ts,'123.456');
    assert.deepEqual(server.documents!.source(revisionId),bytes);
    const revision=await server.documents!.authorize(revisionId,actor);assert.equal(revision.fileId,first.fileId);
    const reopened=await server.session(revisionId);
    const second=await server.saves!.save(reopened.session,randomUUID(),'hwp',bytes);
    assert.equal(second.name,'문서_편집본_2.hwp');
    assert.equal(server.api.calls.filter(c=>c.method==='chat.postMessage')[2].args.thread_ts,'123.456');
    server.api.handler=async(method,args)=>method==='files.info'&&args.file==='FTEST'?{ok:true,file:{id:'FTEST',mode:'tombstone'}}:server.api.response(method,args);
    await assert.rejects(server.documents!.authorize(revisionId,actor));
    await assert.rejects(server.saves!.save(reopened.session,randomUUID(),'hwp',bytes));
  }finally{await server.stop();}
});
test('lost revision post response reconciles the same file share without a second card',async()=>{
  const server=await editorServer({convert:async()=>{throw new Error('no pdf');}});try{
    const original=await server.prepare();const {session}=await server.session(original);const request=randomUUID();
    server.api.handler=async(method,args)=>{const response=server.api.response(method,args);if(method==='chat.postMessage')throw new Error('lost response');return response;};
    const saved=await server.saves!.save(session,request,'hwp',bytes);assert.equal(saved.saved,true);
    assert.equal((await server.saves!.save(session,request,'hwp',bytes)).fileId,saved.fileId);
    assert.equal(server.api.calls.filter(c=>c.method==='chat.postMessage').length,2);
    assert.equal(server.api.calls.filter(c=>c.method==='files.completeUploadExternal').length,1);
  }finally{await server.stop();}
});
test('an unshared revision remains unsaved and a retry never creates a duplicate message',async()=>{
  const server=await editorServer({convert:async()=>{throw new Error('no pdf');}});try{
    const original=await server.prepare();const {session}=await server.session(original);const request=randomUUID();
    server.api.handler=async(method,args)=>method==='chat.postMessage'?{ok:true,ts:'700.001'}:server.api.response(method,args);
    await assert.rejects(server.saves!.save(session,request,'hwp',bytes),/공유/);
    assert.equal((await server.saves!.status(session,request)).saved,false);
    // Slack later finishes sharing the same uploaded file. The next click reconciles it.
    const uploaded=[...server.api.files.values()][0];uploaded.shares={public:{CTEST:[{team_id:'TTEST',ts:'700.001',thread_ts:'123.456'}]}};
    const saved=await server.saves!.save(session,request,'hwp',bytes);assert.equal(saved.saved,true);
    assert.equal(server.api.calls.filter(c=>c.method==='chat.postMessage').length,2);
    assert.equal(server.api.calls.filter(c=>c.method==='files.getUploadURLExternal').length,1);
  }finally{await server.stop();}
});

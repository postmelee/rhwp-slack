import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {editorServer,EditorApi} from './editor-support';
import {bytes,signed} from './support';
async function until(check:()=>boolean){for(let i=0;i<100;i++){if(check())return;await delay(5);}assert.fail('operation not received');}
test('card opens Studio before PDF is ready; PDF action references uploaded Slack file only',async()=>{
  let release!:()=>void;const gate=new Promise<void>(r=>release=r);
  const server=await editorServer({convert:async()=>{await gate;return Buffer.from('%PDF-test');}});
  try{
    const id=await server.prepare();const initial=JSON.stringify(server.api.calls.find(c=>c.method==='chat.postMessage')!.args);
    assert.match(initial,/문서 열기/);assert.doesNotMatch(initial,/preview_url|ticket=|PDF로 변환/);
    await server.documents!.present(id,{teamId:'TTEST',userId:'UTEST',channelId:'CTEST'},'trigger');
    assert.match(JSON.stringify(server.api.calls.find(c=>c.method==='entity.presentDetails')!.args),/\/editor\/#ticket=/);
    release();await server.documents!.pdf.idle();await until(()=>server.api.calls.some(c=>c.method==='chat.update'));
    const updated=JSON.stringify(server.api.calls.find(c=>c.method==='chat.update')!.args);
    assert.match(updated,/PDF로 보기/);assert.match(updated,/rhwp-test.slack.com\/files\/UBOT\/FUPLOAD/);assert.doesNotMatch(updated,/preview_url|ticket=/);
  }finally{release();await server.stop();}
});
test('signed entity event and Work Object flexpane action use event/container actor fields and deduplicate',async()=>{
  const server=await editorServer();try{
    const id=await server.prepare();
    const event={type:'event_callback',api_app_id:'ATEST',team_id:'TTEST',event_id:'EvDETAIL',event:{type:'entity_details_requested',user:'UTEST',channel:'CTEST',external_ref:{id,type:'document'},entity_url:server.documents!.url(id),trigger_id:'detail.trigger'}};
    assert.equal((await signed(server.origin,event,{json:true})).status,200);await signed(server.origin,event,{json:true});
    await until(()=>server.api.calls.filter(c=>c.method==='entity.presentDetails').length===1);
    const action={type:'block_actions',api_app_id:'ATEST',team:{id:'TTEST'},user:{id:'UTEST'},trigger_id:'action.trigger',container:{type:'entity_detail',channel_id:'CTEST',entity_url:server.documents!.url(id),external_ref:{id}},actions:[{type:'button',action_id:'rhwp_open',value:id}]};
    assert.equal((await signed(server.origin,action)).status,200);await signed(server.origin,action);
    await until(()=>server.api.calls.filter(c=>c.method==='entity.presentDetails').length===2);
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

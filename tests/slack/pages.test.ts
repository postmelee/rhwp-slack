import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {editorServer,EditorApi} from './editor-support';
import {actor,signed} from './support';
import {object} from '../../src/server/errors';
const png=Buffer.from('89504e470d0a1a0a','hex');
const pages=(start:number,end:number)=>Array.from({length:end-start+1},(_,i)=>({page:start+i,png}));
const preview=async()=>({pdf:Buffer.from('%PDF-test'),pageCount:12,pages:pages(1,3)});
const latest=(api:EditorApi)=>[...api.messages.values()][0];
const imagePages=(api:EditorApi)=>((latest(api).files??[]) as {id:string}[]).map(f=>Number(/_(\d+)페이지\.png$/.exec(String(api.files.get(f.id)?.name))?.[1]));
async function until(check:()=>boolean){for(let i=0;i<200;i++){if(check())return;await delay(5);}assert.fail('operation not received');}
test('first three pages update one thread reply; two expansion clicks render only 4–10 once',async()=>{
  const ranges:number[][]=[];let release!:()=>void;const gate=new Promise<void>(r=>release=r);
  const server=await editorServer({convert:preview,convertImages:async(_bytes,range)=>{ranges.push([range!.start!,range!.end!]);await gate;return {pageCount:12,pages:pages(4,10)};}});
  try{
    const id=await server.prepare();await server.documents!.pdf.idle();
    assert.deepEqual(imagePages(server.api),[1,2,3]);
    assert.equal((latest(server.api).blocks as any[]).some(block=>block.type==='image'),false);
    assert.doesNotMatch(JSON.stringify(latest(server.api).metadata),/slack#\/types\/image/);
    assert.match(JSON.stringify(latest(server.api)),/추가 페이지 보기|12페이지/);
    const ts=String(latest(server.api).ts??'123.456');
    const one=server.documents!.morePages(id,actor,ts);await until(()=>ranges.length===1);
    const two=server.documents!.morePages(id,actor,ts);release();await Promise.all([one,two]);
    assert.deepEqual(ranges,[[4,10]]);assert.deepEqual(imagePages(server.api),[1,2,3,4,5,6,7,8,9,10]);
    assert.doesNotMatch(JSON.stringify(latest(server.api)),/rhwp_more_pages/);
    assert.equal(server.api.calls.filter(c=>c.method==='chat.postMessage').length,1);
    assert.equal(server.api.calls.filter(c=>c.method==='files.getUploadURLExternal').length,11);
    await server.documents!.morePages(id,actor,ts);assert.equal(ranges.length,1);
  }finally{release();await server.stop();}
});
test('PDF and first PNG are shared while later image uploads are still pending',async()=>{
  const api=new EditorApi();let release!:()=>void;const gate=new Promise<void>(r=>release=r);
  api.handler=async(method,args)=>{if(method==='files.getUploadURLExternal'&&String(args.filename).endsWith('_02페이지.png'))await gate;return api.response(method,args);};
  const server=await editorServer({api,convert:preview});
  try{
    await server.prepare();await until(()=>imagePages(api).includes(1));
    assert.match(JSON.stringify(latest(api)),/PDF로 보기/);
    assert.equal(api.calls.filter(c=>c.method==='chat.postMessage').length,1);
    release();await server.documents!.pdf.idle();assert.deepEqual(imagePages(api),[1,2,3]);
  }finally{release();await server.stop();}
});
test('short document has no expansion; channel/message/root authorization precedes generation',async()=>{
  let renders=0;const server=await editorServer({convert:async()=>({pdf:Buffer.from('%PDF-test'),pageCount:2,pages:pages(1,2)}),convertImages:async()=>{renders++;throw new Error('must not render');}});
  try{
    const id=await server.prepare();await server.documents!.pdf.idle();assert.deepEqual(imagePages(server.api),[1,2]);
    assert.doesNotMatch(JSON.stringify(latest(server.api)),/rhwp_more_pages/);
    await assert.rejects(server.documents!.morePages(id,{...actor,channelId:'CPRIVATE'},'123.456'));
    await assert.rejects(server.documents!.morePages(id,actor,'999.001'));
    server.api.handler=async(method,args)=>method==='files.info'&&args.file==='FTEST'?{ok:true,file:{id:'FTEST',mode:'tombstone'}}:server.api.response(method,args);
    await assert.rejects(server.documents!.morePages(id,actor,'123.456'));assert.equal(renders,0);
  }finally{await server.stop();}
});
test('an uncertain PNG completion reconciles its existing ID; PDF remains ready and pages retain their numbers',async()=>{
  const api=new EditorApi();let fail=true,failedId='';
  api.handler=async(method,args)=>{
    if(method==='files.completeUploadExternal'){
      const id=(args.files as {id:string}[])[0].id;
      if(String(api.files.get(id)?.name).endsWith('_02페이지.png')&&fail){failedId=id;throw new Error('uncertain');}
    }
    return api.response(method,args);
  };
  const ranges:number[][]=[];
  const server=await editorServer({api,convert:preview,convertImages:async(_b,range)=>{ranges.push([range!.start!,range!.end!]);return {pageCount:12,pages:pages(range!.start!,range!.end!)};}});
  try{
    const id=await server.prepare();await server.documents!.pdf.idle();
    assert.equal((await server.documents!.authorize(id,actor)).pdf,'ready');assert.deepEqual(imagePages(api),[1]);
    fail=false;api.response('files.completeUploadExternal',{files:[{id:failedId}]});
    await server.documents!.morePages(id,actor,'123.456');
    assert.deepEqual(ranges,[[2,3]]);assert.deepEqual(imagePages(api),[1,2,3]);
    assert.equal(api.calls.filter(c=>c.method==='files.getUploadURLExternal').length,4);
  }finally{await server.stop();}
});
test('signed expansion action is acknowledged and updates the exact message',async()=>{
  const server=await editorServer({convert:preview,convertImages:async()=>({pageCount:12,pages:pages(4,10)})});
  try{
    const id=await server.prepare();await server.documents!.pdf.idle();
    const payload={type:'block_actions',api_app_id:'ATEST',team:{id:'TTEST'},user:{id:'UTEST'},container:{type:'message',channel_id:'CTEST',message_ts:'123.456'},actions:[{type:'button',action_id:'rhwp_more_pages',value:id}]};
    assert.equal((await signed(server.origin,payload)).status,200);await until(()=>imagePages(server.api).length===10);
    assert.equal(object((latest(server.api).metadata as any).entities[0].entity_payload).display_order instanceof Array,true);
  }finally{await server.stop();}
});

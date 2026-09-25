import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {editorServer} from './editor-support';
import {signed,file} from './support';
const envelope=(id:string,event:Record<string,unknown>)=>({type:'event_callback',api_app_id:'ATEST',team_id:'TTEST',event_id:id,event});
const shared={type:'file_shared',user_id:'UTEST',channel_id:'CTEST',file_id:'FTEST'};
const mention={type:'app_mention',user:'UTEST',channel:'CTEST',text:'<@UBOT>',ts:'123.456',files:[{id:'FTEST',name:'문서.hwp'}]};
async function until(check:()=>boolean){for(let i=0;i<200;i++){if(check())return;await delay(5);}assert.fail('operation not received');}
test('file event and attached mention share one original-thread reply, including duplicate delivery',async()=>{
  const server=await editorServer();try{
    for(const [id,e] of [['EvFILE',shared],['EvMENTION',mention],['EvFILE',shared],['EvMENTION2',mention]] as const)await signed(server.origin,envelope(id,e),{json:true});
    await until(()=>server.api.calls.some(c=>c.method==='chat.postMessage'));await server.preparations.idle();await server.documents!.pdf.idle();
    const posts=server.api.calls.filter(c=>c.method==='chat.postMessage');assert.equal(posts.length,1);assert.equal(posts[0].args.thread_ts,'123.456');
    await signed(server.origin,envelope('EvTHREAD',{...mention,files:undefined,ts:'456.789',thread_ts:'123.456'}),{json:true});
    await delay(30);assert.equal(server.api.calls.filter(c=>c.method==='chat.postMessage').length,1);
  }finally{await server.stop();}
});
test('mention arriving first and a later file event do not duplicate a card; thread root is preserved',async()=>{
  const server=await editorServer();try{
    server.api.handler=async(method,args)=>{const result=server.api.response(method,args);if(method==='conversations.info')return {...result,channel:{...(result.channel as object),is_private:true}};if(method==='files.info'&&args.file==='FTEST')return {ok:true,file:{...file,shares:{private:{CTEST:[{team_id:'TTEST',ts:'123.456',thread_ts:'100.001'}]}}}};return result;};
    await signed(server.origin,envelope('EvMENTION',{...mention,thread_ts:'100.001'}),{json:true});
    await signed(server.origin,envelope('EvFILE',shared),{json:true});
    await until(()=>server.api.calls.some(c=>c.method==='chat.postMessage'));await server.preparations.idle();
    const posts=server.api.calls.filter(c=>c.method==='chat.postMessage');assert.equal(posts.length,1);assert.equal(posts[0].args.thread_ts,'100.001');
  }finally{await server.stop();}
});
test('bot uploads and mentions, unrelated formats and wrong channels cannot recursively trigger conversion',async()=>{
  const server=await editorServer();try{
    await signed(server.origin,envelope('EvBOT',{...shared,user_id:'UBOT'}),{json:true});
    await signed(server.origin,envelope('EvBOTMENTION',{...mention,user:'UBOT'}),{json:true});
    await signed(server.origin,envelope('EvOTHER',{...mention,channel:'COTHER'}),{json:true});
    server.api.handler=async(method,args)=>method==='files.info'?{ok:true,file:{...file,name:'file.pdf'}}:server.api.response(method,args);
    await signed(server.origin,envelope('EvPDF',shared),{json:true});await delay(50);
    assert.equal(server.api.calls.filter(c=>c.method==='chat.postMessage').length,0);
  }finally{await server.stop();}
});
test('ambiguous automatic share fails privately; attached mention identifies the exact message',async()=>{
  const server=await editorServer();try{
    server.api.handler=async(method,args)=>method==='files.info'&&args.file==='FTEST'?{ok:true,file:{...file,shares:{public:{CTEST:[{team_id:'TTEST',ts:'123.456'},{team_id:'TTEST',ts:'222.333'}]}}}}:server.api.response(method,args);
    await signed(server.origin,envelope('EvAMBIGUOUS',shared),{json:true});await until(()=>server.api.calls.some(c=>c.method==='chat.postEphemeral'));
    assert.equal(server.api.calls.filter(c=>c.method==='chat.postMessage').length,0);
    await signed(server.origin,envelope('EvEXACT',{...mention,ts:'222.333'}),{json:true});await until(()=>server.api.calls.some(c=>c.method==='chat.postMessage'));
    assert.equal(server.api.calls.find(c=>c.method==='chat.postMessage')!.args.thread_ts,'222.333');
  }finally{await server.stop();}
});

test('a new file upload alone produces a reply without any mention or history call',async()=>{
  const server=await editorServer();try{
    await signed(server.origin,envelope('EvUPLOADONLY',shared),{json:true});await until(()=>server.api.calls.some(c=>c.method==='chat.postMessage'));
    assert.equal(server.api.calls.find(c=>c.method==='chat.postMessage')!.args.thread_ts,'123.456');
    assert.equal(server.api.calls.some(c=>String(c.method).includes('history')||String(c.method).includes('replies')),false);
  }finally{await server.stop();}
});

test('Work Object sharing the user-owned source again is ignored as a bot share',async()=>{
  const server=await editorServer();try{
    await signed(server.origin,envelope('EvFIRST',shared),{json:true});await until(()=>server.api.calls.some(c=>c.method==='chat.postMessage'));
    server.api.handler=async(method,args)=>method==='files.info'&&args.file==='FTEST'?{ok:true,file:{...file,shares:{public:{CTEST:[{team_id:'TTEST',ts:'123.456',share_user_id:'UTEST'},{team_id:'TTEST',ts:'123.457',thread_ts:'123.456',share_user_id:'UBOT'}]}}}}:server.api.response(method,args);
    await signed(server.origin,envelope('EvBOTRESHARE',shared),{json:true});await delay(30);
    assert.equal(server.api.calls.filter(c=>c.method==='chat.postMessage').length,1);
    assert.equal(server.api.calls.filter(c=>c.method==='chat.postEphemeral').length,0);
  }finally{await server.stop();}
});

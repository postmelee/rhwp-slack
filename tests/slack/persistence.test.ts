import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {State} from '../../src/server/state';
import {editorServer,EditorApi} from './editor-support';
import {actor,bytes,config,signed} from './support';
import {randomUUID} from 'node:crypto';
const temp=()=>mkdtempSync(join(tmpdir(),'rhwp-state-test-'));
test('SQLite namespaces isolate workspaces and reopen only serialized metadata',()=>{
  const dir=temp(),path=join(dir,'state.sqlite');try{
    let state=new State(path,'TONE');state.put('cards','id',{name:'문서.hwp',fileId:'FTEST'});state.close();
    state=new State(path,'TTWO');assert.equal(state.get('cards','id'),undefined);state.close();
    state=new State(path,'TONE');assert.deepEqual(state.get('cards','id'),{name:'문서.hwp',fileId:'FTEST'});state.delete('cards','id');state.close();
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('restart keeps the card, PDF and revision links; source is downloaded again under current permissions',async()=>{
  const dir=temp(),statePath=join(dir,'state.sqlite'),api=new EditorApi();let server=await editorServer({api,statePath});
  try{
    const id=await server.prepare();await server.documents!.pdf.idle();
    const {session}=await server.session(id),request=randomUUID();
    const saved=await server.saves!.save(session,request,'hwp',bytes);await server.documents!.pdf.idle();
    const original=api.calls.filter(c=>c.method==='chat.postMessage').length;
    const records=server.state!.all<Record<string,unknown>>('cards');assert.equal(records.length,2);
    const revision=records.find(([,v])=>v.fileId===saved.fileId)![0];
    const serialized=JSON.stringify([...server.state!.all('cards'),...server.state!.all('jobs'),...server.state!.all('saves')]);
    for(const secret of ['xoxb-','files-pri/','upload/v1/','"type":"Buffer"','"bytes":'])assert.equal(serialized.includes(secret),false,secret);
    await server.stop();server=await editorServer({api,statePath,origin:'https://new.example.com'});await server.ready;
    assert.equal(server.documents!.matchesUrl(id,'https://editor.example.com/documents/'+id),true);
    assert.equal(server.documents!.matchesUrl(id,'https://attacker.invalid/documents/'+id),false);
    await server.documents!.present(id,actor,'reopen');assert.deepEqual(server.documents!.source(id),bytes);
    assert.deepEqual(await server.documents!.ensureSource(revision,actor),bytes);
    const newSession=await server.session(id);const repeated=await server.saves!.save(newSession.session,request,'hwp',bytes);
    assert.equal(repeated.fileId,saved.fileId);assert.equal(api.calls.filter(c=>c.method==='chat.postMessage').length,original);
    api.handler=async(method,args)=>method==='conversations.members'?{ok:true,members:[],response_metadata:{next_cursor:''}}:api.response(method,args);
    await assert.rejects(server.documents!.ensureSource(id,actor));await assert.rejects(server.documents!.ensureSource(revision,actor));
  }finally{await server.stop();rmSync(dir,{recursive:true,force:true});}
});
test('a card survives source TTL and another channel member can reopen it without changing its thread',async()=>{
  const dir=temp();let now=0;const server=await editorServer({statePath:join(dir,'state.sqlite'),now:()=>now});try{
    const id=await server.prepare();await server.documents!.pdf.idle();now=2*24*60*60_000;
    server.api.handler=async(method,args)=>method==='conversations.members'?{ok:true,members:['UTEST','UOTHER'],response_metadata:{next_cursor:''}}:server.api.response(method,args);
    await server.documents!.present(id,{...actor,userId:'UOTHER'},'other-user');assert.deepEqual(server.documents!.source(id),bytes);
    const c=await server.documents!.authorize(id,actor);assert.equal(c.actor.threadTs,'123.456');
    await assert.rejects(server.documents!.present(id,{...actor,teamId:'TOTHER'},'bad'));
    await assert.rejects(server.documents!.present(id,{...actor,channelId:'CPRIVATE'},'bad'));
  }finally{await server.stop();rmSync(dir,{recursive:true,force:true});}
});
test('an obsolete unknown-origin card refresh cannot produce a misleading access error',async()=>{
  const server=await editorServer();try{
    await signed(server.origin,{type:'event_callback',api_app_id:config.appId,team_id:config.teamId,event_id:'EvSTALE',event:{type:'entity_details_requested',user:actor.userId,channel:actor.channelId,external_ref:{type:'document',id:randomUUID()},entity_url:'https://old.example.com/documents/old',trigger_id:'stale-trigger'}},{json:true});
    await new Promise(r=>setTimeout(r,30));assert.equal(server.api.calls.some(c=>c.method==='chat.postEphemeral'),false);
  }finally{await server.stop();}
});

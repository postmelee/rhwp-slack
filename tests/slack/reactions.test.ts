import test from 'node:test';
import assert from 'node:assert/strict';
import {Reactions} from '../../src/server/reactions';
import {State} from '../../src/server/state';
import {FakeApi,actor,signed} from './support';
import {editorServer} from './editor-support';
const target={...actor,reactionTs:'123.456'};
function finalReaction(api:FakeApi):Set<string>{const values=new Set<string>();for(const c of api.calls){if(c.method==='reactions.add')values.add(String(c.args.name));if(c.method==='reactions.remove')values.delete(String(c.args.name));}return values;}
test('multiple files keep the hourglass until all complete; partial failures produce warning',async()=>{
  const api=new FakeApi(),status=new Reactions(api,true);status.register('one',target);status.register('two',target);
  await status.start('one');await status.start('two');await status.finish('one',true);assert.deepEqual(finalReaction(api),new Set(['hourglass_flowing_sand']));
  await status.finish('two',false);assert.deepEqual(finalReaction(api),new Set(['warning']));
  await status.finish('two',true);assert.deepEqual(finalReaction(api),new Set(['white_check_mark']));
  assert.ok(api.calls.filter(c=>c.method.startsWith('reactions.')).every(c=>c.args.timestamp==='123.456'));
});
test('unvalidated requests add no reactions; reaction errors do not propagate into conversion',async()=>{
  const api=new FakeApi(),status=new Reactions(api,true);status.register('invalid',target);await status.finish('invalid',false);assert.equal(api.calls.length,0);
  api.handler=async()=>{throw new Error('missing scope');};status.register('valid',target);await status.start('valid');await status.finish('valid',true);
});
test('recovery clears stale hourglasses and retains pending active jobs',async()=>{
  const api=new FakeApi(),state=new State(':memory:','TTEST');try{
    const before=new Reactions(api,true,state);before.register('lost',target);await before.start('lost');
    const after=new Reactions(api,true,state);await after.recover(new Set());assert.deepEqual(finalReaction(api),new Set(['warning']));
    after.register('active',target);await after.start('active');const again=new Reactions(api,true,state);await again.recover(new Set(['active']));assert.deepEqual(finalReaction(api),new Set(['hourglass_flowing_sand']));
  }finally{state.close();}
});
test('an upload reacts to the original message and checks only after PDF and images finish',async()=>{
  let release!:(value:Buffer)=>void;const gate=new Promise<Buffer>(r=>release=r);
  const server=await editorServer({reactions:true,convert:()=>gate});try{
    await signed(server.origin,{type:'event_callback',api_app_id:'ATEST',team_id:'TTEST',event_id:'EvREACT',event:{type:'file_shared',user_id:'UTEST',channel_id:'CTEST',file_id:'FTEST'}},{json:true});
    for(let i=0;i<200&&!server.api.calls.some(c=>c.method==='chat.postMessage');i++)await new Promise(r=>setTimeout(r,5));
    assert.deepEqual(finalReaction(server.api),new Set(['hourglass_flowing_sand']));release(Buffer.from('%PDF-synthetic'));
    await server.preparations.idle();await server.documents!.pdf.idle();await new Promise(r=>setTimeout(r,20));await server.reactions.idle();
    assert.deepEqual(finalReaction(server.api),new Set(['white_check_mark']));
  }finally{release?.(Buffer.from('%PDF-synthetic'));await server.stop();}
});

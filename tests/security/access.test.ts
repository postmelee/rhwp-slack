import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizeFile} from '../../src/server/access';
import {FakeApi,config,actor,channel,file} from '../slack/support';
test('membership pagination is complete before granting file access',async()=>{
  const api=new FakeApi();api.handler=async(method,args)=>method==='conversations.members'?{ok:true,members:args.cursor?['UTEST']:['UOTHER'],response_metadata:{next_cursor:args.cursor?'':'next'}}:api.response(method,args);
  assert.equal((await authorizeFile(api,config,actor,'FTEST')).id,'FTEST');
  assert.equal(api.calls.filter(c=>c.method==='conversations.members').length,2);
});
test('public and private local channel shares require matching team evidence',async()=>{
  const api=new FakeApi();api.handler=async(method,args)=>{
    if(method==='conversations.info')return {ok:true,channel:{...channel,id:'CPRIVATE',is_private:true}};
    if(method==='files.info')return {ok:true,file:{...file,shares:{private:{CPRIVATE:[{team_id:'TTEST',ts:'123.456'}]}}}};
    return api.response(method,args);
  };
  assert.equal((await authorizeFile(api,config,{...actor,channelId:'CPRIVATE'},'FTEST')).id,'FTEST');
});
test('foreign actor and unapproved channel are rejected before any API request',async()=>{
  for(const change of [{teamId:'TOTHER'},{channelId:'COTHER'},{userId:'bad'}]){
    const api=new FakeApi();await assert.rejects(authorizeFile(api,config,{...actor,...change},'FTEST'));assert.equal(api.calls.length,0);
  }
});
test('missing or restricted channel/file evidence never falls back to bot access',async()=>{
  for(const patch of [{is_ext_shared:true},{is_member:false},{is_im:true},{is_pending_ext_shared:undefined},{context_team_id:'TOTHER'},{shared_team_ids:['TTEST','TOTHER']},{pending_shared:['TOTHER']},{is_archived:true}]){
    const api=new FakeApi();api.handler=async(method,args)=>method==='conversations.info'?{ok:true,channel:{...channel,...patch}}:api.response(method,args);
    await assert.rejects(authorizeFile(api,config,actor,'FTEST'));assert.ok(!api.calls.some(c=>c.method==='files.info'));
  }
  for(const patch of [{mode:'external'},{is_external:true},{is_restricted_sharing_enabled:undefined},{is_restricted_sharing_enabled:true},{file_access:'check_file_info'},{shares:{public:{CTEST:[{team_id:'TOTHER',ts:'123.4'}]}}},{shares:{}},{has_more_shares:true},{external_workspaces_with_read_access:['TOTHER']},{size:20*1024*1024+1},{name:'fake.pdf'},{id:'FOTHER'}]){
    const api=new FakeApi();api.handler=async(method,args)=>method==='files.info'?{ok:true,file:{...file,...patch}}:api.response(method,args);
    await assert.rejects(authorizeFile(api,config,actor,'FTEST'));
  }
});
test('partial, repeated and failed membership results cannot authorize',async()=>{
  for(const result of [{members:['UTEST']},{members:['UTEST'],response_metadata:{next_cursor:'repeat'}},{members:['UOTHER'],response_metadata:{next_cursor:''}}]){
    const api=new FakeApi();api.handler=async(method,args)=>method==='conversations.members'?result:api.response(method,args);
    await assert.rejects(authorizeFile(api,config,actor,'FTEST'));
  }
  const api=new FakeApi();api.handler=async()=>{throw new Error('API unavailable');};await assert.rejects(authorizeFile(api,config,actor,'FTEST'));
});

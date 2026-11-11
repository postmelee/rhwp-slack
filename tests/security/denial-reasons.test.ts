import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizeFile} from '../../src/server/access';
import {denied,denialReason,type DenialReason} from '../../src/server/errors';
import {errorDiagnostics,validatedDiagnostics,restoreDiagnostics} from '../../src/server/cloud/error-diagnostics';
import {traceTask,terminalTaskFailure} from '../../src/server/cloud/telemetry';
import {FakeApi,config,actor,channel,file} from '../slack/support';

const secret='private-document.hwp https://private.invalid/?token=secret';
test('access predicates remain fail closed and expose only fixed denial categories',async()=>{
  const cases:{reason:DenialReason;method?:string;response?:Record<string,unknown>;otherActor?:typeof actor}[]=[
    {reason:'actor_policy',otherActor:{...actor,teamId:'TOTHER'}},
    {reason:'channel_policy',method:'conversations.info',response:{channel:{...channel,is_ext_shared:true}}},
    {reason:'actor_membership',method:'conversations.members',response:{members:[],response_metadata:{next_cursor:''}}},
    {reason:'actor_membership',method:'conversations.members',response:{members:['UTEST']}},
    {reason:'file_visibility',method:'files.info',response:{file:{...file,file_access:'check_file_info'}}},
    {reason:'share_shape',method:'files.info',response:{file:{...file,shares:{}}}},
    {reason:'invalid_source_metadata',method:'files.info',response:{file:{...file,name:secret}}},
  ];
  for(const entry of cases){
    const api=new FakeApi();api.handler=async(method,args)=>method===entry.method?entry.response!:api.response(method,args);
    const records:Record<string,unknown>[]=[];
    await assert.rejects(traceTask({teamId:'TTEST',cardId:'synthetic',kind:'prepare'},
      {signal:new AbortController().signal,checkpoint:async()=>{}},
      ()=>authorizeFile(api,config,entry.otherActor??actor,'FTEST'),r=>records.push(r)),error=>{
      assert.equal((error as {code:string}).code,'access_denied');
      assert.equal(denialReason(error),entry.reason);return true;
    });
    assert.equal(records.at(-1)?.denialReason,entry.reason);
    assert.equal(JSON.stringify(records).includes(secret),false);
  }
});
test('denial diagnostics survive durable reconstruction without reading arbitrary fields',()=>{
  let error:unknown;try{denied('file_visibility');}catch(value){error=value;}
  const source=errorDiagnostics(error,'task_failure');assert.equal(source.denialReason,'file_visibility');
  const rebuilt=new Error('Durable task failed');assert.equal(restoreDiagnostics(rebuilt,JSON.parse(JSON.stringify(source))),true);
  const records:Record<string,unknown>[]=[];
  terminalTaskFailure('a'.repeat(64),{teamId:'TTEST',cardId:'synthetic',kind:'prepare'},3,rebuilt,r=>records.push(r));
  assert.equal(records[0].denialReason,'file_visibility');
  const unknown=validatedDiagnostics({...source,denialReason:secret});assert.equal(unknown?.denialReason,undefined);
  let getters=0;const stored={...source};Object.defineProperty(stored,'denialReason',{get(){getters++;throw new Error(secret);}});
  assert.equal(validatedDiagnostics(stored)?.denialReason,undefined);assert.equal(getters,0);
  const forged=Object.assign(new Error(secret),{denialReason:'file_visibility'});assert.equal(errorDiagnostics(forged).denialReason,undefined);
  assert.equal(JSON.stringify(unknown).includes(secret),false);
});

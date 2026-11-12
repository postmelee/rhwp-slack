import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizeFile} from '../../src/server/access';
import {denied,denialReason,denialMessage,userMessage,type DenialReason} from '../../src/server/errors';
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
    {reason:'unsupported_extension',method:'files.info',response:{file:{...file,name:secret}}},
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


test('metadata validation distinguishes fixed reasons without relaxing authorization or logging values',async()=>{
 const entries:{patch:Record<string,unknown>;reason:DenialReason;message:RegExp}[]=[
  {patch:{name:undefined},reason:'file_name_invalid',message:/파일 이름 정보/},
  {patch:{name:'private.txt'},reason:'unsupported_extension',message:/HWP 또는 HWPX/},
  {patch:{name:'x'.repeat(252)+'.hwp'},reason:'file_name_invalid',message:/파일 이름 정보/},
  {patch:{name:'private\u0000.hwp'},reason:'file_name_invalid',message:/파일 이름 정보/},
  ...[undefined,'20',0,-1,1.5,NaN,Infinity].map(size=>({patch:{size},reason:'file_size_invalid' as const,message:/파일 크기 정보/})),
  {patch:{size:20*1024*1024+1},reason:'file_size_limit',message:/20 MiB/},
  {patch:{url_private_download:undefined,url_private:undefined},reason:'missing_download_url',message:/다운로드 주소/},
 ];
 for(const entry of entries){
  const api=new FakeApi();api.handler=async(method,args)=>method==='files.info'?{file:{...file,...entry.patch}}:api.response(method,args);
  await assert.rejects(authorizeFile(api,config,actor,'FTEST'),error=>{
   assert.equal((error as {code:string}).code,'access_denied');assert.equal(denialReason(error),entry.reason);
   assert.match(userMessage(error),entry.message);assert.equal(userMessage(error).includes('private'),false);
   const safe=errorDiagnostics(error);assert.equal(safe.denialReason,entry.reason);
   assert.equal(JSON.stringify(safe).includes('private'),false);
   const rebuilt=new Error('stored');assert.equal(restoreDiagnostics(rebuilt,safe),true);
   assert.equal(errorDiagnostics(rebuilt).denialReason,entry.reason);assert.equal(denialMessage(rebuilt),undefined);
   return true;
  });
 }
 const api=new FakeApi();await assert.rejects(authorizeFile(api,config,actor,'not-a-file'),error=>{
  assert.equal(denialReason(error),'file_id_invalid');assert.match(userMessage(error),/파일 식별 정보/);return true;
 });assert.equal(api.calls.length,0);
 // Details are not reached until source visibility is established.
 api.handler=async(method,args)=>method==='files.info'?{file:{...file,file_access:'check_file_info',name:'private.txt',size:0}}:api.response(method,args);
 await assert.rejects(authorizeFile(api,config,actor,'FTEST'),error=>{assert.equal(denialReason(error),'file_visibility');assert.equal(denialMessage(error),undefined);return true;});
 // Existing boundary and fallback URL acceptance are unchanged.
 api.handler=async(method,args)=>method==='files.info'?{file:{...file,size:20*1024*1024,url_private_download:undefined,url_private:'https://files.slack.com/fallback'}}:api.response(method,args);
 assert.equal((await authorizeFile(api,config,actor,'FTEST')).size,20*1024*1024);
 const forged=Object.assign(new Error('private'),{denialReason:'file_size_limit'});assert.equal(denialMessage(forged),undefined);
});

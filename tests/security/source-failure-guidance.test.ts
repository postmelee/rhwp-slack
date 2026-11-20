import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizeFile} from '../../src/server/access';
import {UserError,userMessage} from '../../src/server/errors';
import {HttpSlackApi} from '../../src/server/slack-api';
import {attachSlackDiagnostics,attachResponseSizeDiagnostics} from '../../src/server/slack-diagnostics';
import {markSourceUnavailable,sourceFailureReason,sourceFailureMessage,isSourceUnavailable,type SourceFailureReason} from '../../src/server/source-failure';
import {errorDiagnostics,validatedDiagnostics,restoreDiagnostics} from '../../src/server/cloud/error-diagnostics';
import {isPermanentEventFailure} from '../../src/server/cloud/task-failures';
import {config,actor,channel} from '../slack/support';

const secret='private-document.hwp https://private.invalid/?token=private';
const expected:[string,SourceFailureReason,RegExp][]=[
 ['file_deleted','deleted',/Slack이.*삭제된 상태로 응답/],
 ['file_not_found','not_found_or_inaccessible',/찾을 수 없거나 앱이 접근/],
 ['not_visible','not_visible',/앱에서 원본 파일을 볼 수/],
 ['access_denied','permission_denied',/조회를 허용하지/],
 ['no_permission','permission_denied',/조회를 허용하지/],
 ['missing_scope','missing_scope',/관리자.*앱 권한/],
 ['invalid_auth','authentication',/앱 연결 상태/],
 ['not_authed','authentication',/앱 연결 상태/],
 ['token_revoked','authentication',/앱 연결 상태/],
 ['token_expired','authentication',/앱 연결 상태/],
 ['account_inactive','authentication',/앱 연결 상태/],
 ['ratelimited','rate_limited',/요청 제한/],
 ['internal_error','service_unavailable',/일시적인 오류/],
 ['fatal_error','service_unavailable',/일시적인 오류/],
 ['service_unavailable','service_unavailable',/일시적인 오류/],
 [secret,'unknown',/계속 실패하면 지원팀/],
];
function apiFailure(code:string,status=200,method='files.info'){
 return new HttpSlackApi('xoxb-synthetic-test',async url=>{
  const name=new URL(String(url)).pathname.split('/').at(-1);
  if(name===method)return Response.json({ok:false,error:code,details:secret},{status});
  if(name==='conversations.info')return Response.json({ok:true,channel});
  if(name==='conversations.members')return Response.json({ok:true,members:['UTEST'],response_metadata:{next_cursor:''}});
  throw new Error('unexpected call');
 });
}
test('source files.info receives fixed actionable guidance without changing business codes or retry classification',async()=>{
 for(const [code,reason,message] of expected){
  await assert.rejects(authorizeFile(apiFailure(code),config,actor,'FTEST'),error=>{
   assert.equal((error as UserError).code,'slack_rejected');
   assert.equal(sourceFailureReason(error),reason);assert.match(userMessage(error),message);
   assert.equal(userMessage(error).includes(secret),false);
   assert.equal(isPermanentEventFailure({kind:'preview'},error),false);
   if(code==='file_not_found'){
    assert.doesNotMatch(userMessage(error),/삭제되었습니다|삭제된 상태|취소되었습니다/);
    assert.equal(isPermanentEventFailure({kind:'event'},error),false);
   }
   if(['rate_limited','service_unavailable','unknown'].includes(reason))assert.equal(isSourceUnavailable(error),false);
   return true;
  });
 }
});
test('fresh source-call provenance excludes channel queries, output lookups and forged errors',async()=>{
 const outside=apiFailure('file_deleted');
 await assert.rejects(outside.call('files.info',{file:'FOUTPUT'}),error=>{assert.equal(sourceFailureReason(error),undefined);assert.equal(isSourceUnavailable(error),false);return true;});
 await assert.rejects(authorizeFile(apiFailure('file_deleted',200,'conversations.info'),config,actor,'FTEST'),error=>{assert.equal(sourceFailureMessage(error),undefined);return true;});
 const forged=Object.assign(new UserError('slack_rejected',secret),{httpStatus:200,slackError:'file_deleted',sourceFailureReason:'deleted'});
 markSourceUnavailable(forged);assert.equal(sourceFailureReason(forged),undefined);
 await assert.rejects(authorizeFile(apiFailure('file_deleted',201),config,actor,'FTEST'),error=>{assert.equal(sourceFailureReason(error),'unknown');assert.equal(isSourceUnavailable(error),false);return true;});
});
test('source diagnostics are captured after the inner Slack trace and safely restored without fresh provenance',async()=>{
 const error=attachSlackDiagnostics(new UserError('slack_rejected',secret),200,'file_not_found');
 const before=errorDiagnostics(error,'stage_failure');assert.equal(before.sourceFailureReason,undefined);
 markSourceUnavailable(error);
 const after=errorDiagnostics(error,'task_failure');assert.equal(after.errorId,before.errorId);assert.equal(after.sourceFailureReason,'not_found_or_inaccessible');
 const rebuilt=new Error('Durable task failed');assert.equal(restoreDiagnostics(rebuilt,JSON.parse(JSON.stringify(after))),true);
 assert.equal(errorDiagnostics(rebuilt,'terminal_failure').sourceFailureReason,'not_found_or_inaccessible');
 assert.equal(sourceFailureReason(rebuilt),undefined);assert.equal(isSourceUnavailable(rebuilt),false);
 const unknown=validatedDiagnostics({...after,sourceFailureReason:secret});assert.equal(unknown?.sourceFailureReason,undefined);
 let calls=0;const stored={...after};Object.defineProperty(stored,'sourceFailureReason',{get(){calls++;throw new Error(secret);}});
 assert.equal(validatedDiagnostics(stored)?.sourceFailureReason,undefined);assert.equal(calls,0);
 assert.equal(JSON.stringify(after).includes(secret),false);
});
test('transport and server failures stay transient; metadata response limit is not document size guidance',()=>{
 for(const [status,reason] of [[429,'rate_limited'],[503,'service_unavailable'],[undefined,'transport'],[401,'authentication'],[403,'permission_denied']] as const){
  const error=attachSlackDiagnostics(new Error(secret),status);markSourceUnavailable(error);
  assert.equal(sourceFailureReason(error),reason);
  if(['rate_limited','service_unavailable','transport'].includes(reason))assert.equal(isSourceUnavailable(error),false);
  assert.equal(sourceFailureMessage(error)?.includes(secret),false);
 }
 const error=attachResponseSizeDiagnostics(attachSlackDiagnostics(new UserError('size_limit',secret),200),{responseLimitBytes:4*1024*1024,responseBytesRead:4*1024*1024+1});
 markSourceUnavailable(error);assert.equal(sourceFailureReason(error),'response_limit');assert.match(userMessage(error),/정보 응답.*한도/);assert.match(userMessage(error),/문서 크기와는 별개/);
});

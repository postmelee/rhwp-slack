import {isSlackFailure,slackDiagnostics} from './slack-diagnostics';
export type SourceFailureReason='deleted'|'not_found_or_inaccessible'|'not_visible'|'permission_denied'|'missing_scope'|'authentication'|'rate_limited'|'service_unavailable'|'response_limit'|'transport'|'unknown';
const reasons=new Set<SourceFailureReason>(['deleted','not_found_or_inaccessible','not_visible','permission_denied','missing_scope','authentication','rate_limited','service_unavailable','response_limit','transport','unknown']);
const failures=new WeakMap<object,SourceFailureReason>();
export function validatedSourceFailureReason(value:unknown):SourceFailureReason|undefined {
 return typeof value==='string'&&reasons.has(value as SourceFailureReason)?value as SourceFailureReason:undefined;
}
/** Called only around the source files.info call, never an output or channel query.
 * This classification is diagnostic only: it does not establish deletion/cancellation
 * or change retry policy. In particular, file_not_found is ambiguous. */
export function markSourceUnavailable(error:unknown):void {
 if(!error||typeof error!=='object'||!isSlackFailure(error))return;
 const d=slackDiagnostics(error);let reason:SourceFailureReason='unknown';
 if(d.responseLimitBytes!==undefined)reason='response_limit';
 else if(d.httpStatus===429)reason='rate_limited';
 else if(d.httpStatus!==undefined&&d.httpStatus>=500)reason='service_unavailable';
 else if(d.httpStatus===401)reason='authentication';
 else if(d.httpStatus===403)reason='permission_denied';
 else if(d.httpStatus===undefined)reason='transport';
 else if(d.httpStatus===200){
  if(d.slackError==='file_deleted')reason='deleted';
  else if(d.slackError==='file_not_found')reason='not_found_or_inaccessible';
  else if(d.slackError==='not_visible')reason='not_visible';
  else if(['access_denied','no_permission'].includes(d.slackError??''))reason='permission_denied';
  else if(d.slackError==='missing_scope')reason='missing_scope';
  else if(['invalid_auth','not_authed','token_revoked','token_expired','account_inactive'].includes(d.slackError??''))reason='authentication';
  else if(d.slackError==='ratelimited')reason='rate_limited';
  else if(['internal_error','fatal_error','service_unavailable'].includes(d.slackError??''))reason='service_unavailable';
 }
 failures.set(error,reason);
}
/** Fresh source-call provenance only; restored telemetry cannot authorize a notice. */
export function sourceFailureReason(error:unknown):SourceFailureReason|undefined {
 return error&&typeof error==='object'?failures.get(error):undefined;
}
/** Eligible for the existing restricted status-only notice path, never an access grant. */
export function isSourceUnavailable(error:unknown):boolean {
 const reason=sourceFailureReason(error);
 return reason!==undefined&&['deleted','not_found_or_inaccessible','not_visible','permission_denied','missing_scope','authentication','response_limit'].includes(reason);
}
const messages:Record<SourceFailureReason,string>={
 deleted:'Slack이 원본 파일을 삭제된 상태로 응답했습니다. 파일을 확인하고 필요한 경우 다시 올려 주세요.',
 not_found_or_inaccessible:'원본 파일을 찾을 수 없거나 앱이 접근할 수 없습니다. 파일의 존재와 채널 공유 상태를 확인해 주세요.',
 not_visible:'앱에서 원본 파일을 볼 수 없습니다. 앱의 채널 참여와 파일 공유 상태를 확인해 주세요.',
 permission_denied:'Slack이 원본 파일 조회를 허용하지 않았습니다. 앱의 채널 참여와 파일 공유 권한을 확인해 주세요.',
 missing_scope:'앱에 파일 조회에 필요한 Slack 권한이 없습니다. 워크스페이스 관리자에게 앱 권한과 재설치 필요 여부를 확인해 달라고 요청해 주세요.',
 authentication:'앱의 Slack 인증을 확인할 수 없습니다. 워크스페이스 관리자에게 앱 연결 상태를 확인해 달라고 요청해 주세요.',
 rate_limited:'Slack의 요청 제한으로 원본 파일 조회가 지연되고 있습니다. 잠시 후 다시 시도해 주세요.',
 service_unavailable:'Slack의 일시적인 오류로 원본 파일을 조회하지 못했습니다. 잠시 후 다시 시도해 주세요.',
 response_limit:'원본 파일의 정보 응답이 처리 한도를 넘었습니다. 문서 크기와는 별개인 파일 정보 조회 문제이므로 지원팀에 발생 시각을 알려 주세요.',
 transport:'원본 파일 조회 요청을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.',
 unknown:'Slack에서 원본 파일 조회를 완료하지 못했습니다. 잠시 후 다시 시도하고 계속 실패하면 지원팀에 발생 시각을 알려 주세요.',
};
/** Fixed copy only: no filenames, IDs, credentials, URLs or raw Slack error text. */
export function sourceFailureMessage(error:unknown):string|undefined {
 const reason=sourceFailureReason(error);return reason===undefined?undefined:messages[reason];
}

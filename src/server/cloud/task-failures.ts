import {UserError,denialReason} from '../errors';
import {slackDiagnostics,isSlackFailure} from '../slack-diagnostics';
import {errorCode} from './telemetry';
/** Distinguish the trusted source-file denial from Slack and download byte limits. */
export function taskFailureCode(error:unknown):string {
 if(denialReason(error)==='file_size_limit')return 'file_size_limit';
 const code=errorCode(error);return code==='file_size_limit'?'internal':code;
}
const permanent=new Set(['missing_scope','invalid_auth','not_authed','token_revoked','token_expired','account_inactive','file_deleted']);
/** Only diagnostics attached by our Slack client may shorten event retries. */
export function isPermanentEventFailure(spec:{kind:string},error:unknown):boolean {
 if(spec.kind!=='event'||!(error instanceof UserError))return false;
 const diagnostic=slackDiagnostics(error);
 // Retrying the same bounded Slack response cannot change the configured byte budget.
 if(error.code==='size_limit')return isSlackFailure(error)&&diagnostic.responseLimitBytes!==undefined;
 return error.code==='slack_rejected'&&permanent.has(diagnostic.slackError??'');
}

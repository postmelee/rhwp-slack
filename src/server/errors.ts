import {sourceFailureMessage} from './source-failure';
import {MAX_FILE_BYTES} from '../shared/errors';
export class UserError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}
export type DenialReason='actor_policy'|'channel_policy'|'actor_membership'|'file_visibility'|'share_shape'|'invalid_source_metadata'|'file_id_invalid'|'file_name_invalid'|'unsupported_extension'|'file_size_invalid'|'file_size_limit'|'missing_download_url'|'source_metadata_changed'|'card_missing'|'card_removed'|'card_mismatch';
const denialReasons=new Set<DenialReason>(['actor_policy','channel_policy','actor_membership','file_visibility','share_shape','invalid_source_metadata','file_id_invalid','file_name_invalid','unsupported_extension','file_size_invalid','file_size_limit','missing_download_url','source_metadata_changed','card_missing','card_removed','card_mismatch']);
const reasons=new WeakMap<object,DenialReason>();
/** No raw Slack fields, document metadata, or arbitrary error properties enter diagnostics. */
export function validatedDenialReason(value:unknown):DenialReason|undefined {
  return typeof value==='string'&&denialReasons.has(value as DenialReason)?value as DenialReason:undefined;
}
export function denialReason(error:unknown):DenialReason|undefined {
  return error&&typeof error==='object'?reasons.get(error):undefined;
}
export function denied(reason?:DenialReason): never {
  const error=new UserError('access_denied', '문서 접근 권한을 확인할 수 없습니다. 앱과 요청자가 참여한 허용 채널의 파일인지 확인하세요.');
  const safe=validatedDenialReason(reason);if(safe)reasons.set(error,safe);
  throw error;
}
export function objectWithReason(value: unknown, reason?:DenialReason): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) denied(reason);
  return value as Record<string, unknown>;
}
export function object(value: unknown): Record<string, unknown> {
  return objectWithReason(value);
}
const metadataMessages:Partial<Record<DenialReason,string>>={
  file_id_invalid:'파일 식별 정보를 확인할 수 없습니다. Slack의 원본 파일에서 다시 요청해 주세요.',
  file_name_invalid:'파일 이름 정보가 올바르지 않습니다. 파일 이름을 확인하고 다시 올려 주세요.',
  unsupported_extension:'HWP 또는 HWPX 확장자의 문서만 지원합니다. 지원하는 형식의 원본 파일을 올려 주세요.',
  file_size_invalid:'파일 크기 정보가 올바르지 않거나 파일이 비어 있습니다. 원본 파일을 확인하고 다시 올려 주세요.',
  file_size_limit:`지원하는 파일 크기 한도(${MAX_FILE_BYTES/(1024*1024)} MiB)를 넘었습니다. 용량을 줄이거나 문서를 나누어 다시 올려 주세요.`,
  missing_download_url:'Slack이 원본 파일의 다운로드 주소를 제공하지 않았습니다. 업로드 완료 여부와 파일 공유 상태를 확인하고 다시 요청해 주세요.',
  source_metadata_changed:'요청 후 원본 파일의 이름이나 크기 정보가 변경되었습니다. 현재 원본 파일에서 다시 요청해 주세요.',
};
/** Fresh code-owned denial only; no raw metadata or restored telemetry is shown. */
export function denialMessage(error:unknown):string|undefined {
  const reason=denialReason(error);return reason===undefined?undefined:metadataMessages[reason];
}
export function userMessage(error: unknown): string {
  return sourceFailureMessage(error)??denialMessage(error)??(error instanceof UserError ? error.message : '요청을 처리하지 못했습니다. 잠시 후 다시 시도하세요.');
}

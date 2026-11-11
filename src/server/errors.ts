export class UserError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}
export type DenialReason='actor_policy'|'channel_policy'|'actor_membership'|'file_visibility'|'share_shape'|'invalid_source_metadata'|'card_missing'|'card_removed'|'card_mismatch';
const denialReasons=new Set<DenialReason>(['actor_policy','channel_policy','actor_membership','file_visibility','share_shape','invalid_source_metadata','card_missing','card_removed','card_mismatch']);
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
export function userMessage(error: unknown): string {
  return error instanceof UserError ? error.message : '요청을 처리하지 못했습니다. 잠시 후 다시 시도하세요.';
}

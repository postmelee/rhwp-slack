export class UserError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}
export function denied(): never {
  throw new UserError('access_denied', '문서 접근 권한을 확인할 수 없습니다. 앱과 요청자가 참여한 허용 채널의 파일인지 확인하세요.');
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) denied();
  return value as Record<string, unknown>;
}
export function userMessage(error: unknown): string {
  return error instanceof UserError ? error.message : '요청을 처리하지 못했습니다. 잠시 후 다시 시도하세요.';
}

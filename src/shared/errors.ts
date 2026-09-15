export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_PAGES = 200;
export const OPERATION_TIMEOUT_MS = 30_000;
export class ViewerError extends Error {
  constructor(public readonly code: string, message: string) { super(message); this.name = 'ViewerError'; }
}
export function validateInput(bytes: Uint8Array): void {
  if (bytes.byteLength > MAX_FILE_BYTES) throw new ViewerError('size', '20 MiB 이하 문서만 열 수 있습니다.');
  const hwp = [0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1];
  const zip = [0x50,0x4b,0x03,0x04];
  if (!hwp.every((b,i)=>bytes[i]===b) && !zip.every((b,i)=>bytes[i]===b)) throw new ViewerError('format', 'HWP5 또는 HWPX 문서를 선택하세요.');
}

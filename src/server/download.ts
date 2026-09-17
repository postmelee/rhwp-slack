import type {Actor, SourceFile} from './access';
import {UserError} from './errors';
import {MAX_FILE_BYTES, validateInput} from '../shared/errors';
import {readBounded} from './slack-api';
function allowedUrl(value: string, actor: Actor, file: SourceFile): URL {
  let url: URL;
  try {url=new URL(value);} catch {throw new UserError('download_url','문서 다운로드 주소를 확인할 수 없습니다.');}
  if (/[\\\s]/.test(value) || url.protocol!=='https:' || url.hostname!=='files.slack.com' || url.port || url.username || url.password || url.hash ||
      !url.pathname.startsWith(`/files-pri/${actor.teamId}-${file.id}/`)) {
    throw new UserError('download_url','허용되지 않은 문서 다운로드 주소입니다.');
  }
  return url;
}
export async function downloadFile(file: SourceFile, actor: Actor, token: string, signal?: AbortSignal, fetcher: typeof fetch=fetch): Promise<Buffer> {
  const deadline=AbortSignal.any([AbortSignal.timeout(30_000),...(signal?[signal]:[])]);
  let url=allowedUrl(file.downloadUrl,actor,file);
  for (let redirect=0; ; redirect++) {
    deadline.throwIfAborted();
    const response=await fetcher(url,{headers:{Authorization:`Bearer ${token}`},redirect:'manual',signal:deadline});
    if ([301,302,303,307,308].includes(response.status)) {
      const location=response.headers.get('location'); await response.body?.cancel();
      if (!location || redirect>=2) throw new UserError('redirect_limit','문서 다운로드 경로를 확인할 수 없습니다.');
      url=allowedUrl(new URL(location,url).href,actor,file); continue;
    }
    if (response.status!==200) {await response.body?.cancel(); throw new UserError('download_failed','문서를 내려받지 못했습니다. 공유 상태를 다시 확인하세요.');}
    const bytes=await readBounded(response,MAX_FILE_BYTES);
    if (bytes.length!==file.size) throw new UserError('source_changed','파일 크기가 변경되었습니다. 문서를 다시 요청하세요.');
    try {validateInput(bytes);} catch {throw new UserError('unsupported_format','평문 HWP5 또는 HWPX 문서만 지원합니다.');}
    return bytes;
  }
}

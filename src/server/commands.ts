import {ID} from './config';
import {UserError} from './errors';
export type Mode = 'open' | 'pdf';
export type Command = {kind:'help'} | {kind:'prepare'; mode:Mode; fileId:string};
export const HELP = [
  '/rhwp — 채널 설정 열기',
  '/rhwp open <Slack 파일 링크> — Studio에서 편집할 문서 준비',
  '/rhwp edit <Slack 파일 링크> — 문서 열기와 동일',
  '/rhwp pdf <Slack 파일 링크> — PDF로 볼 문서 준비',
  '/rhwp help — 사용법',
  '/rhwp settings — 관리자용 채널 설정',
  '응답의 rhwp에서 편집으로 문서를 편집할 수 있습니다. PDF로 보기는 Slack에 공유한 PDF로 연결합니다. 편집본은 새 파일로 저장합니다.',
  '채널 설정에 따라 HWP/HWPX 업로드 또는 @rhwp 멘션으로 스레드 미리보기를 만듭니다. 처음 3페이지를 보여주며 추가 페이지 보기로 앞 10페이지까지 펼칩니다.',
  '이미지 단독·전체/지정 PNG·ZIP 명령은 추후 제공됩니다.',
].join('\n');
export function parseFileLink(raw: string, workspaceHost: string): string {
  let value=raw.trim();
  if (value.startsWith('<')) {
    const match=/^<([^<>|\s]+)(?:\|[^<>]+)?>$/.exec(value);
    if (!match) throw new UserError('invalid_link','Slack 파일 링크 하나를 입력하세요.');
    value=match[1];
  }
  if (/[\s\\]/.test(value)) throw new UserError('invalid_link','지원되지 않는 Slack 파일 링크입니다.');
  let url: URL;
  try {url=new URL(value);} catch {throw new UserError('invalid_link','Slack 파일 URL을 입력하세요. 붙여넣기 후 파일명으로 바뀌면 한 번 실행 취소해 URL로 되돌리거나 메시지 메뉴의 한글 문서 열기를 사용하세요.');}
  if (!value.startsWith(`https://${workspaceHost}/files/`)) throw new UserError('invalid_link','현재 워크스페이스의 Slack 파일 링크를 입력하세요.');
  const rawPath=value.slice(`https://${workspaceHost}`.length);
  const match=/^\/files\/([UW][A-Z0-9]+)\/(F[A-Z0-9]+)(?:\/[^/]+)?\/?$/.exec(rawPath);
  if (url.protocol!=='https:' || url.hostname!==workspaceHost || url.port || url.username || url.password || url.search || url.hash || !match || !ID.file.test(match[2])) {
    throw new UserError('invalid_link','현재 워크스페이스의 Slack 파일 링크만 지원합니다. 메시지 링크와 외부 주소는 사용할 수 없습니다.');
  }
  if (match) {
    try {
      const filename=decodeURIComponent(rawPath.split('/')[4]??'');
      if (filename==='.' || filename==='..' || /[\\/\u0000-\u001f]/.test(filename)) throw new Error();
    } catch {throw new UserError('invalid_link','파일 링크의 이름 인코딩이 올바르지 않습니다.');}
  }
  return match[2];
}
export function parseCommand(text: string, host: string): Command {
  if (text.length>4096) throw new UserError('invalid_command','명령이 너무 깁니다.');
  const value=text.trim();
  if (!value || value==='help') return {kind:'help'};
  const match=/^(\S+)(?:\s+([\s\S]+))?$/.exec(value)!;
  if (['thumbnail','png'].includes(match[1])) throw new UserError('not_supported','첫 페이지 이미지와 PNG·ZIP 변환은 아직 제공되지 않습니다.');
  if (!['open','edit','pdf'].includes(match[1]) || !match[2]) throw new UserError('invalid_command','/rhwp open <Slack 파일 링크> 또는 /rhwp help를 사용하세요.');
  return {kind:'prepare',mode:match[1]==='pdf'?'pdf':'open',fileId:parseFileLink(match[2],host)};
}

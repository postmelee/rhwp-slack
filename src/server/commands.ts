import {ID} from './config';
import {UserError} from './errors';
export type Mode = 'open' | 'pdf';
export type Command = {kind:'help'} | {kind:'prepare'; mode:Mode; fileId:string};
export const HELP = [
  '/rhwp open <Slack 파일 링크> — Studio에서 편집할 문서 준비',
  '/rhwp edit <Slack 파일 링크> — 문서 열기와 동일',
  '/rhwp pdf <Slack 파일 링크> — PDF로 볼 문서 준비',
  '/rhwp help — 사용법',
  '현재 문서 접근 확인까지 시험 운영 중입니다. Slack 편집기·PDF 미리보기 연결은 아직 사용할 수 없습니다.',
  '첫 페이지 이미지와 전체/지정 페이지 PNG·ZIP은 추후 제공됩니다.',
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
  try {url=new URL(value);} catch {throw new UserError('invalid_link','Slack 파일 링크를 입력하세요.');}
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

import {InstallationError} from './store';
export type SignInFailure='login_expired'|'document_unavailable'|'signin_failed';
export class BrowserSignInError extends InstallationError {
  constructor(readonly reason:SignInFailure){super();}
}
const messages={
 login_expired:['로그인 연결이 만료되었습니다','로그인 시간이 지났거나 이미 사용한 연결입니다. Slack의 문서 카드에서 rhwp에서 편집을 다시 선택하고 같은 워크스페이스 계정으로 로그인해 주세요.'],
 document_unavailable:['이 문서 연결을 사용할 수 없습니다','앱 재설치, 문서 공유 해제 또는 접근 권한 변경으로 기존 연결을 사용할 수 없을 수 있습니다. 원본 문서가 있는 Slack 스레드에서 @rhwp로 새 편집 카드를 요청해 주세요. 접근 권한이 없다면 채널 관리자에게 문의하세요.'],
 signin_failed:['문서 로그인을 완료하지 못했습니다','Slack에서 rhwp에서 편집을 다시 선택하고 같은 워크스페이스 계정으로 로그인해 주세요. 문제가 계속되면 잠시 후 다시 시도하세요.'],
 cancelled:['문서 로그인을 취소했습니다','문서를 편집하려면 Slack의 문서 카드에서 rhwp에서 편집을 다시 선택하세요.'],
} as const;
/** Only fixed copy is rendered: callback parameters and exception messages never enter HTML. */
export function signInResultPage(reason:string|null):string{
 const key=reason!==null&&Object.hasOwn(messages,reason)?reason as keyof typeof messages:'signin_failed';
 const [title,detail]=messages[key];
 return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${title} · rhwp</title><style>body{margin:0;background:#f7f8f5;color:#182a39;font-family:system-ui,sans-serif;line-height:1.8}main{max-width:580px;margin:12vh auto;padding:32px}h1{font-size:28px;line-height:1.4;word-break:keep-all}p{word-break:keep-all;overflow-wrap:anywhere}.brand{font-weight:800;color:#173248}a{display:inline-block;margin-top:20px;padding:10px 22px;border-radius:8px;background:#173248;color:white;text-decoration:none}a:focus-visible{outline:3px solid #db642c;outline-offset:4px}.note{font-size:14px;color:#526371}</style></head><body><main><p class="brand">rhwp for Slack</p><h1>${title}</h1><p>${detail}</p><a href="https://app.slack.com/">Slack 열기</a><p class="note">이 안내 화면에서는 문서를 열거나 저장하지 않습니다. 편집 중이던 창이 있다면 닫지 말고 현재 편집본을 다운로드해 보관하세요.</p></main></body></html>`;
}

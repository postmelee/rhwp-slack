export interface EditorIdentity {cardId:string;teamId:string;userId:string;channelId:string;}
export class EditorApiError extends Error {constructor(message:string,readonly code?:string){super(message);}}
export function sameIdentity(a:EditorIdentity,b:EditorIdentity|undefined):boolean {
  return !!b&&(['cardId','teamId','userId','channelId'] as const).every(k=>typeof a[k]==='string'&&a[k]===b[k]);
}
/** A fresh OIDC ticket proves access again; matching the original actor prevents account switching. */
export function reconnectEditor(apiOrigin:string,identity:EditorIdentity,accept:(ticket:string,signal:AbortSignal)=>Promise<void>,timeoutMs=300_000):Promise<void>{
 const bytes=crypto.getRandomValues(new Uint8Array(32));
 const nonce=btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
 const url=new URL('/browser/open',apiOrigin);url.search=new URLSearchParams({workspace:identity.teamId,document:identity.cardId,reconnect:nonce}).toString();
 const popup=window.open(url.href,'_blank','popup,width=620,height=760');
 if(!popup)return Promise.reject(new Error('로그인 팝업을 허용한 뒤 다시 눌러 주세요. 편집 내용은 이 창에 유지됩니다.'));
 return new Promise<void>((resolve,reject)=>{
  let done=false,accepting=false;const controller=new AbortController();
  const finish=(error?:unknown)=>{if(done)return;done=true;controller.abort();clearTimeout(timer);clearInterval(closed);window.removeEventListener('message',receive);try{popup.close();}catch{}if(error)reject(error);else resolve();};
  const receive=(event:MessageEvent)=>{
   if(done||accepting||event.origin!==location.origin||event.source!==popup||event.data?.type!=='rhwp:reconnect'||event.data.nonce!==nonce||event.data.workspace!==identity.teamId||typeof event.data.ticket!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(event.data.ticket))return;
   accepting=true;void accept(event.data.ticket,controller.signal).then(()=>finish(),error=>finish(error));
  };
  window.addEventListener('message',receive);
  const timer=setTimeout(()=>finish(new Error('로그인 시간이 초과되었습니다. 편집 내용은 유지됩니다. 다시 시도해 주세요.')),timeoutMs);
  const closed=setInterval(()=>{if(popup.closed&&!accepting)finish(new Error('로그인을 취소했습니다. 편집 내용은 이 창에 유지됩니다.'));},500);
 });
}
export function deliverReconnect(ticket:string|null,workspace:string|null,nonce:string):boolean {
 if(!window.opener||!ticket||!workspace||!/^[A-Za-z0-9_-]{43}$/.test(nonce)||!/^[A-Za-z0-9_-]{43}$/.test(ticket))return false;
 window.opener.postMessage({type:'rhwp:reconnect',ticket,workspace,nonce},location.origin);
 return true; // The original window closes this popup only after validating the new identity.
}

import type {IncomingMessage,ServerResponse} from 'node:http';
import type {InstallOAuth} from './oauth';
const cookieName='__Host-rhwp-install-state';
const cookie=(value:string,age:number)=>`${cookieName}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${age}`;
function binding(raw:string):string {
  const matches=raw.split(';').map(s=>s.trim()).filter(s=>s.startsWith(cookieName+'='));
  return matches.length===1?matches[0].slice(cookieName.length+1):'';
}
/** Standalone routes; no operator credentials or installation data are rendered. */
export function installationRoutes(oauth:InstallOAuth){
  return async(req:IncomingMessage,res:ServerResponse,next:()=>void):Promise<void>=>{
    const url=new URL(req.url??'/',oauth.callback);
    if(!['/','/install','/oauth/callback'].includes(url.pathname)){next();return;}
    res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    const page=(status:number,message:string)=>{res.writeHead(status,{'Content-Type':'text/html; charset=utf-8'}).end('<!doctype html><html lang="ko"><meta charset="utf-8"><title>rhwp 설치</title><h1>rhwp 설치</h1><p>'+message+'</p></html>');};
    if(req.method!=='GET'){res.setHeader('Allow','GET');page(405,'지원하지 않는 요청입니다.');return;}
    if(url.pathname==='/'){
      page(200,'한글 문서의 PDF·페이지 이미지는 Slack에서 보고, 편집은 브라우저에서 할 수 있습니다.</p><p>문서 변환은 서버에서 처리하며 결과 파일은 Slack에 저장합니다. 설치 후 사용할 채널에 앱을 초대하고 /rhwp settings에서 동작 방식을 선택하세요.</p><p><a href="/install">Add to Slack · 워크스페이스에 추가</a>');return;
    }
    try{
      if(url.pathname==='/install'){
        const start=await oauth.start();res.setHeader('Set-Cookie',cookie(start.binding,600));res.writeHead(303,{Location:start.url}).end();return;
      }
      res.setHeader('Set-Cookie',cookie('',0));
      if(['state','code','error'].some(key=>url.searchParams.getAll(key).length>1))throw new Error('Duplicate parameter');
      const result=await oauth.finish({state:url.searchParams.get('state')??'',binding:binding(req.headers.cookie??''),code:url.searchParams.get('code')??undefined,error:url.searchParams.get('error')??undefined});
      page(200,result?'설치했습니다. Slack으로 돌아가 사용할 채널에 rhwp를 초대해 주세요. 채널 동작 모드는 /rhwp settings에서 설정할 수 있습니다.':'설치를 취소했습니다. 필요할 때 다시 설치해 주세요.');
    }catch{page(400,'설치를 완료하지 못했습니다. 원래 설치 페이지에서 다시 시작해 주세요.');}
  };
}

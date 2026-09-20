import type {IncomingMessage,ServerResponse} from 'node:http';
import type {EditorSignIn} from './signin';
import type {Tenants} from './tenants';
import {editorRoutes} from '../editor-routes';
import {ID} from '../config';
const cookieName='__Host-rhwp-signin-state';
// OpenID form_post is a cross-site top-level POST; Lax cookies are not sent on that callback.
const cookie=(value:string,age:number)=>`${cookieName}=${value}; Path=/; Secure; HttpOnly; SameSite=None; Max-Age=${age}`;
function binding(raw:string):string{const matches=raw.split(';').map(s=>s.trim()).filter(s=>s.startsWith(cookieName+'='));return matches.length===1?matches[0].slice(cookieName.length+1):'';}
export function browserSignInRoutes(signin:Pick<EditorSignIn,'callback'|'start'|'finish'>){
  return async(req:IncomingMessage,res:ServerResponse,next:()=>void):Promise<void>=>{
    const url=new URL(req.url??'/',signin.callback);
    if(!['/browser/open','/browser/callback'].includes(url.pathname)){next();return;}
    res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    const error=()=>{res.writeHead(400,{'Content-Type':'text/plain; charset=utf-8'}).end('문서를 열지 못했습니다. Slack에서 다시 문서 편집을 선택하고 같은 워크스페이스 계정으로 로그인해 주세요.');};
    try{
      if(url.pathname==='/browser/open'&&req.method==='GET'){
        if(['workspace','document'].some(key=>url.searchParams.getAll(key).length!==1)||url.searchParams.getAll('reconnect').length>1)throw new Error('Invalid parameter');
        const start=await signin.start(url.searchParams.get('workspace')!,url.searchParams.get('document')!,url.searchParams.get('reconnect')??undefined);
        res.setHeader('Set-Cookie',cookie(start.binding,600));res.writeHead(303,{Location:start.url}).end();return;
      }
      if(url.pathname!=='/browser/callback'||!['GET','POST'].includes(req.method??''))throw new Error('Invalid callback');
      res.setHeader('Set-Cookie',cookie('',0));
      let p:URLSearchParams;
      // Slack also returns authorization codes by query redirect after its login flow.
      // Both transports go through the same one-use state, browser binding and JWT checks.
      if(req.method==='GET'){
        if(Buffer.byteLength(url.search)>8192)throw new Error('Query too large');
        p=url.searchParams;
      }else{
        if(url.search||req.headers['content-type']?.split(';')[0]!=='application/x-www-form-urlencoded')throw new Error('Invalid callback');
        const chunks:Buffer[]=[];let size=0;const timer=setTimeout(()=>req.destroy(),10_000);
        try{for await(const chunk of req){const b=Buffer.from(chunk);size+=b.length;if(size>8192)throw new Error('Body too large');chunks.push(b);}}finally{clearTimeout(timer);}
        p=new URLSearchParams(Buffer.concat(chunks).toString());
      }
      if(['state','code','error'].some(key=>p.getAll(key).length>1)||!p.get('state')||(!p.get('code')&&!p.get('error')))throw new Error('Invalid parameter');
      const redirect=await signin.finish({state:p.get('state')??'',binding:binding(req.headers.cookie??''),code:p.get('code')??undefined,error:p.get('error')??undefined});
      if(!redirect){res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8'}).end('문서 로그인을 취소했습니다.');return;}
      res.writeHead(303,{Location:redirect}).end();
    }catch{error();}
  };
}
export function tenantEditorRoutes(tenants:Tenants,origin:string,editorOrigin:string){
  let saves=0;
  return async(req:IncomingMessage,res:ServerResponse,next:()=>void):Promise<void>=>{
    const path=new URL(req.url??'/',origin).pathname;if(!path.startsWith('/api/editor/')){next();return;}
    res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Vary','Origin');
    const requestOrigin=req.headers.origin,allowed=requestOrigin===origin||requestOrigin===editorOrigin;
    if(allowed)res.setHeader('Access-Control-Allow-Origin',requestOrigin!);
    if((requestOrigin!==undefined&&!allowed)||(['POST','OPTIONS'].includes(req.method??'')&&!allowed)){res.writeHead(403).end();return;}
    if(req.method==='OPTIONS'){
      const headers=String(req.headers['access-control-request-headers']??'').toLowerCase().split(',').map(v=>v.trim()).filter(Boolean);
      if(!['GET','POST'].includes(String(req.headers['access-control-request-method']))||headers.some(h=>!['authorization','content-type','x-save-request-id','x-document-format','x-rhwp-workspace'].includes(h))){res.writeHead(403).end();return;}
      res.setHeader('Access-Control-Allow-Methods','GET, POST');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type, X-Save-Request-Id, X-Document-Format, X-Rhwp-Workspace');res.writeHead(204).end();return;
    }
    const saving=path==='/api/editor/save'&&req.method==='POST';
    if(saving&&saves>=2){res.writeHead(429).end();return;}if(saving)saves++;
    try{
      const team=req.headers['x-rhwp-workspace'];if(typeof team!=='string'||!ID.team.test(team))throw new Error('Missing workspace');
      const tenant=await tenants.resolve(team);
      await editorRoutes(origin,tenant.documents,tenant.documents,editorOrigin,true)(req,res,next);
    }catch{if(!res.headersSent)res.writeHead(403,{'Content-Type':'application/json'}).end(JSON.stringify({error:'Slack에서 문서를 다시 열어 주세요.'}));else res.end();}
    finally{if(saving)saves--;}
  };
}

import type {IncomingMessage,ServerResponse} from 'node:http';
import {staticAssets} from './static-assets';
import {editorPolicy} from './editor-policy';
import type {Documents} from './documents';
import type {SessionAccess,Session} from './sessions';
import type {Receipt} from './saves';
export interface EditorDocuments {sessions:SessionAccess;authorize:Documents['authorize'];ensureSource:Documents['ensureSource'];}
export interface EditorSaves {save(s:Session,id:string,format:string,bytes:Buffer):Promise<Receipt>;status(s:Session,id:string):Promise<Receipt>;}
import {UserError,userMessage,object,denied} from './errors';
import {MAX_FILE_BYTES} from '../shared/errors';
async function read(req:IncomingMessage,limit:number):Promise<Buffer>{
  if(Number(req.headers['content-length']??0)>limit)throw new UserError('size','파일이 너무 큽니다.');
  const chunks:Buffer[]=[];let size=0;const timer=setTimeout(()=>req.destroy(),30_000);
  try{for await(const chunk of req){const b=Buffer.from(chunk);size+=b.length;if(size>limit)throw new UserError('size','파일이 너무 큽니다.');chunks.push(b);}return Buffer.concat(chunks);}finally{clearTimeout(timer);}
}
export function editorRoutes(origin:string,documents:EditorDocuments,saves:EditorSaves,editorOrigin?:string) {
  let reading=0;const serveStatic=staticAssets();
  return async(req:IncomingMessage,res:ServerResponse,next:()=>void):Promise<void>=>{
    const path=new URL(req.url??'/',origin).pathname;
    if(req.method==='GET'&&/^\/documents\/[0-9a-f-]{36}$/.test(path)){res.writeHead(302,{Location:'/editor/','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}).end();return;}
    if(!path.startsWith('/api/editor/')&&!['/','/viewer','/viewer/','/editor'].includes(path)&&!path.startsWith('/static/')&&!path.startsWith('/studio/')&&!path.startsWith('/editor/')){next();return;}
    res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Security-Policy',editorPolicy());
    const json=(value:unknown,code=200)=>{res.writeHead(code,{'Content-Type':'application/json'}).end(JSON.stringify(value));};
    try{
      if(path.startsWith('/api/editor/')){
        res.setHeader('Vary','Origin');
        const requestOrigin=req.headers.origin;
        const allowed=requestOrigin===origin||(!!editorOrigin&&requestOrigin===editorOrigin);
        if(requestOrigin!==undefined&&!allowed)denied();
        if((req.method==='POST'||req.method==='OPTIONS')&&!allowed)denied();
        if(allowed)res.setHeader('Access-Control-Allow-Origin',requestOrigin!);
        if(req.method==='OPTIONS'){
          if(!['GET','POST'].includes(String(req.headers['access-control-request-method'])))denied();
          const headers=String(req.headers['access-control-request-headers']??'').toLowerCase().split(',').map(s=>s.trim()).filter(Boolean);
          if(headers.some(h=>!['authorization','content-type','x-save-request-id','x-document-format'].includes(h)))denied();
          res.setHeader('Access-Control-Allow-Methods','GET, POST');
          res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type, X-Save-Request-Id, X-Document-Format');
          res.writeHead(204).end();return;
        }
        if(path==='/api/editor/exchange'&&req.method==='POST'){
          if(req.headers['content-type']!=='application/json')denied();
          const data=object(JSON.parse((await read(req,2048)).toString('utf8')));
          if(typeof data.ticket!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(data.ticket))denied();
          json({token:await documents.sessions.exchange(data.ticket)});return;
        }
        const match=/^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization??'');if(!match)denied();
        const s=await documents.sessions.require(match[1]);
        if(path==='/api/editor/document'&&req.method==='GET'){
          const card=await documents.authorize(s.cardId,s.actor);json({name:card.name,format:/\.hwpx$/i.test(card.name)?'hwpx':'hwp'});return;
        }
        if(path==='/api/editor/source'&&req.method==='GET'){
          const bytes=await documents.ensureSource(s.cardId,s.actor);
          res.writeHead(200,{'Content-Type':'application/octet-stream'}).end(bytes);return;
        }
        if(path==='/api/editor/save'&&req.method==='POST'){
          if(req.headers['content-type']!=='application/octet-stream')denied();
          if(reading>=2)throw new UserError('busy','저장 요청이 많습니다. 잠시 후 다시 시도하세요.');
          reading++;try{
            const bytes=await read(req,MAX_FILE_BYTES);
            // Recheck the session after body transfer, which may have crossed its expiry.
            await documents.sessions.require(match[1]);
            json(await saves.save(s,String(req.headers['x-save-request-id']??''),String(req.headers['x-document-format']??''),bytes));
          }finally{reading--;}return;
        }
        if(path.startsWith('/api/editor/saves/')&&req.method==='GET'){json(await saves.status(s,path.slice('/api/editor/saves/'.length)));return;}
        json({error:'지원되지 않는 요청입니다.'},404);return;
      }
      if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405).end();return;}
      if(['/','/viewer','/viewer/','/editor'].includes(path)){res.writeHead(302,{Location:'/editor/'}).end();return;}
      await serveStatic(req,res,path);
    }catch(error){if(!res.headersSent)json({error:userMessage(error)},error instanceof UserError?(error.code==='access_denied'||error.code==='session_expired'?403:error.code==='save_conflict'?409:400):500);else res.end();}
  };
}

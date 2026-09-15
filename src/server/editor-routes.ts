import type {IncomingMessage,ServerResponse} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import type {Documents} from './documents';
import type {Saves} from './saves';
import {UserError,userMessage,object,denied} from './errors';
import {MAX_FILE_BYTES} from '../shared/errors';
const mime:Record<string,string>={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
async function read(req:IncomingMessage,limit:number):Promise<Buffer>{
  if(Number(req.headers['content-length']??0)>limit)throw new UserError('size','파일이 너무 큽니다.');
  const chunks:Buffer[]=[];let size=0;const timer=setTimeout(()=>req.destroy(),30_000);
  try{for await(const chunk of req){const b=Buffer.from(chunk);size+=b.length;if(size>limit)throw new UserError('size','파일이 너무 큽니다.');chunks.push(b);}return Buffer.concat(chunks);}finally{clearTimeout(timer);}
}
export function editorRoutes(origin:string,documents:Documents,saves:Saves) {
  let reading=0;
  return async(req:IncomingMessage,res:ServerResponse,next:()=>void):Promise<void>=>{
    const path=new URL(req.url??'/',origin).pathname;
    if(req.method==='GET'&&/^\/documents\/[0-9a-f-]{36}$/.test(path)){res.writeHead(302,{Location:'/editor/','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}).end();return;}
    if(!path.startsWith('/api/editor/')&&!['/','/viewer','/viewer/','/editor'].includes(path)&&!path.startsWith('/studio/')&&!path.startsWith('/editor/')){next();return;}
    res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self'; img-src 'self' data: blob:; frame-src 'self'; frame-ancestors 'self' https://*.slack.com https://*.slack-gov.com https://*.slack-mcps.com; object-src 'none'; base-uri 'none'; form-action 'none'");
    const json=(value:unknown,code=200)=>{res.writeHead(code,{'Content-Type':'application/json'}).end(JSON.stringify(value));};
    try{
      if(path.startsWith('/api/editor/')){
        if(req.headers.origin!==undefined&&req.headers.origin!==origin)denied();
        if(req.method==='POST'&&req.headers.origin!==origin)denied();
        if(path==='/api/editor/exchange'&&req.method==='POST'){
          if(req.headers['content-type']!=='application/json')denied();
          const data=object(JSON.parse((await read(req,2048)).toString('utf8')));
          if(typeof data.ticket!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(data.ticket))denied();
          json({token:await documents.sessions.exchange(data.ticket)});return;
        }
        const match=/^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization??'');if(!match)denied();
        const s=await documents.sessions.require(match[1]);
        if(path==='/api/editor/document'&&req.method==='GET'){
          const card=await documents.authorize(s.cardId,s.actor);documents.source(s.cardId);json({name:card.name,format:/\.hwpx$/i.test(card.name)?'hwpx':'hwp'});return;
        }
        if(path==='/api/editor/source'&&req.method==='GET'){
          res.writeHead(200,{'Content-Type':'application/octet-stream'}).end(documents.source(s.cardId));return;
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
      const mount=resolve(path.startsWith('/studio/')?'dist/studio':'dist/editor');
      const file=resolve(mount,decodeURIComponent(path.slice(8)||'index.html'));
      if(!file.startsWith(mount+'/'))denied();
      const bytes=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream'}).end(req.method==='HEAD'?undefined:bytes);
    }catch(error){if(!res.headersSent)json({error:userMessage(error)},error instanceof UserError?(error.code==='access_denied'||error.code==='session_expired'?403:error.code==='save_conflict'?409:400):500);else res.end();}
  };
}

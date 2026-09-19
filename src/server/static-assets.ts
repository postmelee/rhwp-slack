import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import type {IncomingMessage,ServerResponse} from 'node:http';
interface Representation {file:string;size:number;etag:string;}
interface Manifest {version:string;files:Record<string,Partial<Record<'identity'|'br'|'gzip',Representation>>>;}
const mime:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.wasm':'application/wasm','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
export function staticAssets(root=resolve('dist')){
  let manifest:Promise<Manifest>|undefined;
  return async(req:IncomingMessage,res:ServerResponse,path:string):Promise<void>=>{
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405).end();return;}
    const data=await(manifest??=readFile(resolve(root,'static-manifest.json'),'utf8').then(JSON.parse).catch(error=>{manifest=undefined;throw error;}));
    const versioned=path.startsWith('/static/');
    if(versioned){const prefix=`/static/${data.version}/`;if(!path.startsWith(prefix)){res.writeHead(404).end();return;}path=path.slice(prefix.length);}
    else path=path.slice(1);
    if(path.endsWith('/'))path+='index.html';
    const record=data.files[path];
    if(!record?.identity||!Object.hasOwn(data.files,path)){res.writeHead(404).end();return;}
    const accepted=(req.headers['accept-encoding']??'').split(',').map(s=>{const [name,...params]=s.trim().split(';');const q=params.find(p=>p.trim().startsWith('q='));return {name,q:q?Number(q.trim().slice(2)):1};});
    const quality=(name:string)=>accepted.find(e=>e.name===name)?.q??accepted.find(e=>e.name==='*')?.q??0;
    const candidates=(['br','gzip'] as const).filter(e=>record[e]&&quality(e)>0).sort((a,b)=>quality(b)-quality(a));
    const encoding:'br'|'gzip'|'identity'=candidates.length?candidates[0]:'identity';
    const file=record[encoding]!;
    // Manifest is produced from build outputs; callers cannot select a filesystem path.
    const bytes=req.method==='HEAD'?undefined:await readFile(resolve(root,file.file));
    res.setHeader('Content-Type',mime[extname(path)]??'application/octet-stream');
    res.setHeader('Cache-Control',versioned?'public, max-age=31536000, immutable':'no-cache');
    res.setHeader('Vary','Accept-Encoding');res.setHeader('ETag',file.etag);
    if(encoding!=='identity')res.setHeader('Content-Encoding',encoding);
    if((req.headers['if-none-match']??'').split(',').some(tag=>tag.trim()==='*'||tag.trim().replace(/^W\//,'')===file.etag)){res.writeHead(304).end();return;}
    res.setHeader('Content-Length',file.size);res.writeHead(200).end(bytes);
  };
}

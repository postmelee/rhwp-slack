// Loopback developer workflow only. These tickets are not Slack authentication.
import { randomUUID } from 'node:crypto';
import { convertPdf } from '../conversion/convert.mjs';
const MAX_SOURCE=20*1024*1024;
const MAX_TOTAL=200*1024*1024;
export class DevDocuments {
  #items=new Map(); #busy=false;
  constructor({ttlMs=15*60_000,now=Date.now,convert=convertPdf}={}) {this.ttlMs=ttlMs;this.now=now;this.convert=convert;}
  sweep(){for(const [id,item] of this.#items)if(item.expiresAt<=this.now())this.#items.delete(id);}
  get(id){this.sweep();return this.#items.get(id);}
  async handle(req,res,path,origin){
    if(!path.startsWith('/api/dev/documents'))return false;
    const json=(code,body)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(body));};
    if(req.method==='POST'&&path==='/api/dev/documents') {
      if(req.headers.origin!==origin) {json(403,{error:'허용되지 않은 요청입니다.'});return true;}
      if(this.#busy){json(429,{error:'다른 PDF를 준비하고 있습니다. 잠시 후 다시 시도하세요.'});return true;}
      this.sweep();
      if(Number(req.headers['content-length'])>MAX_SOURCE){json(413,{error:'20 MiB 이하 문서만 열 수 있습니다.'});return true;}
      this.#busy=true;
      try {
        const chunks=[];let size=0;
        req.setTimeout(30_000,()=>req.destroy());
        for await(const chunk of req){size+=chunk.length;if(size>MAX_SOURCE){json(413,{error:'20 MiB 이하 문서만 열 수 있습니다.'});return true;}chunks.push(chunk);}
        const bytes=Buffer.concat(chunks);
        const total=[...this.#items.values()].reduce((sum,item)=>sum+item.bytes.length+item.pdf.length,0);
        if(total+size+50*1024*1024>MAX_TOTAL){json(503,{error:'임시 문서 보관 공간이 부족합니다.'});return true;}
        const name=decodeURIComponent(String(req.headers['x-document-name']||'document.hwp')).normalize('NFC').replace(/[\u0000-\u001f\u007f]/g,'').slice(0,255);
        const pdf=await this.convert(bytes);const id=randomUUID();
        this.#items.set(id,{name,bytes,pdf,expiresAt:this.now()+this.ttlMs});
        json(201,{id,name});
      }catch{if(!res.writableEnded)json(422,{error:'PDF를 만들지 못했습니다. 지원되는 HWP/HWPX인지 확인하세요.'});}
      finally{this.#busy=false;}
      return true;
    }
    const match=/^\/api\/dev\/documents\/([a-f0-9-]{36})(?:\/(source|pdf))?$/.exec(path);
    const item=match&&this.get(match[1]);
    if(req.method!=='GET'||!item){json(404,{error:'문서가 만료되었거나 존재하지 않습니다. 다시 열어 주세요.'});return true;}
    if(!match[2])json(200,{name:item.name});
    else {res.setHeader('Content-Type',match[2]==='pdf'?'application/pdf':'application/octet-stream');res.end(match[2]==='pdf'?item.pdf:item.bytes);}
    return true;
  }
}

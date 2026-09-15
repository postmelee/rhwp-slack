import {convertPreview,convertPageImages,type Preview,type PageImages} from '../conversion/convert.mjs';
import {UserError} from './errors';
export class PdfJobs {
  private tail:Promise<unknown>=Promise.resolve();private pending=0;private closed=false;
  constructor(private convert:(bytes:Uint8Array)=>Promise<Buffer|Preview>=convertPreview,private renderImages:typeof convertPageImages=convertPageImages){}
  private enqueue<T>(work:()=>Promise<T>):Promise<T>{
    if(this.closed||this.pending>=4)return Promise.reject(new UserError('pdf_busy','문서 변환 요청이 많습니다. 잠시 후 다시 요청하세요.'));
    this.pending++;const task=this.tail.catch(()=>{}).then(()=>{if(this.closed)throw new Error('closed');return work();});
    this.tail=task.finally(()=>{this.pending--;});this.tail.catch(()=>{});return task;
  }
  run<T>(bytes:Buffer,publish:(pdf:Buffer,images?:PageImages)=>Promise<T>):Promise<T>{
    return this.enqueue(async()=>{const result=await this.convert(bytes);return Buffer.isBuffer(result)?publish(result):publish(result.pdf,result);});
  }
  images<T>(bytes:Buffer,start:number,end:number,publish:(images:PageImages)=>Promise<T>):Promise<T>{
    return this.enqueue(async()=>publish(await this.renderImages(bytes,{start,end})));
  }
  async idle():Promise<void>{await this.tail.catch(()=>{});}
  async close():Promise<void>{this.closed=true;await this.idle();}
}

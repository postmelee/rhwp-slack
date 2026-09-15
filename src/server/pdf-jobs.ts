import {convertPdf} from '../conversion/convert.mjs';
import {UserError} from './errors';
export class PdfJobs {
  private tail:Promise<unknown>=Promise.resolve(); private pending=0;private closed=false;
  constructor(private convert=convertPdf){}
  run<T>(bytes:Buffer,publish:(pdf:Buffer)=>Promise<T>):Promise<T> {
    if(this.closed||this.pending>=4)return Promise.reject(new UserError('pdf_busy','PDF 요청이 많습니다. 잠시 후 다시 요청하세요.'));
    this.pending++;
    const task=this.tail.catch(()=>{}).then(async()=>{if(this.closed)throw new Error('closed');const pdf=await this.convert(bytes);return publish(pdf);});
    this.tail=task.finally(()=>{this.pending--;});this.tail.catch(()=>{});return task;
  }
  async idle():Promise<void>{await this.tail.catch(()=>{});}
  async close():Promise<void>{this.closed=true;await this.idle();}
}

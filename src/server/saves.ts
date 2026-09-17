import {createHash,randomUUID} from 'node:crypto';
import {validateDocument} from './validate-document';
import {validateInput} from '../shared/errors';
import type {Session} from './sessions';
import type {Documents} from './documents';
import {savedAttempt,type UploadAttempt} from './uploads';
import type {State} from './state';
import {UserError} from './errors';
export interface Receipt {requestId:string;saved:boolean;fileId?:string;url?:string;name:string;pdf:'waiting'|'pending'|'ready'|'failed';pdfUrl?:string;}
interface Operation {hash:string;sessionId:string;createdAt:number;attempt:UploadAttempt;cardId:string;receipt:Receipt;running?:Promise<Receipt>;}
export class Saves {
  private operations=new Map<string,Operation>();private active=0;
  constructor(private documents:Documents,private now=Date.now,private state?:State){
    for(const [key,value] of state?.all<Operation>('saves')??[])this.operations.set(key,value);
    documents.uploads.onCheckpoint=()=>this.checkpoint();
  }
  checkpoint():void{for(const [key,op] of this.operations){const {running:_,attempt,...record}=op;this.state?.put('saves',key,{...record,attempt:savedAttempt(attempt)});}}

  private key(s:Session,id:string):string{return JSON.stringify([s.actor.teamId,s.actor.userId,s.actor.channelId,s.cardId,id]);}
  private checkId(id:string):void{if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))throw new UserError('request_id','저장 요청 식별자가 올바르지 않습니다.');}
  sweep():void {for(const [id,op] of this.operations)if(!op.running&&op.receipt.pdf!=='pending'&&this.now()-op.createdAt>60*60_000){this.operations.delete(id);this.state?.delete('saves',id);}}
  async status(s:Session,id:string):Promise<Receipt>{this.checkId(id);await this.documents.authorize(s.cardId,s.actor);const op=this.operations.get(this.key(s,id));if(!op)throw new UserError('save_missing','저장 요청을 찾을 수 없습니다.');if(op.receipt.saved){const card=await this.documents.authorize(op.cardId,s.actor);op.receipt.pdf=card.pdf;op.receipt.pdfUrl=card.pdfUrl;}return {...op.receipt};}
  async save(s:Session,id:string,format:string,bytes:Buffer):Promise<Receipt> {
    this.checkId(id);validateInput(bytes);
    if(!['hwp','hwpx'].includes(format)||(bytes[0]===0x50)!==(format==='hwpx'))throw new UserError('format','문서 형식이 올바르지 않습니다.');
    const card=await this.documents.authorize(s.cardId,s.actor);this.sweep();
    const hash=createHash('sha256').update(format).update(bytes).digest('hex');const key=this.key(s,id);let op=this.operations.get(key);
    if(op&&op.hash!==hash)throw new UserError('save_conflict','같은 저장 요청의 문서 내용이 다릅니다.');
    if(op?.receipt.saved)return {...op.receipt};if(op?.running)return op.running;
    if(this.active>=2||(!op&&this.operations.size>=1000))throw new UserError('busy','저장 요청이 많습니다. 잠시 후 다시 시도하세요.');
    if(!op){op={hash,sessionId:s.id,createdAt:this.now(),attempt:{},cardId:randomUUID(),receipt:{requestId:id,saved:false,name:this.documents.revisionName(card,format),pdf:'waiting'}};this.operations.set(key,op);}
    this.checkpoint();const current=op;this.active++;
    current.running=(async()=>{
      if(!current.attempt.fileId)await validateDocument(bytes);
      const file=await this.documents.uploads.store(current.attempt,bytes,current.receipt.name,s.actor,async()=>{await this.documents.authorize(s.cardId,s.actor);});
      this.checkpoint();const revision=await this.documents.publishRevision(current.cardId,s.cardId,s.actor,file.id,current.receipt.name,bytes);
      Object.assign(current.receipt,{saved:true,fileId:file.id,url:file.url,pdf:'pending'});
      this.checkpoint();void this.documents.preview(revision,bytes).catch(()=>{}).then(()=>{
        current.receipt.pdf=revision.pdf;current.receipt.pdfUrl=revision.pdfUrl;this.checkpoint();
      });
      return {...current.receipt};
    })().finally(()=>{current.running=undefined;this.active--;this.checkpoint();});
    return current.running;
  }
  async close():Promise<void>{await Promise.allSettled([...this.operations.values()].map(op=>op.running));this.operations.clear();}
}

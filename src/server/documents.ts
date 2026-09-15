import {setTimeout as delay} from 'node:timers/promises';
import {authorizeFile, type Actor} from './access';
import type {Config} from './config';
import type {SlackApi} from './slack-api';
import type {Preparations,Job} from './jobs';
import {Sessions} from './sessions';
import {Uploads} from './uploads';
import {PdfJobs} from './pdf-jobs';
import {denied,UserError} from './errors';
export interface Card {
  id:string;actor:Actor;fileId:string;rootFileId:string;name:string;size:number;createdAt:number;
  revision:number;sequence?:number;parentId?:string;parentTs?:string;messageTs?:string;posting?:boolean;
  pdf:'pending'|'ready'|'failed';pdfUrl?:string;pdfFileId?:string;pngFileId?:string;
}
export class Documents {
  readonly sessions:Sessions; readonly uploads:Uploads; readonly pdf:PdfJobs;
  private cards=new Map<string,Card>(); private closed=false;
  constructor(private config:Config,private api:SlackApi,private preparations:Preparations,options:{now?:()=>number;fetcher?:typeof fetch;convert?:ConstructorParameters<typeof PdfJobs>[0]}={}) {
    this.now=options.now??Date.now;this.sessions=new Sessions(this.now,async(id,actor)=>{await this.authorize(id,actor);});
    this.uploads=new Uploads(api,config,options.fetcher);this.pdf=new PdfJobs(options.convert);
  }
  private now:()=>number;
  url(id:string):string{return `${this.config.publicOrigin}/documents/${id}`;}
  async authorize(id:string,actor:Actor):Promise<Card> {
    this.sweep();const card=this.cards.get(id);
    if(this.closed||!card||card.actor.teamId!==actor.teamId||card.actor.channelId!==actor.channelId)denied();
    const source=await authorizeFile(this.api,this.config,actor,card.fileId);
    // A revision cannot be used to bypass revocation of the original document.
    if(card.rootFileId!==card.fileId)await authorizeFile(this.api,this.config,actor,card.rootFileId);
    if(this.closed||this.cards.get(id)!==card||source.name!==card.name||source.size!==card.size)denied();
    return card;
  }
  source(id:string):Buffer {
    const job=this.preparations.get(id);
    if(!job?.bytes||job.state!=='ready')throw new UserError('source_expired','문서 준비가 만료되었습니다. /rhwp open으로 다시 요청하세요.');
    return job.bytes;
  }
  private metadata(card:Card,previewUrl?:string):Record<string,unknown> {
    return {url:this.url(card.id),external_ref:{id:card.id,type:'document'},entity_type:'slack#/entities/file',entity_payload:{
      attributes:{title:{text:card.name},product_name:'rhwp',full_size_preview:{is_supported:true,mime_type:'application/vnd.slack-embed',...(previewUrl?{preview_url:previewUrl}:{})}},
      slack_file:{id:card.fileId,type:/\.hwpx$/i.test(card.name)?'hwpx':'hwp'},
      fields:!previewUrl&&card.pngFileId?{preview:{type:'slack#/types/image',alt_text:`${card.name} 첫 페이지`,slack_file:{id:card.pngFileId}}}:{},
      custom_fields:[
        ...(card.pdfFileId?[{key:'pdf_file',label:'PDF 파일',type:'slack#/types/file',slack_file:{id:card.pdfFileId}}]:[]),
        ...(!card.pdfUrl?[{key:'pdf_status',label:'미리보기',type:'string',value:card.pdf==='failed'?'PDF 준비 실패':'PDF 준비 중'}]:[]),
      ],display_order:['preview','pdf_status']}};
  }
  private text(card:Card):string{return card.name.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  private message(card:Card):Record<string,unknown>{return {channel:card.actor.channelId,text:this.text(card),blocks:card.pdfUrl?[{type:'section',text:{type:'mrkdwn',text:`<${card.pdfUrl}|PDF로 보기>`}}]:[],parse:'none',unfurl_links:false,unfurl_media:false,metadata:{entities:[this.metadata(card)]}};}
  private async post(card:Card):Promise<void> {
    if(card.posting)return;
    card.posting=true; // An uncertain response is reconciled through this private file's share, never reposted.
    const posted=await this.api.call('chat.postMessage',{...this.message(card),client_msg_id:card.id,...(card.parentTs?{thread_ts:card.parentTs}:{})});
    if(typeof posted.ts!=='string'||!/^\d+\.\d+$/.test(posted.ts))throw new UserError('card_failed','문서 카드의 대화를 확인하지 못했습니다. 같은 저장 요청으로 다시 확인하세요.');
    card.messageTs=posted.ts;card.actor.threadTs??=posted.ts;
  }
  private async confirmShare(card:Card,fileId:string,check:()=>Promise<unknown>):Promise<void> {
    for(let i=0;i<6;i++){
      await check();
      const ts=await this.uploads.sharedMessage(fileId,{...card.actor,threadTs:card.parentTs},card.messageTs);
      if(ts){card.messageTs??=ts;card.actor.threadTs??=ts;return;}
      if(i<5)await delay(200*2**i);
    }
    throw new UserError('card_pending','카드의 파일 공유를 확인 중입니다. 같은 저장 요청으로 다시 확인하세요.');
  }
  async publish(job:Readonly<Job>):Promise<void> {
    if(!job.source||!job.bytes||job.state!=='ready')return;
    this.sweep();if(this.closed||this.cards.size>=1000)throw new UserError('busy','문서 요청이 많습니다.');
    const card:Card={id:job.id,actor:{...job.actor},fileId:job.fileId,rootFileId:job.fileId,revision:0,parentTs:job.actor.threadTs,name:job.source.name,size:job.source.size,createdAt:this.now(),pdf:'pending'};
    this.cards.set(card.id,card);
    try {await this.authorize(card.id,card.actor);await this.post(card);}
    catch(error){this.cards.delete(card.id);throw error;}
    void this.preview(card,job.bytes).catch(()=>{});
  }
  revisionName(parent:Card,format:string):string {
    const number=Math.max(0,...[...this.cards.values()].filter(c=>c.rootFileId===parent.rootFileId&&c.actor.channelId===parent.actor.channelId).map(c=>Math.max(c.revision,c.sequence??0)))+1;
    parent.sequence=number;
    return parent.name.replace(/(?:_편집본(?:_\d+)?)?\.(hwp|hwpx)$/i,'').slice(0,170)+`_편집본_${number}.${format}`;
  }
  async publishRevision(id:string,parentId:string,actor:Actor,fileId:string,name:string,bytes:Buffer):Promise<Card> {
    const parent=await this.authorize(parentId,actor);
    if(!parent.actor.threadTs)denied();
    let card=this.cards.get(id);
    if(!card){
      this.sweep();if(this.closed||this.cards.size>=1000)throw new UserError('busy','문서 요청이 많습니다.');
      const job=this.preparations.retain(id,actor,fileId,name,bytes);
      card={id,actor:{...actor,threadTs:parent.actor.threadTs},fileId,rootFileId:parent.rootFileId,parentId,parentTs:parent.actor.threadTs,name,size:job.source!.size,revision:Number(/_편집본_(\d+)\./.exec(name)?.[1]??1),createdAt:this.now(),pdf:'pending'};
      this.cards.set(id,card);
    }
    this.preparations.retain(id,actor,fileId,name,bytes);
    try{await this.post(card);}catch{/* Reconcile the same file and card after an uncertain post. */}
    await this.confirmShare(card,fileId,()=>this.authorize(parentId,actor));
    await this.authorize(card.id,actor);
    return card;
  }
  async preview(card:Card,bytes:Buffer):Promise<void> {
    try{
      await this.pdf.run(bytes,async(pdf,png)=>{
        const check=async()=>{await this.authorize(card.id,card.actor);};
        const file=await this.uploads.store({},pdf,card.name.replace(/\.(hwp|hwpx)$/i,'.pdf'),card.actor,check);
        if(!file.url)throw new Error('Missing PDF permalink');
        const image=png?await this.uploads.store({},png,card.name.replace(/\.(hwp|hwpx)$/i,'_첫페이지.png'),card.actor,check):undefined;
        card.pdfFileId=file.id;card.pdfUrl=file.url;card.pngFileId=image?.id;
        await check();await this.api.call('chat.update',{...this.message(card),ts:card.messageTs});
        await this.confirmShare(card,file.id,check);
        if(image)await this.confirmShare(card,image.id,check);
        card.pdf='ready';
      });
    }catch{
      card.pdf='failed';card.pdfUrl=undefined;
      if(!this.closed&&this.cards.get(card.id)===card&&card.messageTs){
        await this.authorize(card.id,card.actor);
        await this.api.call('chat.update',{...this.message(card),ts:card.messageTs});
      }
    }
  }
  async present(id:string,actor:Actor,triggerId:string):Promise<void> {
    const card=await this.authorize(id,actor);this.source(id);
    const ticket=this.sessions.issue(id,{...actor,threadTs:card.actor.threadTs});
    await this.api.call('entity.presentDetails',{trigger_id:triggerId,metadata:this.metadata(card,`${this.config.publicOrigin}/editor/#ticket=${ticket}`)});
  }
  invalidate(team:string,file:string):void {
    for(const [id,c] of this.cards)if(c.actor.teamId===team&&(c.fileId===file||c.rootFileId===file)){this.cards.delete(id);this.sessions.invalidate(id);}
  }
  sweep():void {for(const [id,c] of this.cards)if(this.now()-c.createdAt>=24*60*60_000){this.cards.delete(id);this.sessions.invalidate(id);}this.sessions.sweep();}
  async close():Promise<void>{this.closed=true;this.cards.clear();this.sessions.clear();await this.pdf.close();}
}

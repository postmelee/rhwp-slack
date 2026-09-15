import {authorizeFile, type Actor} from './access';
import type {Config} from './config';
import type {SlackApi} from './slack-api';
import type {Preparations,Job} from './jobs';
import {Sessions} from './sessions';
import {Uploads} from './uploads';
import {PdfJobs} from './pdf-jobs';
import {denied,UserError} from './errors';
export interface Card {id:string;actor:Actor;fileId:string;name:string;size:number;createdAt:number;messageTs?:string;pdf:'pending'|'ready'|'failed';pdfUrl?:string;}
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
      fields:{},actions:{primary_actions:card.pdfUrl?[{text:'PDF로 보기',action_id:'rhwp_pdf',value:card.id,url:card.pdfUrl}]:[]}}};
  }
  private text(card:Card):string{return `${card.name.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')} · 문서 제목을 눌러 편집${card.pdf==='pending'?' · PDF 준비 중':card.pdf==='failed'?' · PDF 준비 실패':' · PDF로 보기'}`;}
  async publish(job:Readonly<Job>):Promise<void> {
    if(!job.source||!job.bytes||job.state!=='ready')return;
    this.sweep();if(this.closed||this.cards.size>=1000)throw new UserError('busy','문서 요청이 많습니다.');
    const card:Card={id:job.id,actor:{...job.actor},fileId:job.fileId,name:job.source.name,size:job.source.size,createdAt:this.now(),pdf:'pending'};
    this.cards.set(card.id,card);
    try {
      await this.authorize(card.id,card.actor);
      const posted=await this.api.call('chat.postMessage',{channel:card.actor.channelId,text:this.text(card),parse:'none',unfurl_links:false,unfurl_media:false,metadata:{entities:[this.metadata(card)]},...(card.actor.threadTs?{thread_ts:card.actor.threadTs}:{})});
      if(typeof posted.ts!=='string'||!/^\d+\.\d+$/.test(posted.ts))throw new UserError('card_failed','문서 카드의 대화를 확인하지 못했습니다. 다시 요청해 주세요.');
      card.messageTs=posted.ts;
      // A top-level card owns its reply thread; a reply keeps the existing parent.
      card.actor.threadTs??=posted.ts;
    }catch(error){this.cards.delete(card.id);throw error;}
    void this.pdf.run(job.bytes,async(bytes)=>{
      const upload=await this.uploads.share({},bytes,card.name.replace(/\.(hwp|hwpx)$/i,'.pdf'),card.actor,async()=>{await this.authorize(card.id,card.actor);});
      card.pdf='ready';card.pdfUrl=upload.url;
    }).catch(()=>{card.pdf='failed';}).then(async()=>{
      if(this.closed||this.cards.get(card.id)!==card||!card.messageTs)return;
      await this.authorize(card.id,card.actor);
      await this.api.call('chat.update',{channel:card.actor.channelId,ts:card.messageTs,text:this.text(card),parse:'none',unfurl_links:false,unfurl_media:false,metadata:{entities:[this.metadata(card)]}});
    }).catch(()=>{});
  }
  async present(id:string,actor:Actor,triggerId:string):Promise<void> {
    const card=await this.authorize(id,actor);this.source(id);
    const ticket=this.sessions.issue(id,{...actor,threadTs:card.actor.threadTs});
    await this.api.call('entity.presentDetails',{trigger_id:triggerId,metadata:this.metadata(card,`${this.config.publicOrigin}/editor/#ticket=${ticket}`)});
  }
  invalidate(team:string,file:string):void {
    for(const [id,c] of this.cards)if(c.actor.teamId===team&&c.fileId===file){this.cards.delete(id);this.sessions.invalidate(id);}
  }
  sweep():void {for(const [id,c] of this.cards)if(this.now()-c.createdAt>=24*60*60_000){this.cards.delete(id);this.sessions.invalidate(id);}this.sessions.sweep();}
  async close():Promise<void>{this.closed=true;this.cards.clear();this.sessions.clear();await this.pdf.close();}
}

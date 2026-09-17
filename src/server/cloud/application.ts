import {createHash,randomUUID} from 'node:crypto';
import {measured,conversionMetric,milestone,errorCode} from './telemetry';
import {setTimeout as delay} from 'node:timers/promises';
import type {MetadataStore} from './metadata';
import {SharedSessions} from './sessions';
import {DurableTasks,MAX_TASK_ATTEMPTS,type TaskSpec,type TaskContext} from './tasks';
import {withLease,type LeaseContext} from './lease';
import type {Config} from '../config';
import {ID} from '../config';
import {authorizeFile,type Actor} from '../access';
import type {SlackApi} from '../slack-api';
import type {Card} from '../documents';
import type {Session} from '../sessions';
import type {Receipt} from '../saves';
import {downloadFile} from '../download';
import {Uploads,savedAttempt,type UploadAttempt} from '../uploads';
import {documentMetadata,documentMessage,documentGallery} from '../document-message';
import {UserError,denied} from '../errors';
import {validateDocument} from '../validate-document';
import {validateInput} from '../../shared/errors';
import {convertPreview,convertPageImages,type Preview} from '../../conversion/convert.mjs';
interface CloudCard extends Omit<Card,'imageAttempts'|'imageWork'|'updates'> {attempts?:Record<string,UploadAttempt>;fence?:string;removed?:boolean;}
interface Request {actor:Actor;fileId:string;}
interface SaveOperation {hash:string;cardId:string;attempt:UploadAttempt;receipt:Receipt;}
const hash=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
const stableId=(value:string)=>{const h=hash(value);return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;};
export class CloudApplication {
  readonly sessions:SharedSessions;
  constructor(readonly config:Config,readonly api:SlackApi,readonly store:MetadataStore,readonly tasks:DurableTasks,private options:{download?:typeof downloadFile;convert?:typeof convertPreview;images?:typeof convertPageImages;fetcher?:typeof fetch}={}){
    this.sessions=new SharedSessions(store,async(id,actor)=>{await this.authorize(id,actor);});
  }
  async mode(channel:string):Promise<'auto'|'mention'|'off'>{
    const p=await this.store.get<{mode:'auto'|'mention'|'off'}>('channels',channel);
    if(p)return p.mode;
    return await this.store.get('settings','initialized')?'off':this.config.channelIds.has(channel)?'auto':'off';
  }
  async accessConfig(actor:Actor):Promise<Config>{
    if(actor.teamId!==this.config.teamId||!ID.user.test(actor.userId)||!ID.channel.test(actor.channelId)||await this.mode(actor.channelId)==='off')denied();
    return {...this.config,channelIds:new Set([actor.channelId])};
  }
  async authorize(id:string,actor:Actor):Promise<CloudCard>{return measured('authorize',()=>this.authorizeUnmeasured(id,actor));}
  private async authorizeUnmeasured(id:string,actor:Actor):Promise<CloudCard>{
    const config=await this.accessConfig(actor),card=await this.store.get<CloudCard>('cards',id);
    if(!card||card.removed||card.actor.teamId!==actor.teamId||card.actor.channelId!==actor.channelId)denied();
    const source=await authorizeFile(this.api,config,actor,card.fileId);
    if(card.rootFileId!==card.fileId)await authorizeFile(this.api,config,actor,card.rootFileId);
    if(source.name!==card.name||source.size!==card.size)denied();return card;
  }
  async ensureSource(id:string,actor:Actor,outer?:AbortSignal):Promise<Buffer>{
    const card=await this.authorize(id,actor),config=await this.accessConfig(actor);
    const source=await authorizeFile(this.api,config,actor,card.fileId),signal=AbortSignal.any([AbortSignal.timeout(30_000),...(outer?[outer]:[])]);
    const bytes=await measured('download',()=>(this.options.download??downloadFile)(source,actor,this.config.botToken,signal));
    const fresh=await this.authorize(id,actor);
    if(fresh.contentHash&&hash(bytes)!==fresh.contentHash)throw new UserError('source_changed','원본 내용이 변경되었습니다. 다시 요청하세요.');
    return bytes; // No cross-request document cache.
  }
  async present(id:string,actor:Actor,triggerId:string):Promise<void>{
    const card=await this.authorize(id,actor),ticket=await this.sessions.issue(id,actor);
    await this.api.call('entity.presentDetails',{trigger_id:triggerId,metadata:documentMetadata(card,this.config.publicOrigin!,`${this.config.publicOrigin}/editor/#ticket=${ticket}`)});
  }
  async matchesUrl(id:string,url:unknown):Promise<boolean>{
    const card=await this.store.get<CloudCard>('cards',id);
    return !!card&&!card.removed&&typeof url==='string'&&[this.config.publicOrigin,card.origin].some(origin=>!!origin&&url===`${origin}/documents/${id}`);
  }
  async submit(actor:Actor,fileId:string,key:string):Promise<string>{
    await this.accessConfig(actor);if(!ID.file.test(fileId))denied();
    // Preserve request identities imported from the single-server deployment.
    if(key.startsWith('thread:')){
      const oldId=await this.store.get<string>('threads',key.slice(7));
      if(oldId){const old=await this.authorize(oldId,actor);if(old.fileId!==fileId)throw new Error('Imported thread conflict');return oldId;}
    }
    const id=stableId(JSON.stringify([actor.teamId,actor.channelId,key]));
    await this.store.atomic<Request,void>('preparations',id,current=>{
      if(current&&(current.fileId!==fileId||current.actor.teamId!==actor.teamId||current.actor.channelId!==actor.channelId))throw new Error('Request conflict');
      return {value:current??{actor,fileId},result:undefined};
    });
    if(!await this.store.get('cards',id))await this.reaction(id,actor,'pending',false);
    await this.tasks.enqueue('prepare:'+id,{teamId:actor.teamId,cardId:id,kind:'prepare'});return id;
  }
  async retryPreview(id:string,actor:Actor,messageTs:string):Promise<void>{
    await this.authorize(id,actor);
    await this.locked(id,async(card,context)=>{
      if(card.messageTs!==messageTs)denied();
      if(card.pdf==='ready'&&card.imageState==='ready')return;
      if(card.recovery&&card.recovery.state!=='failed')throw new UserError('pages_pending','자동 재시도 중입니다. 잠시 후 다시 확인하세요.');
      const taskId=await this.tasks.enqueue('preview-retry:'+id+':'+(card.recovery?.taskId??'initial'),{teamId:actor.teamId,cardId:id,kind:'preview',actor});
      card.recovery={taskId,state:'running',attempt:0,maxAttempts:MAX_TASK_ATTEMPTS};
      if(card.pdf!=='ready')card.pdf='pending';if(card.imageState!=='ready')card.imageState='pending';
      await this.update(card,actor,context);await this.reaction(id,card.actor,'pending',true);
    });
  }
  async morePages(id:string,actor:Actor,messageTs:string):Promise<void>{
    await this.authorize(id,actor);
    await this.locked(id,async(card,context)=>{
      if(card.messageTs!==messageTs)denied();
      if(!card.pageCount||card.pdf!=='ready')throw new UserError('pages_pending','PDF를 준비 중입니다. 잠시 후 다시 시도하세요.');
      if(card.imageState==='ready'&&(card.images?.length??0)>=Math.min(10,card.pageCount))return;
      if(card.recovery&&card.recovery.state!=='failed'&&card.imageState!=='ready')return;
      const taskId=await this.tasks.enqueue('images:'+id+':'+(card.recovery?.taskId??'initial'),{teamId:actor.teamId,cardId:id,kind:'images',actor});
      card.recovery={taskId,state:'running',attempt:0,maxAttempts:MAX_TASK_ATTEMPTS};card.imageState='pending';
      await this.update(card,actor,context);await this.reaction(id,card.actor,'pending',true);
    });
  }
  private guarded(context:TaskContext):SlackApi{return {call:async(method,args,signal)=>{await context.checkpoint();return this.api.call(method,args,AbortSignal.any([context.signal,...(signal?[signal]:[])]));}};}
  private async write(card:CloudCard,context:LeaseContext):Promise<void>{
    await context.checkpoint();
    await this.store.atomic<CloudCard,void>('cards',card.id,current=>{
      if(!current||current.removed||current.fence!==context.owner)throw new Error('Card ownership changed');
      const persisted={...card,pdfAttempt:card.pdfAttempt?savedAttempt(card.pdfAttempt):undefined,attempts:card.attempts?Object.fromEntries(Object.entries(card.attempts).map(([key,value])=>[key,savedAttempt(value)])):undefined};
      return {value:{...persisted,sequence:Math.max(card.sequence??0,current.sequence??0),fence:context.owner},result:undefined};
    });
  }
  private async locked<T>(id:string,run:(card:CloudCard,context:LeaseContext)=>Promise<T>):Promise<T>{
    return withLease(this.store,'card:'+id,async context=>{
      const card=await this.store.atomic<CloudCard,CloudCard>('cards',id,current=>{
        if(!current||current.removed)denied();const value={...current,fence:context.owner};return {value,result:value};
      });return run(card,context);
    });
  }
  private uploads(card:CloudCard,context:LeaseContext):Uploads {
    return new Uploads(this.guarded(context),this.config,async(url,init)=>{
      await context.checkpoint();return (this.options.fetcher??fetch)(url,{...init,signal:AbortSignal.any([context.signal,...(init?.signal?[init.signal]:[])])});
    },async()=>{await this.write(card,context);});
  }
  private async post(card:CloudCard,context:LeaseContext):Promise<void>{return measured('card_post',()=>this.postUnmeasured(card,context));}
  private async postUnmeasured(card:CloudCard,context:LeaseContext):Promise<void>{
    const api=this.guarded(context),uploads=this.uploads(card,context);
    if(card.messageTs)return;
    if(card.posting){
      const ts=await uploads.sharedMessage(card.fileId,{...card.actor,threadTs:card.parentTs});
      if(!ts)throw new UserError('card_pending','기존 카드의 공유 결과를 확인 중입니다.');
      card.messageTs=ts;card.actor.threadTs??=ts;await this.write(card,context);return;
    }
    card.posting=true;await this.write(card,context);await this.authorize(card.id,card.actor);
    const posted=await api.call('chat.postMessage',{...documentMessage(card,this.config.publicOrigin!),client_msg_id:card.id,...(card.parentTs?{thread_ts:card.parentTs}:{})});
    if(typeof posted.ts!=='string'||!/^\d+\.\d+$/.test(posted.ts))throw new Error('Missing message receipt');
    card.messageTs=posted.ts;card.actor.threadTs??=posted.ts;await this.write(card,context);milestone('first_card');
  }
  private async update(card:CloudCard,actor:Actor,context:LeaseContext):Promise<void>{return measured('card_update',()=>this.updateUnmeasured(card,actor,context));}
  private async updateUnmeasured(card:CloudCard,actor:Actor,context:LeaseContext):Promise<void>{
    await this.write(card,context);await this.authorize(card.id,actor);
    await this.guarded(context).call('chat.update',{...documentMessage(card,this.config.publicOrigin!),ts:card.messageTs,...(documentGallery(card).length?{file_ids:documentGallery(card).map(p=>p.fileId)}:{})});
  }
  private async confirm(card:CloudCard,fileId:string,actor:Actor,context:LeaseContext):Promise<void>{return measured('share_confirm',()=>this.confirmUnmeasured(card,fileId,actor,context));}
  private async confirmUnmeasured(card:CloudCard,fileId:string,actor:Actor,context:LeaseContext):Promise<void>{
    const uploads=this.uploads(card,context);
    for(let i=0;i<6;i++){
      await this.authorize(card.id,actor);
      if(await uploads.sharedMessage(fileId,{...card.actor,threadTs:card.parentTs},card.messageTs))return;
      if(i<5)await delay(200*2**i,undefined,{signal:context.signal});
    }
    throw new Error('File share is not confirmed');
  }
  async execute(spec:TaskSpec,task:TaskContext):Promise<void>{
    if(task.terminalFailure){await this.failed(spec,task,task.terminalFailure,true);return;}
    try{await this.executeWork(spec,task);}
    catch(error){await this.failed(spec,task,errorCode(error),!!task.finalAttempt).catch(()=>{});throw error;}
  }
  private async failed(spec:TaskSpec,task:TaskContext,code:string,final:boolean):Promise<void>{
    const card=await this.store.get<CloudCard>('cards',spec.cardId);
    if(!card){
      if(spec.kind==='prepare'){
        const request=await this.store.get<Request>('preparations',spec.cardId);
        if(request){await authorizeFile(this.api,await this.accessConfig(request.actor),request.actor,request.fileId);await this.reaction(spec.cardId,request.actor,final?'failed':'pending',true);}
      }
      return;
    }
    await this.authorize(card.id,spec.actor??card.actor);
    await this.locked(card.id,async(current,context)=>{
      // A deadline notification from an older generation cannot overwrite a manual retry.
      if(current.recovery&&current.recovery.taskId!==task.id)return;
      if(current.pdf==='ready'&&current.imageState==='ready')return;
      current.recovery={taskId:task.id??'legacy',state:final?'failed':'retrying',attempt:task.attempt??1,maxAttempts:task.maxAttempts??MAX_TASK_ATTEMPTS,errorCode:code};
      if(current.pdf!=='ready')current.pdf=final?'failed':'pending';
      if(current.imageState!=='ready')current.imageState=final?'failed':'pending';
      if(current.messageTs)await this.update(current,spec.actor??current.actor,context);else await this.write(current,context);
      await this.reaction(current.id,current.actor,final?'failed':'pending',true);
    });
  }
  private async executeWork(spec:TaskSpec,task:TaskContext):Promise<void>{
    if(spec.teamId!==this.config.teamId)denied();
    if(spec.kind==='prepare'){
      const request=await this.store.get<Request>('preparations',spec.cardId);if(!request)throw new Error('Missing request');
      const config=await this.accessConfig(request.actor),source=await authorizeFile(this.api,config,request.actor,request.fileId,task.signal);
      await this.reaction(spec.cardId,request.actor,'pending',true);
      await task.checkpoint();const bytes=await measured('download',()=>(this.options.download??downloadFile)(source,request.actor,this.config.botToken,task.signal));
      const fresh=await authorizeFile(this.api,config,request.actor,request.fileId,task.signal);if(fresh.name!==source.name||fresh.size!==source.size||fresh.downloadUrl!==source.downloadUrl)denied();
      await this.store.atomic<CloudCard,void>('cards',spec.cardId,current=>({value:current??{id:spec.cardId,actor:{...request.actor},fileId:source.id,rootFileId:source.id,name:source.name,size:source.size,contentHash:hash(bytes),origin:this.config.publicOrigin,createdAt:Date.now(),revision:0,parentTs:request.actor.threadTs,pdf:'pending',imageState:'pending'},result:undefined}));
      await this.locked(spec.cardId,async(card,context)=>{await task.checkpoint();await this.post(card,context);});
      await this.tasks.enqueue('preview:'+spec.cardId,{teamId:spec.teamId,cardId:spec.cardId,kind:'preview'});return;
    }
    await this.locked(spec.cardId,async(card,lease)=>{
      const context:LeaseContext={...lease,signal:AbortSignal.any([task.signal,lease.signal]),checkpoint:async()=>{await task.checkpoint();await lease.checkpoint();}};
      const actor=spec.actor??card.actor;await this.authorize(card.id,actor);
      if(spec.kind==='preview'&&card.pdf==='ready'&&card.imageState==='ready')return;
      await this.reaction(card.id,card.actor,'pending',true);
      card.recovery={taskId:task.id??'legacy',state:'running',attempt:task.attempt??1,maxAttempts:task.maxAttempts??MAX_TASK_ATTEMPTS};
      if(card.pdf!=='ready')card.pdf='pending';card.imageState='pending';
      if((task.attempt??1)>1)await this.update(card,actor,context);else await this.write(card,context);
      const bytes=await this.ensureSource(card.id,actor,context.signal);
      const result=await measured('conversion',()=>spec.kind==='preview'?(this.options.convert??convertPreview)(bytes,{timeoutMs:120_000,signal:context.signal,onMetric:conversionMetric}):(this.options.images??convertPageImages)(bytes,{start:1,end:Math.min(10,card.pageCount??10),timeoutMs:120_000,signal:context.signal,onMetric:conversionMetric}));
      await context.checkpoint();card.pageCount=result.pageCount;card.imageTarget=Math.min(spec.kind==='preview'?3:10,result.pageCount);card.imageState='pending';
      const uploads=this.uploads(card,context),check=async()=>{await this.authorize(card.id,actor);};
      try{
        if(spec.kind==='preview'&&!card.pdfFileId){
          const pdf=(result as Preview).pdf;card.pdfAttempt??={};
          const f=await measured('upload_pdf',()=>uploads.store(card.pdfAttempt!,pdf,card.name.replace(/\.(hwp|hwpx)$/i,'.pdf'),actor,check));
          if(!f.url)throw new Error('PDF permalink missing');card.pdfFileId=f.id;card.pdfUrl=f.url;await this.write(card,context);
        }
        card.images??=[];card.attempts??={};
        for(const page of result.pages.slice(0,card.imageTarget)){
          if(card.images.some(p=>p.page===page.page))continue;
          const attempt=card.attempts[String(page.page)]??={};
          const pageUploads=new Uploads(this.guarded(context),this.config,async(url,init)=>{await context.checkpoint();return (this.options.fetcher??fetch)(url,{...init,signal:AbortSignal.any([context.signal,...(init?.signal?[init.signal]:[])])});},async()=>{
            await this.write(card,context);
          });
          const f=await measured('upload_png',()=>pageUploads.store(attempt,page.png,`${card.name.replace(/\.(hwp|hwpx)$/i,'')}_${String(page.page).padStart(3,'0')}.png`,actor,check));
          card.images.push({page:page.page,fileId:f.id});await this.write(card,context);
        }
        await this.update(card,actor,context);
        if(card.pdfFileId){await this.confirm(card,card.pdfFileId,actor,context);card.pdf='ready';milestone('pdf_ready');}
        for(const page of card.images){await this.confirm(card,page.fileId,actor,context);page.shared=true;if(page.page===1)milestone('first_image');}
        card.imageState='ready';card.recovery=undefined;await this.update(card,actor,context);milestone('all_ready');await this.reaction(card.id,card.actor,'ready',true);
      }catch(error){throw error;}
    });
  }
  private async reaction(id:string,actor:Actor,state:'pending'|'ready'|'failed',validated:boolean):Promise<void>{
    if(!this.config.reactions||!actor.reactionTs)return;
    const key=JSON.stringify([actor.teamId,actor.channelId,actor.reactionTs]);
    type Works=Record<string,{state:'pending'|'ready'|'failed';validated:boolean}>;
    await this.store.atomic<Works,void>('reaction_groups',key,current=>({value:{...current,[id]:{state,validated:validated||current?.[id]?.validated===true}},expiresAt:Date.now()+7*86400_000,result:undefined}));
    // Cosmetic errors never repeat document conversion. A subsequent transition retries them.
    await withLease(this.store,'reaction:'+hash(key),async context=>{
      const works=Object.values(await this.store.get<Works>('reaction_groups',key)??{});if(!works.some(w=>w.validated))return;
      const name=works.some(w=>w.state==='pending')?'hourglass_flowing_sand':works.some(w=>w.state==='failed')?'warning':'white_check_mark';
      for(const emoji of ['hourglass_flowing_sand','white_check_mark','warning']){
        await context.checkpoint();await this.api.call(emoji===name?'reactions.add':'reactions.remove',{channel:actor.channelId,timestamp:actor.reactionTs,name:emoji}).catch(()=>{});
      }
    }).catch(()=>{});
  }
  async status(session:Session,id:string):Promise<Receipt>{
    this.saveId(id);await this.authorize(session.cardId,session.actor);
    const op=await this.store.get<SaveOperation>('saves',this.saveKey(session,id));if(!op)throw new UserError('save_missing','저장 요청을 찾을 수 없습니다.');
    if(!op.receipt.saved)return op.receipt;
    const card=await this.authorize(op.cardId,session.actor);return {...op.receipt,pdf:card.pdf,pdfUrl:card.pdfUrl};
  }
  private saveId(id:string):void{if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))throw new UserError('request_id','저장 요청 식별자가 올바르지 않습니다.');}
  private saveKey(s:Session,id:string):string{return JSON.stringify([s.actor.teamId,s.actor.userId,s.actor.channelId,s.cardId,id]);}
  async save(session:Session,id:string,format:string,bytes:Buffer):Promise<Receipt>{
    this.saveId(id);validateInput(bytes);if(!['hwp','hwpx'].includes(format)||(bytes[0]===0x50)!==(format==='hwpx'))throw new UserError('format','문서 형식이 올바르지 않습니다.');
    const parent=await this.authorize(session.cardId,session.actor);if(!parent.actor.threadTs)denied();
    const key=this.saveKey(session,id),digest=hash(Buffer.concat([Buffer.from(format),bytes]));
    return withLease(this.store,'save:'+hash(key),async context=>{
      let op=await this.store.get<SaveOperation>('saves',key);
      if(op&&op.hash!==digest)throw new UserError('save_conflict','같은 저장 요청의 문서 내용이 다릅니다.');
      if(op?.receipt.saved){await this.tasks.enqueue('preview:'+op.cardId,{teamId:session.actor.teamId,cardId:op.cardId,kind:'preview'});return this.status(session,id);}
      if(!op){
        const family=(await this.store.list<CloudCard>('cards')).map(([,c])=>c).filter(c=>c.rootFileId===parent.rootFileId&&c.actor.channelId===parent.actor.channelId);
        const floor=Math.max(parent.revision,...family.map(c=>Math.max(c.revision,c.sequence??0)));
        const number=await this.store.atomic<number,number>('sequences',JSON.stringify([parent.actor.channelId,parent.rootFileId]),current=>{const n=Math.max(current??0,floor)+1;return {value:n,result:n};});
        op={hash:digest,cardId:randomUUID(),attempt:{},receipt:{requestId:id,saved:false,name:parent.name.replace(/(?:_편집본(?:_\d+)?)?\.(hwp|hwpx)$/i,'').slice(0,170)+`_편집본_${number}.${format}`,pdf:'waiting'}};
        await this.store.atomic('saves',key,()=>({value:op,result:undefined}));
      }
      const operation=op;
      const checkpoint=async()=>{await context.checkpoint();await this.store.atomic('saves',key,()=>({value:{...operation,attempt:savedAttempt(operation.attempt)},result:undefined}));};
      if(!operation.attempt.fileId)await validateDocument(bytes);
      const uploads=new Uploads(this.guarded(context),this.config,async(url,init)=>{await context.checkpoint();return (this.options.fetcher??fetch)(url,{...init,signal:AbortSignal.any([context.signal,...(init?.signal?[init.signal]:[])])});},checkpoint);
      const f=await uploads.store(operation.attempt,bytes,operation.receipt.name,session.actor,async()=>{await this.authorize(session.cardId,session.actor);});
      await this.store.atomic<CloudCard,void>('cards',operation.cardId,current=>({value:current??{id:operation.cardId,actor:{...session.actor,threadTs:parent.actor.threadTs},parentTs:parent.actor.threadTs,parentId:parent.id,fileId:f.id,rootFileId:parent.rootFileId,name:operation.receipt.name,size:bytes.length,createdAt:Date.now(),origin:this.config.publicOrigin,contentHash:hash(bytes),revision:Number(/_편집본_(\d+)\./.exec(operation.receipt.name)?.[1]??1),pdf:'pending',imageState:'pending'},result:undefined}));
      // The revision is private until posted; check the parent until the new file has been shared.
      await this.locked(operation.cardId,async(card,lease)=>{
        if(!card.messageTs&&!card.posting){card.posting=true;await this.write(card,lease);await this.authorize(parent.id,session.actor);
          const r=await this.guarded(lease).call('chat.postMessage',{...documentMessage(card,this.config.publicOrigin!),client_msg_id:card.id,thread_ts:card.parentTs});
          if(typeof r.ts==='string'){card.messageTs=r.ts;await this.write(card,lease);}}
        if(!card.messageTs){const ts=await uploads.sharedMessage(f.id,{...card.actor,threadTs:card.parentTs});if(!ts)throw new UserError('upload_uncertain','저장 결과를 확인 중입니다. 같은 저장 요청으로 다시 확인하세요.');card.messageTs=ts;await this.write(card,lease);}
        await this.confirm(card,f.id,session.actor,lease);
      });
      operation.receipt={...operation.receipt,saved:true,fileId:f.id,url:f.url,pdf:'pending'};await checkpoint();
      await this.tasks.enqueue('preview:'+operation.cardId,{teamId:session.actor.teamId,cardId:operation.cardId,kind:'preview'});
      return {...operation.receipt};
    });
  }
  async invalidate(fileId:string):Promise<void>{
    for(const [id,card] of await this.store.list<CloudCard>('cards'))if(card.fileId===fileId||card.rootFileId===fileId){
      await this.store.atomic<CloudCard,void>('cards',id,current=>({value:current?{...current,removed:true}:undefined,result:undefined}));await this.sessions.invalidate(id);
    }
  }
}

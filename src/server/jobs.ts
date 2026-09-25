import {randomUUID, createHash} from 'node:crypto';
import {authorizeFile, assertActor, type Actor, type SourceFile} from './access';
import type {Config} from './config';
import type {Mode} from './commands';
import type {SlackApi} from './slack-api';
import {downloadFile} from './download';
import {UserError, userMessage} from './errors';
import type {State} from './state';
import {MAX_FILE_BYTES} from '../shared/errors';
export interface Job {
  id:string; actor:Actor; fileId:string; mode:Mode;
  state:'queued'|'downloading'|'ready'|'failed'|'expired'; createdAt:number;
  restore?:boolean;
  source?:SourceFile; bytes?:Buffer; contentHash?:string; expiresAt?:number; error?:string;
}
export type Notify = (job: Readonly<Job>) => Promise<void>;
interface Options {
  now?:()=>number; concurrency?:number; queueLimit?:number; timeoutMs?:number; ttlMs?:number; maxBytes?:number;
  download?:typeof downloadFile; notify?:Notify; state?:State; started?:Notify; registered?:(job:Job)=>void;
}
export class Preparations {
  private jobs=new Map<string,Job>();
  private requests=new Map<string,{id:string; expiresAt:number}>();
  private queue:Job[]=[];
  private running=new Map<string,AbortController>();
  private tasks=new Set<Promise<void>>();
  private reserved=0; private closed=false;
  private now:()=>number;
  constructor(private config:Config, private api:SlackApi, private options:Options={}) {
    this.now=options.now??Date.now;
    for(const [id,j] of options.state?.all<Job>('jobs')??[]){
      if(j.actor.teamId!==config.teamId)continue;
      if(j.state==='queued'||j.state==='downloading'){
        j.state=j.restore?'expired':'queued';if(j.state==='queued')this.queue.push(j);
      }else if(j.state==='ready'){j.state=!j.restore&&!options.state?.get('cards',id)?'queued':'expired';if(j.state==='queued')this.queue.push(j);}
      this.jobs.set(id,j);
    }
    for(const [key,value] of options.state?.all<{id:string;expiresAt:number}>('requests')??[])this.requests.set(key,value);
    this.sweep();
  }
  private persist(job:Job):void {
    const {bytes:_,source:__,...record}=job;this.options.state?.put('jobs',job.id,record);
  }
  start():void{this.pump();}
  activeIds():string[]{return [...this.jobs.values()].filter(j=>['queued','downloading'].includes(j.state)).map(j=>j.id);}
  async restore(id:string,actor:Actor,fileId:string):Promise<Buffer>{
    assertActor(this.config,actor);
    const existing=this.get(id);
    if(existing?.state==='ready'&&existing.bytes)return existing.bytes;
    if(!existing||!['queued','downloading'].includes(existing.state)){
      if(this.closed||this.queue.length>=(this.options.queueLimit??20))throw new UserError('queue_full','문서 준비 요청이 많습니다. 잠시 후 다시 시도하세요.');
      const job:Job={id,actor:{...actor},fileId,mode:'open',state:'queued',createdAt:this.now(),restore:true};
      this.jobs.set(id,job);this.persist(job);this.queue.push(job);this.pump();
    }
    while(['queued','downloading'].includes(this.jobs.get(id)?.state??'')){
      if(this.closed)throw new UserError('stopping','서버가 재시작 중입니다. 다시 열어 주세요.');
      await new Promise(resolve=>setTimeout(resolve,25));
    }
    const result=this.get(id);if(result?.state!=='ready'||!result.bytes)throw new UserError('source_unavailable',result?.error??'문서를 다시 준비하지 못했습니다. 공유 상태를 확인해 주세요.');
    return result.bytes;
  }
  submit(actor:Actor, fileId:string, mode:Mode, requestId:string): {id:string; duplicate:boolean} {
    assertActor(this.config,actor); this.sweep();
    if (this.closed) throw new UserError('stopping','서버가 재시작 중입니다. 잠시 후 다시 시도하세요.');
    const key=JSON.stringify([actor.teamId,actor.userId,actor.channelId,requestId]);
    const previous=this.requests.get(key); if (previous) return {id:previous.id,duplicate:true};
    if (this.queue.length >= (this.options.queueLimit??20) || this.jobs.size>=1000 || this.requests.size>=10_000) throw new UserError('queue_full','요청이 많습니다. 잠시 후 다시 시도하세요.');
    const job:Job={id:randomUUID(),actor:{...actor},fileId,mode,state:'queued',createdAt:this.now()};
    this.jobs.set(job.id,job); this.requests.set(key,{id:job.id,expiresAt:this.now()+24*60*60_000});
    this.persist(job);this.options.state?.put('requests',key,this.requests.get(key));this.options.registered?.(job);
    this.queue.push(job); queueMicrotask(()=>this.pump());
    return {id:job.id,duplicate:false};
  }
  // Retain an already validated export under the same aggregate memory/TTL limits as downloads.
  retain(id:string,actor:Actor,fileId:string,name:string,bytes:Buffer):Readonly<Job> {
    assertActor(this.config,actor);this.sweep();
    const existing=this.jobs.get(id);if(existing?.state==='ready'&&existing.bytes)return existing;
    const total=[...this.jobs.values()].reduce((sum,item)=>sum+(item.bytes?.length??0),0);
    if(this.closed||bytes.length>MAX_FILE_BYTES||(!existing&&this.jobs.size>=1000)||total+this.reserved+bytes.length>(this.options.maxBytes??200*1024*1024))throw new UserError('storage_full','임시 문서 보관 공간이 부족합니다. 잠시 후 다시 시도하세요.');
    const job:Job={id,actor:{...actor},fileId,mode:'open',state:'ready',createdAt:this.now(),source:{id:fileId,name,size:bytes.length,downloadUrl:''},bytes:Buffer.from(bytes),contentHash:createHash('sha256').update(bytes).digest('hex'),expiresAt:this.now()+(this.options.ttlMs??15*60_000)};
    this.jobs.set(id,job);this.persist(job);return job;
  }
  // Server-internal only. Stage 5 must reauthorize every client-facing exchange/read.
  get(id:string):Readonly<Job>|undefined {this.sweep();return this.jobs.get(id);}
  sweep():void {
    const now=this.now();
    for (const job of this.jobs.values()) {
      if (job.state==='ready' && (job.expiresAt??0)<=now) {job.bytes=undefined;job.state='expired';}
      if (!this.running.has(job.id) && job.state!=='queued' && now-job.createdAt>=24*60*60_000) {this.jobs.delete(job.id);this.options.state?.delete('jobs',job.id);}
    }
    for (const [key,item] of this.requests) if (item.expiresAt<=now) {this.requests.delete(key);this.options.state?.delete('requests',key);}
  }
  invalidateCard(id:string):void {
    const job=this.jobs.get(id);if(!job)return;
    this.running.get(id)?.abort();job.bytes=undefined;job.state='expired';this.persist(job);
  }
  invalidate(teamId:string,fileId:string,keep?:ReadonlySet<string>):void {
    for (const job of this.jobs.values()) if (job.actor.teamId===teamId && job.fileId===fileId && !keep?.has(job.actor.channelId)) {
      this.invalidateCard(job.id);
    }
  }
  private pump():void {
    while (!this.closed && this.queue.length && this.running.size<(this.options.concurrency??2)) {
      const job=this.queue.shift()!; if (job.state!=='queued') continue;
      const controller=new AbortController(); this.running.set(job.id,controller);
      const task=this.run(job,controller).finally(()=>{this.running.delete(job.id);this.tasks.delete(task);this.pump();});
      this.tasks.add(task);
    }
  }
  private async run(job:Job, controller:AbortController):Promise<void> {
    const timeout=setTimeout(()=>controller.abort(),this.options.timeoutMs??120_000);
    const signal=controller.signal; let reservation=false;
    try {
      this.sweep();
      const total=[...this.jobs.values()].reduce((sum,item)=>sum+(item.bytes?.length??0),0);
      if (total+this.reserved+MAX_FILE_BYTES>(this.options.maxBytes??200*1024*1024)) throw new UserError('storage_full','임시 문서 보관 공간이 부족합니다. 잠시 후 다시 시도하세요.');
      this.reserved+=MAX_FILE_BYTES; reservation=true; job.state='downloading';this.persist(job);
      const source=await authorizeFile(this.api,this.config,job.actor,job.fileId,signal);
      signal.throwIfAborted();
      if(!job.restore)await this.options.started?.(job).catch(()=>{});
      const bytes=await (this.options.download??downloadFile)(source,job.actor,this.config.botToken,signal);
      signal.throwIfAborted();
      // Recheck revocation/sharing changes after downloading; never deliver on stale authorization.
      const checked=await authorizeFile(this.api,this.config,job.actor,job.fileId,signal);
      signal.throwIfAborted();
      if (checked.size!==source.size || checked.name!==source.name || checked.downloadUrl!==source.downloadUrl) throw new UserError('source_changed','파일 정보가 변경되었습니다. 문서를 다시 요청하세요.');
      job.source=source; job.bytes=bytes; job.contentHash=createHash('sha256').update(bytes).digest('hex');
      job.expiresAt=this.now()+(this.options.ttlMs??15*60_000); job.state='ready';
    } catch (error) {
      job.bytes=undefined;
      if (job.state!=='expired') {job.state='failed';job.error=signal.aborted?'문서 준비 시간이 초과되었거나 취소되었습니다. 다시 요청하세요.':userMessage(error);}
    } finally {
      this.persist(job);clearTimeout(timeout); if (reservation) this.reserved-=MAX_FILE_BYTES;
    }
    // Notification failure must not repeat a completed download or expose raw API errors.
    if (!this.closed && !job.restore && job.state!=='expired') await this.options.notify?.(job).catch(()=>{});
  }
  async idle():Promise<void> {this.pump();while(this.tasks.size) await Promise.all([...this.tasks]);}
  async close():Promise<void> {
    this.closed=true; this.queue=[];
    for (const controller of this.running.values()) controller.abort();
    await Promise.all([...this.tasks]); this.jobs.clear();this.requests.clear();
  }
}

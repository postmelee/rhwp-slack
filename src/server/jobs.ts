import {randomUUID, createHash} from 'node:crypto';
import {authorizeFile, assertActor, type Actor, type SourceFile} from './access';
import type {Config} from './config';
import type {Mode} from './commands';
import type {SlackApi} from './slack-api';
import {downloadFile} from './download';
import {UserError, userMessage} from './errors';
import {MAX_FILE_BYTES} from '../shared/errors';
export interface Job {
  id:string; actor:Actor; fileId:string; mode:Mode;
  state:'queued'|'downloading'|'ready'|'failed'|'expired'; createdAt:number;
  source?:SourceFile; bytes?:Buffer; contentHash?:string; expiresAt?:number; error?:string;
}
export type Notify = (job: Readonly<Job>) => Promise<void>;
interface Options {
  now?:()=>number; concurrency?:number; queueLimit?:number; timeoutMs?:number; ttlMs?:number; maxBytes?:number;
  download?:typeof downloadFile; notify?:Notify;
}
export class Preparations {
  private jobs=new Map<string,Job>();
  private requests=new Map<string,{id:string; expiresAt:number}>();
  private queue:Job[]=[];
  private running=new Map<string,AbortController>();
  private tasks=new Set<Promise<void>>();
  private reserved=0; private closed=false;
  private now:()=>number;
  constructor(private config:Config, private api:SlackApi, private options:Options={}) {this.now=options.now??Date.now;}
  submit(actor:Actor, fileId:string, mode:Mode, requestId:string): {id:string; duplicate:boolean} {
    assertActor(this.config,actor); this.sweep();
    if (this.closed) throw new UserError('stopping','서버가 재시작 중입니다. 잠시 후 다시 시도하세요.');
    const key=JSON.stringify([actor.teamId,actor.userId,actor.channelId,requestId]);
    const previous=this.requests.get(key); if (previous) return {id:previous.id,duplicate:true};
    if (this.queue.length >= (this.options.queueLimit??20) || this.jobs.size>=1000 || this.requests.size>=10_000) throw new UserError('queue_full','요청이 많습니다. 잠시 후 다시 시도하세요.');
    const job:Job={id:randomUUID(),actor:{...actor},fileId,mode,state:'queued',createdAt:this.now()};
    this.jobs.set(job.id,job); this.requests.set(key,{id:job.id,expiresAt:this.now()+24*60*60_000});
    this.queue.push(job); queueMicrotask(()=>this.pump());
    return {id:job.id,duplicate:false};
  }
  // Server-internal only. Stage 5 must reauthorize every client-facing exchange/read.
  get(id:string):Readonly<Job>|undefined {this.sweep();return this.jobs.get(id);}
  sweep():void {
    const now=this.now();
    for (const job of this.jobs.values()) {
      if (job.state==='ready' && (job.expiresAt??0)<=now) {job.bytes=undefined;job.state='expired';}
      if (!this.running.has(job.id) && job.state!=='queued' && now-job.createdAt>=24*60*60_000) this.jobs.delete(job.id);
    }
    for (const [key,item] of this.requests) if (item.expiresAt<=now) this.requests.delete(key);
  }
  invalidate(teamId:string,fileId:string):void {
    for (const job of this.jobs.values()) if (job.actor.teamId===teamId && job.fileId===fileId) {
      this.running.get(job.id)?.abort(); job.bytes=undefined; job.state='expired';
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
      this.reserved+=MAX_FILE_BYTES; reservation=true; job.state='downloading';
      const source=await authorizeFile(this.api,this.config,job.actor,job.fileId,signal);
      signal.throwIfAborted();
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
      clearTimeout(timeout); if (reservation) this.reserved-=MAX_FILE_BYTES;
    }
    // Notification failure must not repeat a completed download or expose raw API errors.
    if (!this.closed && job.state!=='expired') await this.options.notify?.(job).catch(()=>{});
  }
  async idle():Promise<void> {this.pump();while(this.tasks.size) await Promise.all([...this.tasks]);}
  async close():Promise<void> {
    this.closed=true; this.queue=[];
    for (const controller of this.running.values()) controller.abort();
    await Promise.all([...this.tasks]); this.jobs.clear();this.requests.clear();
  }
}

import {isPermanentConversionFailure} from '../../conversion/failures.mjs';
import {createHash,randomUUID} from 'node:crypto';
import {CloudTasksClient} from '@google-cloud/tasks';
import type {Actor} from '../access';
import type {MetadataStore} from './metadata';
import {errorCode} from './telemetry';
export const MAX_TASK_ATTEMPTS=3;
export const TASK_LIFETIME_MS=15*60_000;
export interface TaskSpec {teamId:string;cardId:string;kind:'prepare'|'preview'|'images'|'event';actor?:Actor;}
export interface Work {spec:TaskSpec;state:'queued'|'running'|'done'|'failed';owner?:string;leaseUntil?:number;generation:number;createdAt:number;deadlineAt?:number;failureCode?:string;watchdogFor?:string;}
export interface TaskPublisher {publish(id:string,notBefore?:number):Promise<void>;}
export class GoogleTaskPublisher implements TaskPublisher {
  constructor(private client:CloudTasksClient,private queue:string,private workerOrigin:string,private serviceAccount:string){
    const url=new URL(workerOrigin);
    if(url.protocol!=='https:'||url.origin!==workerOrigin||!url.hostname.endsWith('.run.app'))throw new Error('Expected a Cloud Run worker origin');
    if(!/^projects\/[^/]+\/locations\/[^/]+\/queues\/[^/]+$/.test(queue)||!serviceAccount.endsWith('.iam.gserviceaccount.com'))throw new Error('Invalid task queue configuration');
  }
  async publish(id:string,notBefore?:number):Promise<void>{
    if(!/^[a-f0-9]{64}$/.test(id)||(notBefore!==undefined&&(!Number.isSafeInteger(notBefore)||notBefore<0)))throw new Error('Invalid task ID or schedule');
    try{
      await this.client.createTask({parent:this.queue,task:{name:`${this.queue}/tasks/${id}`,dispatchDeadline:{seconds:900},...(notBefore===undefined?{}:{scheduleTime:{seconds:Math.ceil(notBefore/1000)}}),httpRequest:{
        httpMethod:'POST',url:this.workerOrigin+'/internal/tasks',headers:{'Content-Type':'application/json'},
        body:Buffer.from(JSON.stringify({id})),oidcToken:{serviceAccountEmail:this.serviceAccount,audience:this.workerOrigin},
      }}});
    }catch(error){if((error as {code?:number}).code!==6)throw error;}
  }
}
export class TaskBusy extends Error {readonly code='task_busy';}
export class LeaseLost extends Error {}
export interface TaskContext {signal:AbortSignal;checkpoint():Promise<void>;id?:string;attempt?:number;maxAttempts?:number;finalAttempt?:boolean;terminalFailure?:string;}
/** Queue messages contain an opaque ID only. No document contents, tokens or transfer URLs. */
export class DurableTasks {
  constructor(private store:MetadataStore,private publisher:TaskPublisher,private now=Date.now,private leaseMs=60_000){}
  async enqueue(requestKey:string,spec:TaskSpec):Promise<string>{
    const id=await this.reserve(requestKey,spec);await this.dispatch(id);return id;
  }
  /** Persist intent without starting work. Call dispatch only after releasing document locks. */
  async reserve(requestKey:string,spec:TaskSpec):Promise<string>{
    if(!/^T[A-Z0-9]+$/.test(spec.teamId)||!spec.cardId||!['prepare','preview','images','event'].includes(spec.kind)||!requestKey||requestKey.length>2048)throw new Error('Invalid task');
    const id=createHash('sha256').update(JSON.stringify([spec.teamId,requestKey])).digest('hex');
    await this.store.atomic<Work,Work|undefined>('tasks',id,current=>{
      if(current){if(JSON.stringify(current.spec)!==JSON.stringify(spec))throw new Error('Task key conflict');return {value:current,result:current.state==='done'||current.state==='failed'?undefined:current};}
      const value:Work={spec,state:'queued',generation:0,createdAt:this.now(),deadlineAt:this.now()+TASK_LIFETIME_MS};return {value,result:value};
    });
    return id;
  }
  async dispatch(id:string):Promise<void>{
    if(!/^[a-f0-9]{64}$/.test(id))throw new Error('Invalid task ID');
    const work=await this.store.get<Work>('tasks',id);if(!work)throw new Error('Missing reserved task');
    if(work.state==='done'||work.state==='failed')return;
    const spec=work.spec;
    // A separate scheduled delivery repairs the visible state even if the last worker was killed.
    // Publish it before the work, so acknowledging ingress always includes this durable handoff.
    if(spec.kind!=='event'){
      const watchId=createHash('sha256').update(id+':deadline').digest('hex'),deadline=work.deadlineAt??work.createdAt+TASK_LIFETIME_MS;
      await this.store.atomic<Work,void>('tasks',watchId,current=>({value:current??{spec,state:'queued',generation:0,createdAt:work.createdAt,deadlineAt:deadline,watchdogFor:id},result:undefined}));
      await this.publisher.publish(watchId,deadline);
    }
    await this.publisher.publish(id);
  }
  async execute(id:string,run:(spec:TaskSpec,context:TaskContext)=>Promise<void>):Promise<void>{
    if(!/^[a-f0-9]{64}$/.test(id))throw new Error('Invalid task ID');
    const owner=randomUUID(),controller=new AbortController();
    const work=await this.store.atomic<Work,Work|undefined>('tasks',id,current=>{
      if(!current)throw new Error('Unknown task');
      if(current.state==='done')return {value:current,result:undefined};
      if(current.watchdogFor&&(current.deadlineAt??0)>this.now())throw new TaskBusy('Reconciliation is not due');
      if(current.state==='running'&&(current.leaseUntil??0)>this.now())throw new TaskBusy('Task is already running');
      const deadlineAt=current.deadlineAt??current.createdAt+TASK_LIFETIME_MS;
      const terminal=!current.watchdogFor&&(current.state==='failed'||current.generation>=MAX_TASK_ATTEMPTS||deadlineAt<=this.now());
      const value:Work={...current,state:'running',owner,generation:current.generation+1,deadlineAt,leaseUntil:this.now()+this.leaseMs,
        ...(terminal?{failureCode:current.failureCode??'task_deadline'}:{})};
      return {value,result:value};
    });
    if(!work)return;
    const checkpoint=async()=>{
      controller.signal.throwIfAborted();
      try{await this.store.atomic<Work,void>('tasks',id,current=>{
        if(!current||current.owner!==owner||current.generation!==work.generation||current.state!=='running'||(current.leaseUntil??0)<=this.now())throw new LeaseLost('Worker lease expired');
        return {value:{...current,leaseUntil:this.now()+this.leaseMs},result:undefined};
      });}catch(error){controller.abort(new LeaseLost('Worker lease unavailable'));throw error;}
    };
    let renewal:Promise<void>=Promise.resolve();
    const timer=setInterval(()=>{renewal=renewal.then(checkpoint).catch(()=>{controller.abort(new LeaseLost('Worker lease unavailable'));});},Math.max(10,Math.floor(this.leaseMs/3)));timer.unref();
    const timeout=setTimeout(()=>controller.abort(Object.assign(new Error('Task deadline exceeded'),{code:'task_deadline'})),(work.watchdogFor||work.generation>MAX_TASK_ATTEMPTS||work.deadlineAt!<=this.now())?60_000:Math.max(1,Math.min(5*60_000,work.deadlineAt!-this.now())));timeout.unref();
    // An earlier retry error is diagnostic, not a terminal flag.
    let terminalFailure=!work.watchdogFor&&(work.generation>MAX_TASK_ATTEMPTS||work.deadlineAt!<=this.now()||isPermanentConversionFailure(work.failureCode))?work.failureCode??'task_deadline':undefined;
    try{
      if(work.watchdogFor){
        const target=await this.store.atomic<Work,Work|undefined>('tasks',work.watchdogFor,current=>{
          if(!current||current.state==='done')return {value:current,result:undefined};
          if((current.deadlineAt??current.createdAt+TASK_LIFETIME_MS)>this.now())throw new TaskBusy('Reconciliation is not due');
          const value:Work={...current,state:'failed',owner:undefined,leaseUntil:undefined,failureCode:current.failureCode??'task_deadline'};
          return {value,expiresAt:this.now()+7*86400_000,result:value};
        });
        if(target)await run(target.spec,{signal:controller.signal,checkpoint,id:work.watchdogFor,attempt:target.generation,maxAttempts:MAX_TASK_ATTEMPTS,finalAttempt:true,terminalFailure:target.failureCode});
      }else{
        // A terminal receipt survives callback failure. Redelivery only repairs its notification.
        const before=work.generation>MAX_TASK_ATTEMPTS;
        if(before)terminalFailure=work.failureCode??'task_attempts';
        await run(work.spec,{signal:controller.signal,checkpoint,id,attempt:Math.min(work.generation,MAX_TASK_ATTEMPTS),maxAttempts:MAX_TASK_ATTEMPTS,finalAttempt:work.generation>=MAX_TASK_ATTEMPTS,terminalFailure});
      }
      clearInterval(timer);await renewal;await checkpoint();
      await this.store.atomic<Work,void>('tasks',id,current=>{
        if(!current||current.owner!==owner||current.generation!==work.generation||current.state!=='running'||(current.leaseUntil??0)<=this.now())throw new LeaseLost('Worker lease expired');
        return {value:{...current,state:terminalFailure?'failed':'done',owner:undefined,leaseUntil:undefined},expiresAt:this.now()+7*86400_000,result:undefined};
      });
    }catch(error){
      clearInterval(timer);await renewal;
      const final=!(error instanceof TaskBusy)&&!work.watchdogFor&&(work.generation>=MAX_TASK_ATTEMPTS||work.deadlineAt!<=this.now()||isPermanentConversionFailure(errorCode(error))||terminalFailure!==undefined);
      const owned=await this.store.atomic<Work,boolean>('tasks',id,current=>{
        if(current?.owner!==owner)return {value:current,result:false};
        return {value:{...current,state:final?'failed':'queued',owner:undefined,leaseUntil:undefined,failureCode:terminalFailure??errorCode(error),generation:error instanceof TaskBusy?Math.max(0,current.generation-1):current.generation},expiresAt:final?this.now()+7*86400_000:undefined,result:true};
      }).catch(()=>false);
      if(!owned||!final)throw error;
      // The durable deadline delivery repairs a notification lost during this final attempt.
    }finally{clearInterval(timer);clearTimeout(timeout);controller.abort();}
  }
}

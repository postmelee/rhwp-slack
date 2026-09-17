import {createHash,randomUUID} from 'node:crypto';
import {CloudTasksClient} from '@google-cloud/tasks';
import type {Actor} from '../access';
import type {MetadataStore} from './metadata';
export interface TaskSpec {teamId:string;cardId:string;kind:'prepare'|'preview'|'images'|'event';actor?:Actor;}
interface Work {spec:TaskSpec;state:'queued'|'running'|'done';owner?:string;leaseUntil?:number;generation:number;createdAt:number;}
export interface TaskPublisher {publish(id:string):Promise<void>;}
export class GoogleTaskPublisher implements TaskPublisher {
  constructor(private client:CloudTasksClient,private queue:string,private workerOrigin:string,private serviceAccount:string){
    const url=new URL(workerOrigin);
    if(url.protocol!=='https:'||url.origin!==workerOrigin||!url.hostname.endsWith('.run.app'))throw new Error('Expected a Cloud Run worker origin');
    if(!/^projects\/[^/]+\/locations\/[^/]+\/queues\/[^/]+$/.test(queue)||!serviceAccount.endsWith('.iam.gserviceaccount.com'))throw new Error('Invalid task queue configuration');
  }
  async publish(id:string):Promise<void>{
    if(!/^[a-f0-9]{64}$/.test(id))throw new Error('Invalid task ID');
    try{
      await this.client.createTask({parent:this.queue,task:{name:`${this.queue}/tasks/${id}`,dispatchDeadline:{seconds:900},httpRequest:{
        httpMethod:'POST',url:this.workerOrigin+'/internal/tasks',headers:{'Content-Type':'application/json'},
        body:Buffer.from(JSON.stringify({id})),oidcToken:{serviceAccountEmail:this.serviceAccount,audience:this.workerOrigin},
      }}});
    }catch(error){if((error as {code?:number}).code!==6)throw error;} // ALREADY_EXISTS is a confirmed delivery record.
  }
}
export class TaskBusy extends Error {}
export class LeaseLost extends Error {}
export interface TaskContext {signal:AbortSignal;checkpoint():Promise<void>;id?:string;attempt?:number;}
/** Queue messages contain an opaque ID only. No file contents, Slack tokens or file URLs. */
export class DurableTasks {
  constructor(private store:MetadataStore,private publisher:TaskPublisher,private now=Date.now,private leaseMs=60_000){}
  async enqueue(requestKey:string,spec:TaskSpec):Promise<string>{
    if(!/^T[A-Z0-9]+$/.test(spec.teamId)||!spec.cardId||!['prepare','preview','images','event'].includes(spec.kind)||!requestKey||requestKey.length>2048)throw new Error('Invalid task');
    const id=createHash('sha256').update(JSON.stringify([spec.teamId,requestKey])).digest('hex');
    const shouldPublish=await this.store.atomic<Work,boolean>('tasks',id,current=>{
      if(current){if(JSON.stringify(current.spec)!==JSON.stringify(spec))throw new Error('Task key conflict');return {value:current,result:current.state!=='done'};}
      return {value:{spec,state:'queued',generation:0,createdAt:this.now()},result:true};
    });
    // Persist first. On publish failure, propagate it so ingress must not acknowledge success.
    // Retrying the same ingress/request key republishes the same deterministic task name.
    if(shouldPublish)await this.publisher.publish(id);return id;
  }
  async execute(id:string,run:(spec:TaskSpec,context:TaskContext)=>Promise<void>):Promise<void>{
    if(!/^[a-f0-9]{64}$/.test(id))throw new Error('Invalid task ID');
    const owner=randomUUID(),controller=new AbortController();
    const work=await this.store.atomic<Work,Work|undefined>('tasks',id,current=>{
      if(!current)throw new Error('Unknown task');
      if(current.state==='done')return {value:current,result:undefined};
      if(current.state==='running'&&(current.leaseUntil??0)>this.now())throw new TaskBusy('Task is already running');
      const value:Work={...current,state:'running',owner,generation:current.generation+1,leaseUntil:this.now()+this.leaseMs};
      return {value,result:value};
    });
    if(!work)return;
    const checkpoint=async()=>{
      controller.signal.throwIfAborted();
      try{
        await this.store.atomic<Work,void>('tasks',id,current=>{
          if(!current||current.owner!==owner||current.generation!==work.generation||current.state!=='running'||(current.leaseUntil??0)<=this.now())throw new LeaseLost('Worker lease expired');
          return {value:{...current,leaseUntil:this.now()+this.leaseMs},result:undefined};
        });
      }catch(error){controller.abort(new LeaseLost('Worker lease unavailable'));throw error;}
    };
    // No overlapping renewal calls. Work must checkpoint immediately before side effects.
    let renewal:Promise<void>=Promise.resolve();
    const timer=setInterval(()=>{renewal=renewal.then(checkpoint).catch(()=>{controller.abort(new LeaseLost('Worker lease unavailable'));});},Math.max(10,Math.floor(this.leaseMs/3)));timer.unref();
    try{
      await run(work.spec,{signal:controller.signal,checkpoint,id,attempt:work.generation});
      clearInterval(timer);await renewal;await checkpoint();
      await this.store.atomic<Work,void>('tasks',id,current=>{
        if(!current||current.owner!==owner||current.generation!==work.generation||current.state!=='running'||(current.leaseUntil??0)<=this.now())throw new LeaseLost('Worker lease expired');
        return {value:{spec:current.spec,state:'done',generation:current.generation,createdAt:current.createdAt},expiresAt:this.now()+7*24*60*60_000,result:undefined};
      });
    }catch(error){
      clearInterval(timer);await renewal;
      await this.store.atomic<Work,void>('tasks',id,current=>({value:current?.owner===owner?{spec:current.spec,state:'queued',generation:current.generation,createdAt:current.createdAt}:current,result:undefined})).catch(()=>{});
      throw error;
    }finally{clearInterval(timer);controller.abort();}
  }
}

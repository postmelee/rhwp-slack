import {randomUUID} from 'node:crypto';
import type {MetadataStore} from './metadata';
import {LeaseLost,TaskBusy,type TaskContext} from './tasks';
export interface LeaseContext extends TaskContext {owner:string;}
interface Lease {owner:string;until:number;}
export async function withLease<T>(store:MetadataStore,key:string,run:(context:LeaseContext)=>Promise<T>,now=Date.now):Promise<T>{
  const owner=randomUUID(),controller=new AbortController();
  await store.atomic<Lease,void>('locks',key,current=>{
    if(current&&current.until>now())throw new TaskBusy('Another request is modifying this document');
    return {value:{owner,until:now()+90_000},result:undefined};
  });
  const checkpoint=async()=>{
    controller.signal.throwIfAborted();
    try{await store.atomic<Lease,void>('locks',key,current=>{
      if(!current||current.owner!==owner||current.until<=now())throw new LeaseLost('Document lease expired');
      return {value:{owner,until:now()+90_000},result:undefined};
    });}catch(error){controller.abort(new LeaseLost('Document lease unavailable'));throw error;}
  };
  let pending=Promise.resolve();const timer=setInterval(()=>{pending=pending.then(checkpoint).catch(()=>{controller.abort();});},30_000);timer.unref();
  try{const result=await run({owner,signal:controller.signal,checkpoint});await checkpoint();return result;}
  finally{clearInterval(timer);await pending;controller.abort();await store.atomic<Lease,void>('locks',key,current=>({value:current?.owner===owner?undefined:current,result:undefined})).catch(()=>{});}
}

// A small, bounded set of uploads; all running work settles before its owner releases the lease.
export class BoundedWork {
  private active=new Set<Promise<void>>();private failed=false;private failure:unknown;private closed=false;
  constructor(private limit:1|2){}
  async add(run:()=>Promise<void>):Promise<void>{
    while(this.active.size>=this.limit)await Promise.race(this.active);
    if(this.closed)throw new Error('Upload pool closed');if(this.failed)throw this.failure;
    let work:Promise<void>;
    work=Promise.resolve().then(run).catch(error=>{if(!this.failed){this.failed=true;this.failure=error;}}).finally(()=>this.active.delete(work));
    this.active.add(work);
  }
  async finish():Promise<void>{this.closed=true;await Promise.all(this.active);if(this.failed)throw this.failure;}
}
export function serialWrites(){
  let tail:Promise<unknown>=Promise.resolve();
  return <T>(run:()=>Promise<T>):Promise<T>=>{const result=tail.then(run);tail=result.catch(()=>{});return result;};
}

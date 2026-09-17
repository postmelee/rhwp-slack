/** Only small application records belong here. Documents and credentials never do. */
export interface Change<T, R> {value?:T; expiresAt?:number; result:R;}
export interface MetadataStore {
  get<T>(kind:string,key:string):Promise<T|undefined>;
  list<T>(kind:string,limit?:number):Promise<[string,T][]>;
  /** The callback is synchronous, pure, and may run more than once on a transaction retry. */
  atomic<T,R>(kind:string,key:string,change:(current:T|undefined)=>Change<T,R>):Promise<R>;
}
export function recordName(kind:string,key:string):void {
  if(!/^[a-z][a-z0-9_-]{0,63}$/.test(kind)||!key||Buffer.byteLength(key)>2048)throw new Error('Invalid metadata reference');
}
export function encodeMetadata(value:unknown):string {
  const seen=new Set<object>();
  function check(v:unknown,depth:number):void {
    if(depth>24)throw new Error('Metadata is too deeply nested');
    if(v===null||typeof v==='boolean'||v===undefined)return;
    if(typeof v==='number'){if(!Number.isFinite(v))throw new Error('Invalid metadata number');return;}
    if(typeof v==='string'){
      if(/xox[baprs]-|Bearer\s|\/upload\/v1\/|files-pri\/|[?#](?:ticket|token|access_token)=/i.test(v))throw new Error('Credentials or transfer URLs cannot be persisted');
      return;
    }
    if(typeof v!=='object'||ArrayBuffer.isView(v)||v instanceof ArrayBuffer||seen.has(v))throw new Error('Only JSON metadata may be persisted');
    if(!Array.isArray(v)&&Object.getPrototypeOf(v)!==Object.prototype&&Object.getPrototypeOf(v)!==null)throw new Error('Only plain metadata objects may be persisted');
    seen.add(v);
    for(const [key,item] of Object.entries(v)){
      if(/^(bytes|body|content|buffer|access_?token|bot_?token|signing_?secret|upload_?url|download_?url|token|ticket)$/i.test(key)&&item!==undefined)throw new Error('Document data and credentials cannot be persisted');
      check(item,depth+1);
    }
    seen.delete(v);
  }
  check(value,0);const json=JSON.stringify(value);
  if(json===undefined||Buffer.byteLength(json)>256*1024)throw new Error('Metadata record is empty or too large');
  return json;
}
export function expiry(value:number|undefined):void {
  if(value!==undefined&&(!Number.isSafeInteger(value)||value<0))throw new Error('Invalid metadata expiry');
}

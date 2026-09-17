import {State} from '../state';
import {encodeMetadata,expiry,recordName,type MetadataStore,type Change} from './metadata';
interface Row {json:string;expiresAt?:number;}
/** Local/test implementation of the same atomic contract used by Firestore. */
export class SqliteMetadata implements MetadataStore {
  constructor(private state:State,private now=Date.now){}
  private decode<T>(row:Row|undefined):T|undefined {
    return row&&(row.expiresAt===undefined||row.expiresAt>this.now())?JSON.parse(row.json) as T:undefined;
  }
  async get<T>(kind:string,key:string):Promise<T|undefined>{recordName(kind,key);return this.decode<T>(this.state.get<Row>('cloud:'+kind,key));}
  async list<T>(kind:string,limit=1000):Promise<[string,T][]> {
    recordName(kind,'list');if(!Number.isSafeInteger(limit)||limit<1||limit>10_000)throw new Error('Invalid query limit');
    const result:[string,T][]=[];
    for(const [key,row] of this.state.all<Row>('cloud:'+kind)){const value=this.decode<T>(row);if(value!==undefined)result.push([key,value]);}
    if(result.length>limit)throw new Error('Metadata query limit exceeded');return result;
  }
  async atomic<T,R>(kind:string,key:string,change:(current:T|undefined)=>Change<T,R>):Promise<R>{
    recordName(kind,key);
    return this.state.atomic(()=>{
      const next=change(this.decode<T>(this.state.get<Row>('cloud:'+kind,key)));expiry(next.expiresAt);
      if(next.value===undefined)this.state.delete('cloud:'+kind,key);
      else this.state.put('cloud:'+kind,key,{json:encodeMetadata(next.value),...(next.expiresAt===undefined?{}:{expiresAt:next.expiresAt})});
      return next.result;
    });
  }
}

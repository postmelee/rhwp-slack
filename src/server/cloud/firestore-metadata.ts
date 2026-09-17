import {createHash} from 'node:crypto';
import {Firestore,Timestamp,type CollectionReference,type DocumentData} from '@google-cloud/firestore';
import {encodeMetadata,expiry,recordName,type Change,type MetadataStore} from './metadata';
/** Firestore transactions are the authority; no instance-local record cache. */
export class FirestoreMetadata implements MetadataStore {
  private root:string;
  constructor(private db:Firestore,environment:string,teamId:string,private now=Date.now){
    if(!/^[a-z][a-z0-9-]{0,39}$/.test(environment)||!/^T[A-Z0-9]+$/.test(teamId))throw new Error('Invalid Firestore namespace');
    this.root=`rhwp_namespaces/${environment}-${teamId}/kinds`;
  }
  private records(kind:string):CollectionReference {recordName(kind,'query');return this.db.collection(`${this.root}/${kind}/records`);}
  private ref(kind:string,key:string){recordName(kind,key);return this.records(kind).doc(createHash('sha256').update(key).digest('hex'));}
  private decode<T>(row:DocumentData|undefined,key:string):T|undefined {
    if(!row)return;
    if(row.key!==key||typeof row.json!=='string')throw new Error('Invalid stored metadata');
    if(row.expiresAt&&(!(row.expiresAt instanceof Timestamp)||row.expiresAt.toMillis()<=this.now()))return;
    return JSON.parse(row.json) as T;
  }
  async get<T>(kind:string,key:string):Promise<T|undefined>{return this.decode<T>((await this.ref(kind,key).get()).data(),key);}
  async list<T>(kind:string,limit=1000):Promise<[string,T][]> {
    if(!Number.isSafeInteger(limit)||limit<1||limit>10_000)throw new Error('Invalid query limit');
    const rows=await this.records(kind).limit(limit+1).get();
    if(rows.size>limit)throw new Error('Metadata query limit exceeded');
    const result:[string,T][]=[];
    for(const doc of rows.docs){const row=doc.data();const value=this.decode<T>(row,row.key);if(value!==undefined)result.push([row.key,value]);}
    return result;
  }
  async atomic<T,R>(kind:string,key:string,change:(current:T|undefined)=>Change<T,R>):Promise<R>{
    const ref=this.ref(kind,key);
    return this.db.runTransaction(async transaction=>{
      const row=await transaction.get(ref);const next=change(this.decode<T>(row.data(),key));expiry(next.expiresAt);
      if(next.value===undefined)transaction.delete(ref);
      else transaction.set(ref,{key,json:encodeMetadata(next.value),expiresAt:next.expiresAt===undefined?null:Timestamp.fromMillis(next.expiresAt)});
      return next.result;
    },{maxAttempts:5});
  }
}

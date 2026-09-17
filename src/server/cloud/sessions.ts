import {createHash,randomBytes} from 'node:crypto';
import type {Actor} from '../access';
import type {Session,SessionAccess} from '../sessions';
import {UserError} from '../errors';
import type {MetadataStore} from './metadata';
interface Grant {actor:Actor;cardId:string;epoch:number;until:number;}
interface StoredSession extends Session {epoch:number;}
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
const secret=()=>randomBytes(32).toString('base64url');
const expired=()=>new UserError('session_expired','편집 연결이 만료되었습니다. Slack 카드에서 다시 열어 주세요.');
/** Shared, hashed credentials. A cold start or another instance cannot lose the session. */
export class SharedSessions implements SessionAccess {
  constructor(private store:MetadataStore,private authorize:(cardId:string,actor:Actor)=>Promise<void>,private now=Date.now){}
  private async epoch(card:string):Promise<number>{return await this.store.get<number>('revocations',card)??0;}
  private validate(value:string):void{if(!/^[A-Za-z0-9_-]{43}$/.test(value))throw expired();}
  async issue(cardId:string,actor:Actor):Promise<string>{
    const value=secret(),epoch=await this.epoch(cardId),until=this.now()+60_000;
    await this.store.atomic<Grant,void>('tickets',digest(value),()=>({value:{actor:{...actor},cardId,epoch,until},expiresAt:until,result:undefined}));
    return value;
  }
  async exchange(input:string|Promise<string>):Promise<string>{
    const value=await input;this.validate(value);
    const grant=await this.store.atomic<Grant,Grant|undefined>('tickets',digest(value),current=>({result:current}));
    if(!grant||grant.until<=this.now()||grant.epoch!==await this.epoch(grant.cardId))throw expired();
    await this.authorize(grant.cardId,grant.actor);
    if(grant.until<=this.now()||grant.epoch!==await this.epoch(grant.cardId))throw expired();
    const bearer=secret(),createdAt=this.now(),id=digest(bearer);
    await this.store.atomic<StoredSession,void>('sessions',id,()=>({value:{id,actor:grant.actor,cardId:grant.cardId,epoch:grant.epoch,createdAt,lastUsed:createdAt},expiresAt:createdAt+60*60_000,result:undefined}));
    // Revocation during insertion must not mint a usable session.
    if(grant.epoch!==await this.epoch(grant.cardId)){
      await this.store.atomic('sessions',id,()=>({result:undefined}));throw expired();
    }
    return bearer;
  }
  private valid(s:StoredSession|undefined):s is StoredSession {
    return !!s&&this.now()-s.lastUsed<10*60_000&&this.now()-s.createdAt<60*60_000;
  }
  async require(bearer:string):Promise<Session>{
    this.validate(bearer);const id=digest(bearer),s=await this.store.get<StoredSession>('sessions',id);
    if(!this.valid(s)||s.epoch!==await this.epoch(s.cardId))throw expired();
    await this.authorize(s.cardId,s.actor);
    const current=await this.store.atomic<StoredSession,StoredSession|undefined>('sessions',id,record=>{
      if(!this.valid(record)||record.epoch!==s.epoch)return {result:undefined};
      const value={...record,lastUsed:this.now()};return {value,expiresAt:record.createdAt+60*60_000,result:value};
    });
    if(!current||current.epoch!==await this.epoch(current.cardId))throw expired();
    const {epoch:_,...session}=current;return session;
  }
  sweep():void {} // Logical expiry is checked on reads; physical cleanup is separate.
  clear():void {} // Stopping one instance must not revoke another instance's sessions.
  async invalidate(cardId:string):Promise<void>{
    await this.store.atomic<number,void>('revocations',cardId,current=>({value:(current??0)+1,result:undefined}));
  }
}

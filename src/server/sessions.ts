import {randomBytes,createHash} from 'node:crypto';
import type {Actor} from './access';
import {UserError} from './errors';
export interface Session {id:string; actor:Actor; cardId:string; createdAt:number; lastUsed:number;}
export interface SessionAccess {
  issue(cardId:string,actor:Actor):string|Promise<string>;
  exchange(value:string|Promise<string>):Promise<string>;
  require(bearer:string):Promise<Session>;
  invalidate(cardId:string):void|Promise<void>;
  sweep():void;
  clear():void;
}
interface Ticket {actor:Actor;cardId:string;until:number;}
const key=(value:string)=>createHash('sha256').update(value).digest('hex');
const token=()=>randomBytes(32).toString('base64url');
export class Sessions {
  private generation=0;
  private tickets=new Map<string,Ticket>(); private sessions=new Map<string,Session>();
  constructor(private now=Date.now,private authorize:(cardId:string,actor:Actor)=>Promise<void>){}
  sweep():void {
    for(const [id,t] of this.tickets)if(t.until<=this.now())this.tickets.delete(id);
    for(const [id,s] of this.sessions)if(this.expired(s))this.sessions.delete(id);
  }
  private expired(s:Session):boolean{return this.now()-s.lastUsed>=10*60_000||this.now()-s.createdAt>=60*60_000;}
  issue(cardId:string,actor:Actor):string {
    this.sweep();if(this.tickets.size>=1000)throw new UserError('busy','편집 요청이 많습니다. 잠시 후 다시 시도하세요.');
    const value=token();this.tickets.set(key(value),{cardId,actor:{...actor},until:this.now()+60_000});return value;
  }
  async exchange(input:string|Promise<string>):Promise<string> {
    const value=typeof input==='string'?input:await input;
    this.sweep();const ticket=this.tickets.get(key(value));this.tickets.delete(key(value));
    if(!ticket)throw new UserError('session_expired','문서 열기 링크가 만료되었습니다. Slack에서 다시 열어 주세요.');
    const generation=this.generation;
    await this.authorize(ticket.cardId,ticket.actor);
    if(generation!==this.generation||ticket.until<=this.now()||this.sessions.size>=1000)throw new UserError('session_expired','문서를 다시 열어 주세요.');
    const bearer=token();this.sessions.set(key(bearer),{id:key(bearer),actor:ticket.actor,cardId:ticket.cardId,createdAt:this.now(),lastUsed:this.now()});return bearer;
  }
  async require(bearer:string):Promise<Session> {
    this.sweep();const s=this.sessions.get(key(bearer));
    if(!s)throw new UserError('session_expired','편집 연결이 만료되었습니다. Slack에서 다시 열어 주세요.');
    await this.authorize(s.cardId,s.actor);
    if(this.expired(s)||!this.sessions.has(s.id))throw new UserError('session_expired','편집 연결이 만료되었습니다.');
    s.lastUsed=this.now();return s;
  }
  invalidate(cardId:string):void {
    this.generation++;
    for(const [id,t] of this.tickets)if(t.cardId===cardId)this.tickets.delete(id);
    for(const [id,s] of this.sessions)if(s.cardId===cardId)this.sessions.delete(id);
  }
  clear():void{this.generation++;this.tickets.clear();this.sessions.clear();}
}

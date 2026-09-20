import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import type {MetadataStore} from '../cloud/metadata';
import {InstallationError} from './store';
const opaque=/^[A-Za-z0-9_-]{43}$/;
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
interface State {bindingHash:string;purpose:'install'|'signin';until:number;context?:{teamId:string;cardId:string;generation:string;nonceHash:string};}
export class OAuthStates {
  constructor(private store:MetadataStore,private now=Date.now){}
  async issue(purpose:State['purpose'],context?:State['context']):Promise<{state:string;binding:string}>{
    const state=randomBytes(32).toString('base64url'),binding=randomBytes(32).toString('base64url'),until=this.now()+600_000;
    await this.store.atomic<State,void>('oauth_states',hash(state),()=>({value:{bindingHash:hash(binding),purpose,until,...(context?{context}: {})},expiresAt:until,result:undefined}));return {state,binding};
  }
  async consume(state:string,binding:string,purpose:State['purpose']):Promise<State>{
    if(!opaque.test(state)||!opaque.test(binding))throw new InstallationError();
    const value=await this.store.atomic<State,State|undefined>('oauth_states',hash(state),current=>{
      if(!current||current.until<=this.now()||current.purpose!==purpose||!timingSafeEqual(Buffer.from(current.bindingHash,'hex'),Buffer.from(hash(binding),'hex')))return {value:current,expiresAt:current?.until,result:undefined};
      return {value:undefined,result:current};
    });
    if(!value)throw new InstallationError();return value;
  }
}

import {createCipheriv,createDecipheriv,createHash,randomBytes,randomUUID} from 'node:crypto';
import {ID} from '../config';
import type {MetadataStore} from '../cloud/metadata';

export class InstallationError extends Error {constructor(){super('Slack 설치를 확인할 수 없습니다. 설치를 다시 시작해 주세요.');}}
function reject():never{throw new InstallationError();}
export interface InstallationInput {
  appId:string;teamId:string;installerUserId:string;botId:string;botUserId:string;
  workspaceHost:string;scopes:string[];botToken:string;
}
export interface Installation extends Omit<InstallationInput,'botToken'> {generation:string;installedAt:number;}
interface Sealed {keyId:string;iv:string;data:string;tag:string;}
interface Record extends Installation {status:'active'|'revoked';sealed?:Sealed;fingerprint?:string;}
const host=/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.slack\.com$/;
function valid(input:InstallationInput):void {
  if(!ID.app.test(input.appId)||!ID.team.test(input.teamId)||!ID.user.test(input.installerUserId)||!ID.user.test(input.botUserId)||!/^B[A-Z0-9]+$/.test(input.botId)||!host.test(input.workspaceHost)||!/^xoxb-[A-Za-z0-9-]+$/.test(input.botToken)||!input.scopes.length||input.scopes.some(s=>!/^[a-z_]+(?::[a-z_.]+)?$/.test(s)))reject();
}
/** Only authenticated ciphertext is persisted. This registry is separate from tenant document stores. */
export class Installations {
  private keys:ReadonlyMap<string,Buffer>;
  constructor(private store:MetadataStore,private appId:string,private keyId:string,keys:ReadonlyMap<string,Buffer>,private now=Date.now){
    if(!ID.app.test(appId)||!keys.has(keyId)||[...keys].some(([id,key])=>!(/^[a-z0-9-]{1,40}$/.test(id))||key.length!==32))reject();
    this.keys=new Map([...keys].map(([id,key])=>[id,Buffer.from(key)]));
  }
  private key(team:string):string{if(!ID.team.test(team))reject();return this.appId+':'+team;}
  private aad(team:string,generation:string,keyId:string):Buffer{return Buffer.from(JSON.stringify(['rhwp-install-v1',this.appId,team,generation,keyId]));}
  async activate(input:InstallationInput):Promise<Installation>{
    valid(input);if(input.appId!==this.appId)reject();
    const {botToken,...publicData}=input,generation=randomUUID(),installedAt=this.now();
    const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',this.keys.get(this.keyId)!,iv);
    cipher.setAAD(this.aad(input.teamId,generation,this.keyId));
    const data=Buffer.concat([cipher.update(botToken,'utf8'),cipher.final()]);
    const value:Record={...publicData,scopes:[...new Set(input.scopes)].sort(),generation,installedAt,status:'active',fingerprint:createHash('sha256').update(botToken).digest('hex'),sealed:{keyId:this.keyId,iv:iv.toString('base64url'),data:data.toString('base64url'),tag:cipher.getAuthTag().toString('base64url')}};
    await this.store.atomic<Record,void>('installations',this.key(input.teamId),()=>({value,result:undefined}));
    return this.public(value);
  }
  private public(record:Record):Installation{const {sealed:_,fingerprint:__,status:___,...value}=record;return value;}
  async require(team:string,generation?:string):Promise<Installation&{botToken:string}>{
    const value=await this.store.get<Record>('installations',this.key(team));
    if(!value||value.status!=='active'||value.appId!==this.appId||value.teamId!==team||!value.sealed||(generation!==undefined&&value.generation!==generation))reject();
    try{
      const s=value.sealed,key=this.keys.get(s.keyId);if(!key)reject();
      const iv=Buffer.from(s.iv,'base64url'),tag=Buffer.from(s.tag,'base64url');if(iv.length!==12||tag.length!==16)reject();
      const decipher=createDecipheriv('aes-256-gcm',key,iv);decipher.setAAD(this.aad(team,value.generation,s.keyId));decipher.setAuthTag(tag);
      const botToken=Buffer.concat([decipher.update(Buffer.from(s.data,'base64url')),decipher.final()]).toString('utf8');
      const result={...this.public(value),botToken};valid(result);return result;
    }catch{throw new InstallationError();}
  }
  /** A delayed old-generation callback must not deactivate a newer installation. */
  async revoke(team:string,generation:string):Promise<boolean>{
    return this.store.atomic<Record,boolean>('installations',this.key(team),current=>{
      if(!current||current.generation!==generation||current.status!=='active')return {value:current,result:false};
      const {sealed:_,fingerprint:__,...publicData}=current;
      return {value:{...publicData,status:'revoked'},result:true};
    });
  }
}

import {createHash,randomBytes} from 'node:crypto';
import {createRemoteJWKSet,jwtVerify,type JWTVerifyGetKey} from 'jose';
import {ID} from '../config';
import {object} from '../errors';
import {readBounded} from '../slack-api';
import type {Card} from '../documents';
import {InstallationError} from './store';
import type {OAuthConfig} from './oauth';
import type {OAuthStates} from './state';
import type {Tenants} from './tenants';
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Separate OpenID user authentication. Neither installer identity nor a shared document URL is proof of access. */
export class EditorSignIn {
  readonly callback:string;
  constructor(private config:OAuthConfig&{editorOrigin:string},private states:OAuthStates,private tenants:Tenants,private fetcher:typeof fetch=fetch,private keys:JWTVerifyGetKey=createRemoteJWKSet(new URL('https://slack.com/openid/connect/keys'),{timeoutDuration:10_000,cacheMaxAge:600_000})){
    for(const origin of [config.origin,config.editorOrigin]){const u=new URL(origin);if(u.protocol!=='https:'||u.origin!==origin)throw new InstallationError();}
    this.callback=config.origin+'/browser/callback';
  }
  async start(teamId:string,cardId:string,reconnect?:string):Promise<{url:string;binding:string}>{
    if(!ID.team.test(teamId)||!uuid.test(cardId)||(reconnect!==undefined&&!/^[A-Za-z0-9_-]{43}$/.test(reconnect)))throw new InstallationError();
    const tenant=await this.tenants.resolve(teamId),nonce=randomBytes(32).toString('base64url');
    const {state,binding}=await this.states.issue('signin',{teamId,cardId,generation:tenant.installation.generation,nonceHash:hash(nonce),...(reconnect?{reconnect}:{})});
    const u=new URL('https://slack.com/openid/connect/authorize');u.search=new URLSearchParams({response_type:'code',response_mode:'form_post',scope:'openid profile',client_id:this.config.clientId,redirect_uri:this.callback,state,nonce,team:teamId}).toString();
    return {url:u.href,binding};
  }
  async finish(input:{state:string;binding:string;code?:string;error?:string}):Promise<string|undefined>{
    const state=await this.states.consume(input.state,input.binding,'signin');
    if(input.error==='access_denied')return;
    if(input.error||!input.code||input.code.length>2048||!state.context)throw new InstallationError();
    try{
      const response=await this.fetcher('https://slack.com/api/openid.connect.token',{method:'POST',redirect:'error',signal:AbortSignal.timeout(15_000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:this.config.clientId,client_secret:this.config.clientSecret,grant_type:'authorization_code',redirect_uri:this.callback,code:input.code})});
      if(!response.ok)throw new InstallationError();
      const data=object(JSON.parse((await readBounded(response,64*1024)).toString()));if(data.ok!==true||typeof data.id_token!=='string'||data.id_token.length>16384)throw new InstallationError();
      const {payload}=await jwtVerify(data.id_token,this.keys,{algorithms:['RS256'],issuer:'https://slack.com',audience:this.config.clientId,requiredClaims:['exp','iat','sub','nonce'],maxTokenAge:600});
      const user=payload['https://slack.com/user_id'],team=payload['https://slack.com/team_id'];
      if(typeof user!=='string'||!ID.user.test(user)||payload.sub!==user||team!==state.context.teamId||typeof payload.nonce!=='string'||hash(payload.nonce)!==state.context.nonceHash||(Array.isArray(payload.aud)&&payload.aud.length>1&&payload.azp!==this.config.clientId))throw new InstallationError();
      const tenant=await this.tenants.resolve(state.context.teamId,state.context.generation);
      const card=await tenant.documents.store.get<Pick<Card,'id'|'actor'>>('cards',state.context.cardId);if(!card)throw new InstallationError();
      const actor={teamId:state.context.teamId,userId:user,channelId:card.actor.channelId};
      await tenant.documents.authorize(card.id,actor);
      const ticket=await tenant.documents.sessions.issue(card.id,actor);
      return this.config.editorOrigin+'/editor/#'+new URLSearchParams({ticket,workspace:actor.teamId,...(state.context.reconnect?{reconnect:state.context.reconnect}:{})}).toString();
    }catch{throw new InstallationError();}
  }
}

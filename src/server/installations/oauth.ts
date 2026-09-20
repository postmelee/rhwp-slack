import {ID} from '../config';
import {readBounded} from '../slack-api';
import {Installations,InstallationError,type Installation} from './store';
import {OAuthStates} from './state';
const scopes=['commands','chat:write','files:read','files:write','channels:read','groups:read','app_mentions:read','reactions:write'];
function object(v:unknown):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v))throw new InstallationError();return v as Record<string,unknown>;}
export interface OAuthConfig {appId:string;clientId:string;clientSecret:string;origin:string;}
/** Bot installation only. Sign in with Slack must use a separate scope/identity flow. */
export class InstallOAuth {
  readonly callback:string;
  constructor(private config:OAuthConfig,private states:OAuthStates,private installations:Installations,private fetcher:typeof fetch=fetch){
    const u=new URL(config.origin);
    if(!ID.app.test(config.appId)||!/^\d+\.\d+$/.test(config.clientId)||!config.clientSecret||u.protocol!=='https:'||u.origin!==config.origin||u.username||u.password)throw new InstallationError();
    this.callback=u.origin+'/oauth/callback';
  }
  async start():Promise<{url:string;binding:string}>{
    const {state,binding}=await this.states.issue('install');
    const u=new URL('https://slack.com/oauth/v2/authorize');u.search=new URLSearchParams({client_id:this.config.clientId,scope:scopes.join(','),redirect_uri:this.callback,state}).toString();return {url:u.href,binding};
  }
  private async request(method:string,body:URLSearchParams,token?:string):Promise<Record<string,unknown>>{
    try{
      const response=await this.fetcher('https://slack.com/api/'+method,{method:'POST',redirect:'error',signal:AbortSignal.timeout(15_000),headers:{'Content-Type':'application/x-www-form-urlencoded',...(token?{Authorization:'Bearer '+token}:{})},body});
      if(!response.ok)throw new InstallationError();const data=object(JSON.parse((await readBounded(response,64*1024)).toString()));if(data.ok!==true)throw new InstallationError();return data;
    }catch{throw new InstallationError();}
  }
  async finish(input:{state:string;binding:string;code?:string;error?:string}):Promise<Installation|undefined>{
    await this.states.consume(input.state,input.binding,'install');
    if(input.error){if(input.error==='access_denied')return;throw new InstallationError();}
    if(!input.code||input.code.length>2048||/[\s\x00-\x1f]/.test(input.code))throw new InstallationError();
    const data=await this.request('oauth.v2.access',new URLSearchParams({client_id:this.config.clientId,client_secret:this.config.clientSecret,code:input.code,redirect_uri:this.callback}));
    const team=object(data.team),user=object(data.authed_user);
    if(data.app_id!==this.config.appId||data.is_enterprise_install!==false||data.token_type!=='bot'||typeof data.access_token!=='string'||!/^xoxb-[A-Za-z0-9-]+$/.test(data.access_token)||data.expires_in!==undefined||data.refresh_token!==undefined||typeof team.id!=='string'||!ID.team.test(team.id)||typeof user.id!=='string'||!ID.user.test(user.id)||typeof data.bot_user_id!=='string'||!ID.user.test(data.bot_user_id)||typeof data.scope!=='string')throw new InstallationError();
    const granted=data.scope.split(',');if(scopes.some(s=>!granted.includes(s)))throw new InstallationError();
    const identity=await this.request('auth.test',new URLSearchParams(),data.access_token);
    if(identity.team_id!==team.id||identity.user_id!==data.bot_user_id||typeof identity.bot_id!=='string'||!/^B[A-Z0-9]+$/.test(identity.bot_id)||typeof identity.url!=='string')throw new InstallationError();
    let u:URL;try{u=new URL(identity.url);}catch{throw new InstallationError();}
    if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash||u.port)throw new InstallationError();
    return this.installations.activate({appId:this.config.appId,teamId:team.id,installerUserId:user.id,botUserId:data.bot_user_id,botId:identity.bot_id,workspaceHost:u.hostname,scopes:granted,botToken:data.access_token});
  }
}

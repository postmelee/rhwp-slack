import {object} from '../errors';
import {readBounded} from '../slack-api';
import {Installations,InstallationError} from './store';
/** Called only for a signature-verified lifecycle event. Slack gives user IDs, not token strings. */
export function installationLifecycle(vault:Installations,fetcher:typeof fetch=fetch){
  return async(team:string,body:Record<string,unknown>):Promise<void>=>{
    let current;try{current=await vault.require(team);}catch(error){if(error instanceof InstallationError)return;throw error;}
    const event=object(body.event),tokens=event.tokens?object(event.tokens):{};
    if(event.type==='tokens_revoked'&&(!Array.isArray(tokens.bot)||!tokens.bot.includes(current.botUserId)))return;
    // A delayed uninstall/revoke from an older install must not invalidate a newly valid token.
    const response=await fetcher('https://slack.com/api/auth.test',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10_000),headers:{Authorization:'Bearer '+current.botToken}});
    if(!response.ok)throw new Error('Installation verification unavailable');
    const data=object(JSON.parse((await readBounded(response,64*1024)).toString()));
    if(data.ok===true){if(data.team_id!==team||data.user_id!==current.botUserId)throw new Error('Installation identity mismatch');return;}
    if(!['token_revoked','invalid_auth','account_inactive'].includes(String(data.error)))throw new Error('Installation verification unavailable');
    await vault.revoke(team,current.generation);
  };
}

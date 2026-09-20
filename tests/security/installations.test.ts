import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {State} from '../../src/server/state';
import {SqliteMetadata} from '../../src/server/cloud/sqlite-metadata';
import {Installations,InstallationError,type InstallationInput} from '../../src/server/installations/store';
import {OAuthStates} from '../../src/server/installations/state';
import {InstallOAuth} from '../../src/server/installations/oauth';
const scopes=['commands','chat:write','files:read','files:write','channels:read','groups:read','app_mentions:read','reactions:write'];
const input:InstallationInput={appId:'ATEST',teamId:'TONE',installerUserId:'UINSTALLER',botId:'BBOT',botUserId:'UBOT',workspaceHost:'one.slack.com',scopes,botToken:'xoxb-synthetic-private'};
function fixture(){
  const dir=mkdtempSync(join(tmpdir(),'rhwp-install-')),state=new State(join(dir,'metadata.sqlite'),'TREGISTRY'),store=new SqliteMetadata(state);
  let now=Date.now();const clock=()=>now,keys=new Map([['k1',Buffer.alloc(32,17)]]),vault=new Installations(store,'ATEST','k1',keys,clock),states=new OAuthStates(store,clock);
  return {store,vault,states,keys,clock,advance(){now+=600_001;},close(){state.close();rmSync(dir,{recursive:true,force:true});}};
}
test('encrypted credentials survive a registry replacement and never enter plain metadata',async()=>{
  const f=fixture();try{
    const installed=await f.vault.activate(input);assert.equal('botToken' in installed,false);
    const encoded=JSON.stringify(await f.store.list('installations'));assert.equal(encoded.includes(input.botToken),false);assert.equal(encoded.includes('xoxb-'),false);
    assert.equal((await new Installations(f.store,'ATEST','k1',f.keys,f.clock).require('TONE',installed.generation)).botToken,input.botToken);
    await assert.rejects(f.store.atomic('bad','raw',()=>({value:{botToken:input.botToken},result:undefined})),/credentials|Document/i);
  }finally{f.close();}
});
test('ciphertext cannot move between workspaces, generations, or keys',async()=>{
  const f=fixture();try{
    const a=await f.vault.activate(input);await f.vault.activate({...input,teamId:'TTWO'});
    const original=await f.store.get<any>('installations','ATEST:TONE');
    await f.store.atomic<any,void>('installations','ATEST:TTWO',current=>({value:{...current,sealed:original.sealed},result:undefined}));
    await assert.rejects(f.vault.require('TTWO'),InstallationError);
    await assert.rejects(new Installations(f.store,'ATEST','k1',new Map([['k1',Buffer.alloc(32,1)]])).require('TONE'),InstallationError);
    await f.store.atomic<any,void>('installations','ATEST:TONE',current=>({value:{...current,generation:'different'},result:undefined}));
    await assert.rejects(f.vault.require('TONE'),InstallationError);assert.ok(a.generation);
  }finally{f.close();}
});
test('reinstall changes generation, stale revoke cannot revoke new install, current revoke removes ciphertext',async()=>{
  const f=fixture();try{
    const a=await f.vault.activate(input),b=await f.vault.activate({...input,botToken:'xoxb-new-private'});
    await assert.rejects(f.vault.require('TONE',a.generation),InstallationError);assert.equal(await f.vault.revoke('TONE',a.generation),false);
    assert.equal((await f.vault.require('TONE',b.generation)).botToken,'xoxb-new-private');assert.equal(await f.vault.revoke('TONE',b.generation),true);
    await assert.rejects(f.vault.require('TONE'),InstallationError);assert.equal(JSON.stringify(await f.store.list('installations')).includes('sealed'),false);
  }finally{f.close();}
});
test('state is browser-bound, purpose-bound, expiring and single-use under concurrent callbacks',async()=>{
  const f=fixture();try{
    const a=await f.states.issue('install'),b=await f.states.issue('signin');
    await assert.rejects(f.states.consume(a.state,b.binding,'install'),InstallationError);
    await assert.rejects(f.states.consume(a.state,a.binding,'signin'),InstallationError);
    const result=await Promise.allSettled([f.states.consume(a.state,a.binding,'install'),f.states.consume(a.state,a.binding,'install')]);assert.equal(result.filter(r=>r.status==='fulfilled').length,1);
    f.advance();await assert.rejects(f.states.consume(b.state,b.binding,'signin'),InstallationError);
    const stored=JSON.stringify(await f.store.list('oauth_states'));assert.equal(stored.includes(b.binding),false);assert.equal(stored.includes(b.state),false);
  }finally{f.close();}
});
function oauth(f:ReturnType<typeof fixture>,override:Record<string,unknown>={},identityOverride:Record<string,unknown>={}){
  const calls:{url:string;body:URLSearchParams;headers:Headers}[]=[];
  const service=new InstallOAuth({appId:'ATEST',clientId:'123.456',clientSecret:'synthetic-secret',origin:'https://beta.example.com'},f.states,f.vault,async(url,init)=>{
    calls.push({url:String(url),body:new URLSearchParams(String(init?.body)),headers:new Headers(init?.headers)});
    return Response.json(String(url).endsWith('auth.test')?{ok:true,team_id:'TONE',user_id:'UBOT',bot_id:'BBOT',url:'https://one.slack.com/',...identityOverride}:{ok:true,app_id:'ATEST',is_enterprise_install:false,token_type:'bot',access_token:input.botToken,team:{id:'TONE'},authed_user:{id:'UINSTALLER'},bot_user_id:'UBOT',scope:scopes.join(','),...override});
  });return {service,calls};
}
test('OAuth verifies actual bot identity and persists installation with exact configured redirect',async()=>{
  const f=fixture();try{
    const {service,calls}=oauth(f),start=await service.start(),u=new URL(start.url),state=u.searchParams.get('state')!;
    assert.equal(u.origin,'https://slack.com');assert.equal(u.searchParams.get('user_scope'),null);
    const installed=await service.finish({state,binding:start.binding,code:'synthetic-code'});assert.equal(installed?.teamId,'TONE');assert.equal(calls.length,2);
    assert.equal(calls[0].body.get('redirect_uri'),u.searchParams.get('redirect_uri'));assert.equal(calls[1].headers.get('Authorization'),'Bearer '+input.botToken);
    await assert.rejects(service.finish({state,binding:start.binding,code:'synthetic-code'}),InstallationError);assert.equal(calls.length,2);
  }finally{f.close();}
});
test('OAuth cancellation consumes state without token exchange',async()=>{
  const f=fixture();try{
    const {service,calls}=oauth(f),start=await service.start(),state=new URL(start.url).searchParams.get('state')!;
    assert.equal(await service.finish({state,binding:start.binding,error:'access_denied'}),undefined);assert.equal(calls.length,0);
    await assert.rejects(service.finish({state,binding:start.binding,code:'later'}),InstallationError);
  }finally{f.close();}
});
test('wrong app, workspace, scope, enterprise, rotation and identity responses cannot install',async()=>{
  for(const [change,identity] of [[{app_id:'AOTHER'},{}],[{scope:'commands'},{}],[{is_enterprise_install:true},{}],[{expires_in:43200,refresh_token:'synthetic'},{}],[{}, {team_id:'TOTHER'}],[{}, {user_id:'UOTHER'}],[{}, {url:'https://evil.example.com/'}],[{}, {url:'https://one.slack.com/private'}]] as [Record<string,unknown>,Record<string,unknown>][]){
    const f=fixture();try{
      const {service}=oauth(f,change,identity),start=await service.start();await assert.rejects(service.finish({state:new URL(start.url).searchParams.get('state')!,binding:start.binding,code:'synthetic'}),InstallationError);
      assert.deepEqual(await f.store.list('installations'),[]);
    }finally{f.close();}
  }
});

test('installation HTTP routes use secure browser binding, reject duplicate callback fields and redact errors',async()=>{
  const {installationRoutes}=await import('../../src/server/installations/routes');
  const f=fixture();try{
    const {service,calls}=oauth(f),route=installationRoutes(service);
    const send=async(url:string,cookie='')=>{
      const headers=new Map<string,string>();let status=0,body='';
      const res={setHeader(k:string,v:string){headers.set(k.toLowerCase(),v);},writeHead(code:number,h?:Record<string,string>){status=code;for(const [k,v] of Object.entries(h??{}))headers.set(k.toLowerCase(),v);return this;},end(value?:string){body=value??'';return this;}};
      await route({url,method:'GET',headers:{cookie}} as any,res as any,()=>assert.fail('unexpected route'));
      return {headers,status,body};
    };
    const start=await send('/install'),location=start.headers.get('location')!,cookie=start.headers.get('set-cookie')!,state=new URL(location).searchParams.get('state')!;
    assert.equal(start.status,302);assert.equal(new URL(location).origin,"https://slack.com");assert.equal(new URL(location).pathname,"/oauth/v2/authorize");for(const attr of ['Secure','HttpOnly','SameSite=Lax','Path=/'])assert.ok(cookie.includes(attr));
    const forged=await send('/oauth/callback?state='+state+'&code=secret');assert.equal(forged.status,400);assert.equal(calls.length,0);assert.equal(forged.body.includes('secret'),false);
    const duplicate=await send('/oauth/callback?state='+state+'&state=bad&code=secret',cookie.split(';')[0]);assert.equal(duplicate.status,400);assert.equal(calls.length,0);
    const success=await send('/oauth/callback?state='+state+'&code=synthetic',cookie.split(';')[0]);assert.equal(success.status,200);assert.ok(success.headers.get('set-cookie')?.includes('Max-Age=0'));assert.equal(success.headers.get('cache-control'),'no-store');assert.equal(success.body.includes(input.botToken),false);
  }finally{f.close();}
});

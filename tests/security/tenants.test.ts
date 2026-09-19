import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {State} from '../../src/server/state';
import {SqliteMetadata} from '../../src/server/cloud/sqlite-metadata';
import {Installations,type InstallationInput} from '../../src/server/installations/store';
import {Tenants} from '../../src/server/installations/tenants';
import {distributedReceiver} from '../../src/server/installations/receiver';
import {config,signed,command,FakeApi} from '../slack/support';
const input:InstallationInput={appId:'ATEST',teamId:'TONE',installerUserId:'UTEST',botId:'BBOT',botUserId:'UBOT',workspaceHost:'one.slack.com',scopes:['commands'],botToken:'xoxb-synthetic-one'};
async function fixture(){
  const dir=mkdtempSync(join(tmpdir(),'rhwp-tenants-')),states:State[]=[];
  const create=(file:string)=>{const state=new State(join(dir,file+'.sqlite'),'TREGISTRY');states.push(state);return new SqliteMetadata(state);};
  const registry=create('registry'),vault=new Installations(registry,'ATEST','k1',new Map([['k1',Buffer.alloc(32,19)]])),stores=new Map<string,SqliteMetadata>(),apis=new Map<string,FakeApi>(),published:string[]=[];
  const tenants=new Tenants({config:{...config,publicOrigin:'https://beta.example.com'},installations:vault,registry,publisher:{async publish(id){published.push(id);}},store:install=>{
    const id=install.teamId+'-'+install.generation;let s=stores.get(id);if(!s){s=create(id);stores.set(id,s);}return s;
  },api:token=>{let api=apis.get(token);if(!api){api=new FakeApi();apis.set(token,api);}return api;}});
  const a=await vault.activate(input),b=await vault.activate({...input,teamId:'TTWO',workspaceHost:'two.slack.com',botToken:'xoxb-synthetic-two'});
  return {registry,vault,tenants,apis,published,a,b,close(){for(const s of states)s.close();rmSync(dir,{recursive:true,force:true});}};
}
test('same record keys stay isolated and selected tenant uses only its own token',async()=>{
  const f=await fixture();try{
    const a=await f.tenants.resolve('TONE'),b=await f.tenants.resolve('TTWO');
    await a.documents.store.atomic('settings','same',()=>({value:'one',result:undefined}));await b.documents.store.atomic('settings','same',()=>({value:'two',result:undefined}));
    assert.equal(await a.documents.store.get('settings','same'),'one');assert.equal(await b.documents.store.get('settings','same'),'two');
    await a.documents.api.call('auth.test',{});await b.documents.api.call('auth.test',{});
    assert.equal(f.apis.get('xoxb-synthetic-one')!.calls.length,1);assert.equal(f.apis.get('xoxb-synthetic-two')!.calls.length,1);
    await assert.rejects(a.documents.accessConfig({teamId:'TTWO',userId:'UTEST',channelId:'CTEST'}));
    assert.equal(await a.documents.mode('CTEST'),'off'); // Installer must enable channels explicitly.
  }finally{f.close();}
});
test('reinstall and revoke invalidate retained clients, stores and generation-routed queued work',async()=>{
  const f=await fixture();try{
    const a=await f.tenants.resolve('TONE');
    await a.tasks.enqueue('same',{teamId:'TONE',cardId:'event-one',kind:'event'});const old=f.published.at(-1)!;
    assert.equal((await f.registry.get<any>('deliveries',old)).generation,f.a.generation);
    await f.vault.activate({...input,botToken:'xoxb-new-one'});
    await assert.rejects(a.documents.api.call('auth.test',{}));await assert.rejects(a.documents.store.get('cards','same'));
    const next=await f.tenants.resolve('TONE');await next.tasks.enqueue('same',{teamId:'TONE',cardId:'event-one',kind:'event'});
    assert.notEqual(f.published.at(-1),old);await f.tenants.execute(old); // Acknowledge old generation, no API calls.
    assert.equal(f.apis.get('xoxb-synthetic-one')!.calls.length,0);
    await f.vault.revoke('TONE',next.installation.generation);await assert.rejects(f.tenants.resolve('TONE'));
    await f.tenants.execute(f.published.at(-1)!);assert.equal(f.apis.get('xoxb-new-one')!.calls.length,0);
  }finally{f.close();}
});
test('delivery registry cannot redirect a physical id to another workspace',async()=>{
  const f=await fixture();try{
    const a=await f.tenants.resolve('TONE');await a.tasks.enqueue('same',{teamId:'TONE',cardId:'event',kind:'event'});const id=f.published.at(-1)!;
    await f.registry.atomic<any,void>('deliveries',id,current=>({value:{...current,teamId:'TTWO',generation:f.b.generation},result:undefined}));
    await assert.rejects(f.tenants.execute(id),/Unknown delivery/);
  }finally{f.close();}
});
test('Slack signature is verified before installation lookup; cross-app and conflicting team envelopes are ignored',async()=>{
  const f=await fixture();let lookups=0;const resolve=f.tenants.resolve.bind(f.tenants);f.tenants.resolve=async(...args)=>{lookups++;return resolve(...args);};
  const runtime=distributedReceiver({appId:'ATEST',signingSecret:config.signingSecret,tenants:f.tenants}),server=await runtime.receiver.start({host:'127.0.0.1',port:0}),address=server.address();assert.ok(address&&typeof address!=='string');const origin=`http://127.0.0.1:${address.port}`;
  try{
    assert.equal((await signed(origin,new URLSearchParams(command({team_id:'TONE',text:'help'})),{tamper:true})).status,401);assert.equal(lookups,0);
    assert.equal((await signed(origin,new URLSearchParams(command({team_id:'TONE',api_app_id:'AOTHER',text:'help'})))).status,200);assert.equal(lookups,0);
    assert.equal((await signed(origin,{type:'event_callback',api_app_id:'ATEST',team_id:'TONE',team:{id:'TTWO'},event:{type:'app_home_opened'}},{json:true})).status,200);assert.equal(lookups,0);
    assert.equal((await signed(origin,new URLSearchParams(command({team_id:'TONE',text:'help'})))).status,200);assert.equal(lookups,1);
    assert.equal((await signed(origin,new URLSearchParams(command({team_id:'TTWO',text:'help'})))).status,200);assert.equal(lookups,2);
  }finally{await runtime.receiver.stop();f.close();}
});

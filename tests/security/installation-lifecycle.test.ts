import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {State} from '../../src/server/state';
import {SqliteMetadata} from '../../src/server/cloud/sqlite-metadata';
import {Installations} from '../../src/server/installations/store';
import {installationLifecycle} from '../../src/server/installations/lifecycle';
import {loadDistributedConfig} from '../../src/server/installations/config';
test('lifecycle confirms current token before revocation; late old events and transient Slack failures preserve new installation',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'rhwp-lifecycle-')),state=new State(join(dir,'db.sqlite'),'TTEST'),vault=new Installations(new SqliteMetadata(state),'ATEST','k1',new Map([['k1',Buffer.alloc(32,1)]]));
  const input={appId:'ATEST',teamId:'TTEST',installerUserId:'UTEST',botId:'BBOT',botUserId:'UBOT',workspaceHost:'test.slack.com',scopes:['commands'],botToken:'xoxb-synthetic'};
  let reply:Record<string,unknown>={ok:true,team_id:'TTEST',user_id:'UBOT'},calls=0;
  const handle=installationLifecycle(vault,async()=>{calls++;return Response.json(reply);});
  try{
    const first=await vault.activate(input);
    await handle('TTEST',{event:{type:'tokens_revoked',tokens:{oauth:['UBOT'],bot:['UOTHER']}}});assert.equal(calls,0);
    await handle('TTEST',{event:{type:'app_uninstalled'}});assert.equal(await vault.active('TTEST',first.generation),true);
    reply={ok:false,error:'ratelimited'};await assert.rejects(handle('TTEST',{event:{type:'app_uninstalled'}}));assert.equal(await vault.active('TTEST',first.generation),true);
    reply={ok:false,error:'token_revoked'};await handle('TTEST',{event:{type:'tokens_revoked',tokens:{bot:['UBOT']}}});assert.equal(await vault.active('TTEST',first.generation),false);
    const second=await vault.activate({...input,botToken:'xoxb-new'});reply={ok:true,team_id:'TTEST',user_id:'UBOT'};await handle('TTEST',{event:{type:'app_uninstalled'}});assert.equal(await vault.active('TTEST',second.generation),true);
  }finally{state.close();rmSync(dir,{recursive:true,force:true});}
});
test('candidate configuration requires HTTPS and encryption keys but never an operator workspace bot token',()=>{
  const base={CLOUD_ROLE:'worker',SLACK_APP_ID:'ATEST',APP_ORIGIN:'https://api.example.com',EDITOR_ORIGIN:'https://studio.example.com',SLACK_SIGNING_SECRET:'a'.repeat(32),INSTALLATION_KEY_ID:'k1',INSTALLATION_KEYS_JSON:JSON.stringify({k1:Buffer.alloc(32,1).toString('base64')}),CLOUD_ENVIRONMENT:'beta'};
  assert.equal(loadDistributedConfig(base).oauth,undefined);
  assert.throws(()=>loadDistributedConfig({...base,CLOUD_ROLE:'ingress'}));
  assert.ok(loadDistributedConfig({...base,CLOUD_ROLE:'ingress',SLACK_CLIENT_ID:'123.456',SLACK_CLIENT_SECRET:'synthetic'}).oauth);
  for(const overrides of [{APP_ORIGIN:'http://api.example.com'},{EDITOR_ORIGIN:'https://studio.example.com/path'},{INSTALLATION_KEY_ID:'missing'},{INSTALLATION_KEYS_JSON:'{"k1":"short"}'},{PORT:'0'}])assert.throws(()=>loadDistributedConfig({...base,...overrides}));
});

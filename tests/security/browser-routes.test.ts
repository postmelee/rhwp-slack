import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,type IncomingMessage,type ServerResponse} from 'node:http';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {State} from '../../src/server/state';
import {SqliteMetadata} from '../../src/server/cloud/sqlite-metadata';
import {SharedSessions} from '../../src/server/cloud/sessions';
import {browserSignInRoutes,tenantEditorRoutes} from '../../src/server/installations/browser-routes';
import type {EditorSignIn} from '../../src/server/installations/signin';
import type {Tenants} from '../../src/server/installations/tenants';
async function serve(route:(req:IncomingMessage,res:ServerResponse,next:()=>void)=>Promise<void>){
  const server=createServer((req,res)=>{void route(req,res,()=>res.writeHead(404).end());});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();assert.ok(address&&typeof address!=='string');
  return {url:`http://127.0.0.1:${address.port}`,close:()=>new Promise<void>(resolve=>server.close(()=>resolve()))};
}
test('browser callback uses a cross-site POST cookie and rejects duplicate parameters and unsupported methods',async()=>{
  let calls=0;
  const signin:Pick<EditorSignIn,'callback'|'start'|'finish'>={callback:'https://api.example.com/browser/callback',async start(){return {binding:'b'.repeat(43),url:'https://slack.com/openid/connect/authorize'};},async finish(input){calls++;assert.equal(input.binding,'b'.repeat(43));assert.equal(input.state,'state');return 'https://studio.example.com/editor/#ticket=synthetic';}};
  const server=await serve(browserSignInRoutes(signin));try{
    const start=await fetch(server.url+'/browser/open?workspace=TONE&document=one',{redirect:'manual'});assert.equal(start.status,303);assert.match(start.headers.get('set-cookie')!,/Secure; HttpOnly; SameSite=None/);
    const headers={'Content-Type':'application/x-www-form-urlencoded',Cookie:'__Host-rhwp-signin-state='+'b'.repeat(43)};
    assert.equal((await fetch(server.url+'/browser/callback?state=state')).status,400);
    assert.equal((await fetch(server.url+'/browser/callback',{method:'POST',headers,body:'state=state&state=other&code=test'})).status,400);assert.equal(calls,0);
    const response=await fetch(server.url+'/browser/callback',{method:'POST',headers,body:'state=state&code=test',redirect:'manual'});assert.equal(response.status,303);assert.match(response.headers.get('set-cookie')!,/Max-Age=0/);assert.equal(calls,1);
  }finally{await server.close();}
});
test('workspace header cannot exchange or use another workspace credential; CORS does not bypass authentication',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'rhwp-browser-')),states:State[]=[],documents=new Map<string,any>();
  for(const team of ['TONE','TTWO']){
    const state=new State(join(dir,team+'.sqlite'),team);states.push(state);
    documents.set(team,{sessions:new SharedSessions(new SqliteMetadata(state),async(_card,actor)=>{assert.equal(actor.teamId,team);}),async authorize(){return {name:team+'.hwp'};}});
  }
  const tenants={async resolve(team:string){if(!documents.has(team))throw new Error('Unknown workspace');return {documents:documents.get(team)};}} as Tenants;
  const api='https://api.example.com',studio='https://studio.example.com',server=await serve(tenantEditorRoutes(tenants,api,studio));
  const headers=(team:string)=>({Origin:studio,'Content-Type':'application/json','X-Rhwp-Workspace':team});
  try{
    const ticket=await documents.get('TONE').sessions.issue('same-card',{teamId:'TONE',channelId:'CONE',userId:'UREADER'}),body=JSON.stringify({ticket});
    assert.equal((await fetch(server.url+'/api/editor/exchange',{method:'POST',headers:headers('TTWO'),body})).status,403);
    assert.equal((await fetch(server.url+'/api/editor/exchange',{method:'POST',headers:{...headers('TONE'),Origin:'https://evil.example.com'},body})).status,403);
    const exchange=await fetch(server.url+'/api/editor/exchange',{method:'POST',headers:headers('TONE'),body});assert.equal(exchange.status,200);const {token}=await exchange.json() as {token:string};
    assert.equal((await fetch(server.url+'/api/editor/document',{headers:{...headers('TTWO'),Authorization:'Bearer '+token}})).status,403);
    assert.equal((await fetch(server.url+'/api/editor/document',{headers:{...headers('TONE'),Authorization:'Bearer '+token}})).status,200);
    assert.equal((await fetch(server.url+'/api/editor/document',{headers:{Authorization:'Bearer '+token}})).status,403);
    const preflight=await fetch(server.url+'/api/editor/source',{method:'OPTIONS',headers:{Origin:studio,'Access-Control-Request-Method':'GET','Access-Control-Request-Headers':'authorization,x-rhwp-workspace'}});assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),studio);
    assert.equal((await fetch(server.url+'/api/editor/exchange',{method:'POST',headers:headers('TONE'),body})).status,403);
  }finally{await server.close();for(const state of states)state.close();rmSync(dir,{recursive:true,force:true});}
});

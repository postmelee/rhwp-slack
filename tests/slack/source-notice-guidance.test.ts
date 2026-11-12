import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {State} from '../../src/server/state';
import {SqliteMetadata} from '../../src/server/cloud/sqlite-metadata';
import {DurableTasks,type Work,type TerminalNotice} from '../../src/server/cloud/tasks';
import {CloudApplication} from '../../src/server/cloud/application';
import type {Card} from '../../src/server/documents';
import {HttpSlackApi,type Method} from '../../src/server/slack-api';
import {UserError} from '../../src/server/errors';
import {attachSlackDiagnostics} from '../../src/server/slack-diagnostics';
import {markSourceUnavailable,sourceFailureMessage} from '../../src/server/source-failure';
import {actor,config,FakeApi} from './support';

type StoredCard=Card&{pdfPreparedAt?:number;removed?:boolean};
function fixture(code:string,metadata?:Record<string,unknown>){
 const dir=mkdtempSync(join(tmpdir(),'rhwp-source-notice-')),state=new State(join(dir,'state.sqlite'),'TTEST'),store=new SqliteMetadata(state);
 const fake=new FakeApi(),calls:{method:Method;args:Record<string,string>}[]=[],notices:Record<string,unknown>[]=[];
 const api=new HttpSlackApi('xoxb-synthetic',async(url,init)=>{
  const u=new URL(String(url)),method=u.pathname.split('/').at(-1)! as Method,args=Object.fromEntries(init?.body?new URLSearchParams(String(init.body)):u.searchParams);
  calls.push({method,args});
  if(method==='files.info'){
   if(metadata){const response=fake.response(method,args);return Response.json({...response,file:{...(response.file as Record<string,unknown>),...metadata}});}
   return Response.json({ok:false,error:code,private:'private-file-name'});
  }
  return Response.json(fake.response(method,args));
 });
 const tasks=new DurableTasks(store,{async publish(){}},Date.now,60_000,()=>{},r=>notices.push(r));
 const app=new CloudApplication({...config,publicOrigin:'https://private.example.test',editorMode:'browser'},api,store,tasks,{noticeIdentity:{generation:'current-generation',botUserId:'UBOT',check:async()=>{}}});
 const cardId='synthetic-source-card';
 return {store,calls,notices,tasks,app,cardId,
  async seed(prepared=false){
   const id=await tasks.enqueue('source-notice-'+code,{teamId:'TTEST',cardId,kind:'preview'});
   const card:StoredCard={id:cardId,actor:{...actor},fileId:'FTEST',rootFileId:'FTEST',name:'private-file-name.hwpx',size:100,revision:0,createdAt:1,messageTs:'123.456',pdf:'failed',imageState:'failed',pdfUrl:'https://private.example.test/artifact',pdfFileId:'FOUTPUT',images:[{page:1,fileId:'FIMAGE'}],...(prepared?{pdfPreparedAt:1}:{}),recovery:{taskId:id,state:'failed',attempt:3,maxAttempts:3,errorCode:'slack_rejected'},noticeTarget:{fileId:'FTEST',cardId,teamId:'TTEST',channelId:'CTEST',messageTs:'123.456',generation:'current-generation',botUserId:'UBOT'}};
   await store.atomic('cards',cardId,()=>({value:card,result:undefined}));
   await store.atomic<Work,void>('tasks',id,current=>({value:{...current!,state:'failed',generation:3,terminalAt:Date.now(),failureCode:'slack_rejected'},result:undefined}));
   return id;
  },
  async patch(change:(card:StoredCard)=>StoredCard){await store.atomic<StoredCard,void>('cards',cardId,current=>({value:change(current!),result:undefined}));},
  run(id:string){return tasks.execute(id,(s,c)=>app.execute(s,c));},
  close(){state.close();rmSync(dir,{recursive:true,force:true});}};
}
function expected(code:string){const error=attachSlackDiagnostics(new UserError('slack_rejected','private'),200,code);markSourceUnavailable(error);return sourceFailureMessage(error)!;}

for(const code of ['file_deleted','file_not_found','not_visible','missing_scope','no_permission'])for(const prepared of [false,true])test(`source notice explains ${code}, prepared=${prepared}, without sharing artifacts`,async()=>{
 const f=fixture(code);try{
  const id=await f.seed(prepared);await f.run(id);
  const updates=f.calls.filter(c=>c.method==='chat.update');assert.equal(updates.length,1);
  const args=updates[0].args;assert.ok(args.text.includes(expected(code)));
  if(prepared)assert.match(args.text,/PDF는 생성됐지만/);else assert.match(args.text,/PDF·이미지 준비/);
  if(code==='file_not_found')assert.doesNotMatch(args.text,/삭제되었습니다|삭제된 상태|취소되었습니다/);
  assert.equal(args.file_ids,undefined);assert.equal(args.metadata,undefined);
  assert.equal(args.parse,'none');assert.equal(args.unfurl_links,'false');assert.equal(args.unfurl_media,'false');
  assert.deepEqual(JSON.parse(args.blocks),[{type:'section',text:{type:'plain_text',text:args.text}}]);
  assert.doesNotMatch(JSON.stringify(args),/FTEST|FOUTPUT|FIMAGE|private-file-name|https:\/\//);
  assert.equal(f.calls.some(c=>c.method==='files.getUploadURLExternal'||c.method==='files.completeUploadExternal'||c.method==='chat.postMessage'),false);
  assert.equal((await f.store.get<TerminalNotice>('terminal_notices',id))?.state,'sent');
  await f.run(id);assert.equal(f.calls.filter(c=>c.method==='chat.update').length,1);
 }finally{f.close();}
});

for(const scenario of ['missing-receipt','wrong-file','wrong-channel','wrong-team-receipt','old-generation','wrong-bot','newer-task','removed'] as const)test(`source notice cannot bypass ${scenario} guard`,async()=>{
 const f=fixture('file_not_found');try{
  const id=await f.seed();await f.patch(card=>{
   if(scenario==='missing-receipt')return {...card,noticeTarget:undefined};
   if(scenario==='newer-task')return {...card,recovery:{...card.recovery!,taskId:'newer'}};
   if(scenario==='removed')return {...card,removed:true};
   const target={...card.noticeTarget!};
   if(scenario==='wrong-file')target.fileId='FOTHER';
   if(scenario==='wrong-channel')target.channelId='COTHER';
   if(scenario==='wrong-team-receipt')target.teamId='TOTHER';
   if(scenario==='old-generation')target.generation='old-generation';
   if(scenario==='wrong-bot')target.botUserId='UOTHER';
   return {...card,noticeTarget:target};
  });
  await f.run(id);assert.equal(f.calls.some(c=>c.method.startsWith('chat.')),false);
  assert.equal((await f.store.get<TerminalNotice>('terminal_notices',id))?.state,'skipped');
 }finally{f.close();}
});

test('source notice rejects a foreign tenant card without sending or mutating it',async()=>{
 const f=fixture('file_deleted');try{
  const id=await f.seed();await f.patch(card=>({...card,actor:{...card.actor,teamId:'TOTHER'}}));
  const before=await f.store.get('cards',f.cardId);
  await assert.rejects(f.run(id),{code:'access_denied'});
  assert.equal(f.calls.some(c=>c.method.startsWith('chat.')),false);
  assert.deepEqual(await f.store.get('cards',f.cardId),before);
 }finally{f.close();}
});


for(const entry of [
 {reason:'unsupported_extension',metadata:{name:'private-file-name.txt'},message:/HWP 또는 HWPX 확장자/},
 {reason:'file_size_limit',metadata:{size:20*1024*1024+1},message:/파일 크기 한도\(20 MiB\)/},
 {reason:'missing_download_url',metadata:{url_private_download:null,url_private:null},message:/다운로드 주소를 제공하지/},
])test(`metadata notice explains ${entry.reason} without sharing artifacts`,async()=>{
 const f=fixture(entry.reason,entry.metadata);try{
  const id=await f.seed();await f.run(id);
  const updates=f.calls.filter(c=>c.method==='chat.update');assert.equal(updates.length,1);
  const args=updates[0].args;assert.match(args.text,entry.message);
  assert.equal(args.file_ids,undefined);assert.equal(args.metadata,undefined);
  assert.equal(args.parse,'none');assert.equal(args.unfurl_links,'false');assert.equal(args.unfurl_media,'false');
  assert.deepEqual(JSON.parse(args.blocks),[{type:'section',text:{type:'plain_text',text:args.text}}]);
  assert.doesNotMatch(JSON.stringify(args),/FTEST|FOUTPUT|FIMAGE|private-file-name|https:\/\//);
  assert.equal(f.calls.some(c=>c.method==='files.getUploadURLExternal'||c.method==='files.completeUploadExternal'||c.method==='chat.postMessage'),false);
  assert.equal((await f.store.get<TerminalNotice>('terminal_notices',id))?.state,'sent');
  await f.run(id);assert.equal(f.calls.filter(c=>c.method==='chat.update').length,1);
 }finally{f.close();}
});

test('metadata-specific notice still requires a current bot-owned receipt',async()=>{
 const f=fixture('file_size_limit',{size:20*1024*1024+1});try{
  const id=await f.seed();await f.patch(card=>({...card,noticeTarget:{...card.noticeTarget!,generation:'old-generation'}}));
  await f.run(id);assert.equal(f.calls.some(c=>c.method.startsWith('chat.')),false);
  assert.equal((await f.store.get<TerminalNotice>('terminal_notices',id))?.state,'skipped');
 }finally{f.close();}
});

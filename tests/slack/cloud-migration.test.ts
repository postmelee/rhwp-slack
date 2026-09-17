import test from 'node:test';
import assert from 'node:assert/strict';
import {State} from '../../src/server/state';
import {SqliteMetadata} from '../../src/server/cloud/sqlite-metadata';
import {migrateLegacy,prepareLegacy,type LegacyRow} from '../../src/server/cloud/migrate';
import {CloudApplication} from '../../src/server/cloud/application';
import {DurableTasks} from '../../src/server/cloud/tasks';
import {config,actor,bytes} from './support';
import {EditorApi} from './editor-support';
const cardId='00000000-0000-4000-a000-000000000001';
const key=JSON.stringify(['TTEST','CTEST','123.456','FTEST']);
const rows=():LegacyRow[]=>[
 {kind:'cards',key:cardId,value:{id:cardId,actor:{...actor,threadTs:'123.456'},name:'문서.hwp',size:bytes.length,fileId:'FTEST',rootFileId:'FTEST',revision:0,createdAt:1,origin:'https://old.example.com',messageTs:'123.457',parentTs:'123.456',pdf:'ready',imageState:'ready',attempts:[[1,{fileId:'FPNG',saved:true}]]}},
 {kind:'threads',key,value:cardId},{kind:'channels',key:'CTEST',value:{mode:'mention',updatedAt:1}},
 {kind:'settings',key:'initialized',value:true},
 {kind:'observed',key:'old',value:{team:'TTEST',channel:'CTEST',parent:'123.456',file:'FTEST',expires:1}},
];
test('metadata import dry-run writes nothing, preserves old card/thread identity and resumes idempotently',async()=>{
 const state=new State(':memory:','TTEST'),store=new SqliteMetadata(state);try{
  const dry=await migrateLegacy(store,rows(),'TTEST');assert.equal(dry.total,4);assert.equal((await store.list('cards')).length,0);
  const done=await migrateLegacy(store,rows(),'TTEST',true),again=await migrateLegacy(store,rows(),'TTEST',true);assert.equal(done.digest,again.digest);assert.equal(again.existing,4);
  const imported:any=await store.get('cards',cardId);assert.deepEqual(imported.attempts,{'1':{fileId:'FPNG',saved:true}});
  const app=new CloudApplication({...config,publicOrigin:'https://new.example.com'},new EditorApi(),store,new DurableTasks(store,{async publish(){assert.fail('Duplicate task');}}));
  assert.equal(await app.matchesUrl(cardId,'https://old.example.com/documents/'+cardId),true);
  assert.equal(await app.submit({...actor,threadTs:'123.456'},'FTEST','thread:'+key),cardId);
 }finally{state.close();}
});
test('migration refuses unfinished work, foreign cards, secrets and conflicting target state before inserts',async()=>{
 const state=new State(':memory:','TTEST'),store=new SqliteMetadata(state);try{
  assert.throws(()=>prepareLegacy([...rows(),{kind:'jobs',key:'x',value:{state:'queued'}}],'TTEST'),/pending/);
  const foreign=rows();(foreign[0].value as any).actor.teamId='TOTHER';assert.throws(()=>prepareLegacy(foreign,'TTEST'),/identity/);
  const secret=rows();(secret[0].value as any).botToken='xoxb-secret';assert.throws(()=>prepareLegacy(secret,'TTEST'));
  await store.atomic('channels','CTEST',()=>({value:{mode:'off'},result:undefined}));
  await assert.rejects(migrateLegacy(store,rows(),'TTEST',true),/conflicts/);assert.equal((await store.list('cards')).length,0);
 }finally{state.close();}
});

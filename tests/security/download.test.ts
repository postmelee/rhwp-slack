import test from 'node:test';
import assert from 'node:assert/strict';
import {downloadFile} from '../../src/server/download';
import {HttpSlackApi} from '../../src/server/slack-api';
import {bytes,actor,file,config} from '../slack/support';
const source={id:file.id,name:file.name,size:file.size,downloadUrl:file.url_private};
test('download uses authenticated allowlisted URL and validates actual source bytes',async()=>{
  let called=0;
  const result=await downloadFile(source,actor,config.botToken,undefined,async(url,init)=>{
    called++;assert.equal(String(url),source.downloadUrl);assert.equal(init?.redirect,'manual');
    assert.equal((init?.headers as Record<string,string>).Authorization,'Bearer '+config.botToken);
    return new Response(bytes);
  });
  assert.deepEqual(result,bytes);assert.equal(called,1);
});
test('foreign URLs and redirects never receive a Slack token',async()=>{
  for(const url of ['http://files.slack.com/files-pri/TTEST-FTEST/a','https://files.slack.com.evil.invalid/a','https://127.0.0.1/private','https://files.slack.com/files-pri/TOTHER-FTEST/a','https://files.slack.com:444/files-pri/TTEST-FTEST/a']){
    let called=false;
    await assert.rejects(downloadFile({...source,downloadUrl:url},actor,'secret',undefined,async()=>{called=true;return new Response(bytes);}));assert.equal(called,false);
  }
  let count=0;
  await assert.rejects(downloadFile(source,actor,'secret',undefined,async()=>{count++;return new Response(null,{status:302,headers:{Location:'https://attacker.invalid/steal'}});}));
  assert.equal(count,1);
});
test('redirect loops, lying length, invalid signature and size mismatch fail',async()=>{
  let count=0;
  await assert.rejects(downloadFile(source,actor,'secret',undefined,async()=>{count++;return new Response(null,{status:302,headers:{Location:source.downloadUrl}});}));assert.equal(count,3);
  await assert.rejects(downloadFile(source,actor,'secret',undefined,async()=>new Response('bad')));
  await assert.rejects(downloadFile({...source,size:3},actor,'secret',undefined,async()=>new Response('bad')),/평문 HWP5/);
  const large=new Uint8Array(20*1024*1024+1);
  await assert.rejects(downloadFile(source,actor,'secret',undefined,async()=>new Response(large,{headers:{'content-length':'1'}})),/크기 제한/);
  await assert.rejects(downloadFile(source,actor,'secret',undefined,async()=>new Response(null,{status:401})),/내려받지/);
});
test('download cancellation propagates to an in-flight transfer',async()=>{
  const controller=new AbortController();let started!:()=>void;const entered=new Promise<void>(r=>{started=r;});
  const pending=downloadFile(source,actor,'secret',controller.signal,async(_url,init)=>{
    started();return new Promise<Response>((_resolve,reject)=>init?.signal?.addEventListener('abort',()=>reject(init.signal!.reason),{once:true}));
  });
  await entered;controller.abort();await assert.rejects(pending);
});
test('Slack read retries honor Retry-After while writes are never automatically replayed',async()=>{
  let count=0;
  const api=new HttpSlackApi('synthetic',async(url)=>{
    assert.equal(String(url),'https://slack.com/api/files.info?file=FTEST');
    count++;return count===1?new Response(null,{status:429,headers:{'retry-after':'0.001'}}):Response.json({ok:true,file:{id:'FTEST'}});
  });
  assert.equal((await api.call('files.info',{file:'FTEST'})).ok,true);assert.equal(count,2);
  count=0;const writes=new HttpSlackApi('synthetic',async()=>{count++;return new Response(null,{status:503});});
  await assert.rejects(writes.call('views.open',{}));assert.equal(count,1);
  const failed=new HttpSlackApi('synthetic',async()=>Response.json({ok:false,error:'secret-raw-error'}));
  await assert.rejects(failed.call('files.info',{}),e=>e instanceof Error&&!e.message.includes('secret-raw-error'));
});

test('Slack query methods transmit file, channel and pagination without a JSON request body',async()=>{
  const api=new HttpSlackApi('synthetic',async(url,init)=>{
    const parsed=new URL(String(url));
    assert.equal(parsed.origin,'https://slack.com');assert.equal(init?.method,'GET');assert.equal(init?.body,undefined);
    assert.equal((init?.headers as Record<string,string>).Authorization,'Bearer synthetic');
    if(parsed.pathname.endsWith('files.info'))assert.equal(parsed.searchParams.get('file'),'FTEST');
    else assert.equal(parsed.searchParams.get('channel'),'CTEST');
    if(parsed.pathname.endsWith('conversations.members')){
      assert.equal(parsed.searchParams.get('cursor'),'next+/=');assert.equal(parsed.searchParams.get('limit'),'200');
    }
    return Response.json({ok:true});
  });
  await api.call('files.info',{file:'FTEST'});
  await api.call('conversations.info',{channel:'CTEST'});
  await api.call('conversations.members',{channel:'CTEST',cursor:'next+/=',limit:200});
});

test('Slack form writes preserve Korean text and nested file/block payloads',async()=>{
  const payload={channel_id:'CTEST',files:[{id:'FTEST',title:'한글 & 문서.hwp'}]};
  const api=new HttpSlackApi('synthetic',async(_url,init)=>{
    assert.equal(init?.method,'POST');
    assert.equal((init?.headers as Record<string,string>)['Content-Type'],'application/x-www-form-urlencoded');
    const form=new URLSearchParams(init?.body as string);
    assert.equal(form.get('channel_id'),payload.channel_id);assert.deepEqual(JSON.parse(form.get('files')!),payload.files);
    return Response.json({ok:true});
  });
  await api.call('files.completeUploadExternal',payload);
});

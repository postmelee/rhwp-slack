import {test,expect} from '@playwright/test';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {createSlackReceiver} from '../../src/server/receiver';
import {staticAssets} from '../../src/server/static-assets';
import {editorPolicy} from '../../src/server/editor-policy';
import {EditorApi} from '../slack/editor-support';
import {config,actor,bytes} from '../slack/support';
import {object} from '../../src/server/errors';

for(const pendingContextRequest of [false,true])test('separate static origin → API authorization → Studio edit → same-thread save, without token propagation'+(pendingContextRequest?' with pending context request':''),async({page})=>{
 const apiOrigin='http://127.0.0.1:4177',editorOrigin='http://127.0.0.1:4180',api=new EditorApi();
 const runtime=createSlackReceiver({...config,publicOrigin:apiOrigin,editorOrigin},api,{botId:'BBOT',botUserId:'UBOT'},{download:async()=>bytes,fetcher:async()=>new Response('ok')});
 const serve=staticAssets();const shell=readFileSync('dist/editor/index.html','utf8').replace('<meta name="rhwp-api-origin" content="">',`<meta name="rhwp-api-origin" content="${apiOrigin}">`);
 let pendingRequest=false,pendingRequestClosed=false;
 const frontend=createServer((req,res)=>{res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',editorPolicy(apiOrigin));res.setHeader('Referrer-Policy','no-referrer');
   const path=new URL(req.url!,editorOrigin).pathname;
   // A second page holds a connection owned by the same test context.
   // This regression checks ownership, not the original CI socket type.
   if(pendingContextRequest&&path==='/teardown-probe'){pendingRequest=true;res.once('close',()=>{pendingRequestClosed=true;});res.writeHead(200,{'Content-Type':'text/html'});res.write('<!doctype html><title>Pending context request</title><p>Waiting for context teardown</p>');return;}
   if(path==='/editor/'){res.setHeader('Content-Type','text/html');res.end(shell);return;}
   void serve(req,res,path).catch(()=>res.writeHead(500).end());
 });
 await runtime.receiver.start({host:'127.0.0.1',port:4177});await new Promise<void>(r=>frontend.listen(4180,'127.0.0.1',r));
 const failures:string[]=[];page.on('pageerror',e=>failures.push(e.message));const staticRequests:Promise<void>[]=[];
 page.on('request',r=>{if(r.url().startsWith(editorOrigin))staticRequests.push((async()=>{const h=await r.allHeaders();expect(h.authorization).toBeUndefined();expect(h.cookie).toBeUndefined();expect(new URL(r.url()).hash).toBe('');})());});
 try{
  const {id}=runtime.preparations.submit(actor,'FTEST','open','cross-origin');await runtime.preparations.idle();await runtime.documents!.present(id,actor,'trigger');
  const event=api.calls.find(c=>c.method==='entity.presentDetails')!;const preview=object(object(object(object(event.args.metadata).entity_payload).attributes).full_size_preview);
  expect(String(preview.preview_url)).toMatch(/^http:\/\/127\.0\.0\.1:4180\/editor\/#ticket=/);
  await page.goto(String(preview.preview_url));await expect(page.locator('#save-to-slack')).toBeVisible({timeout:60_000});expect(new URL(page.url()).hash).toBe('');
  const input=page.frameLocator('#editor iframe').getByLabel('문서 편집 입력',{exact:true});await input.focus();await input.pressSequentially('Cross origin ');await expect(page).toHaveTitle(/^\* /);
  await page.locator('#save-to-slack').click();await expect(page.locator('#slack-save p')).toHaveText('편집본과 PDF를 Slack에 저장했습니다.',{timeout:60_000});
  const posts=api.calls.filter(c=>c.method==='chat.postMessage');expect(posts).toHaveLength(2);expect(posts[1].args.thread_ts).toBe('123.456');
  if(pendingContextRequest){
   const pendingPage=await page.context().newPage();
   await pendingPage.goto(editorOrigin+'/teardown-probe',{waitUntil:'commit'});
   await expect.poll(()=>pendingRequest).toBe(true);
  }
  await Promise.all(staticRequests);expect(failures).toEqual([]);
 }finally{
  // Connections belong to the context, including those not owned by this page.
  // Close that owner before either HTTP server, even after an assertion failure.
  try{
   await test.step('close browser context',()=>page.context().close());
   if(pendingContextRequest)await test.step('browser released pending request',()=>expect.poll(()=>pendingRequestClosed).toBe(true));
  }finally{
   try{await test.step('stop API receiver',()=>runtime.receiver.stop());}
   finally{
    try{await test.step('close runtime',()=>runtime.close());}
    finally{await test.step('close static server',()=>new Promise<void>((r,j)=>frontend.close(e=>e?j(e):r())));}
   }
  }
 }
});

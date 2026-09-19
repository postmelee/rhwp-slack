import {test,expect} from '@playwright/test';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {createSlackReceiver} from '../../src/server/receiver';
import {staticAssets} from '../../src/server/static-assets';
import {editorPolicy} from '../../src/server/editor-policy';
import {EditorApi} from '../slack/editor-support';
import {config,actor,bytes} from '../slack/support';
import {object} from '../../src/server/errors';

test('separate static origin → API authorization → Studio edit → same-thread save, without token propagation',async({page})=>{
 const apiOrigin='http://127.0.0.1:4177',editorOrigin='http://127.0.0.1:4180',api=new EditorApi();
 const runtime=createSlackReceiver({...config,publicOrigin:apiOrigin,editorOrigin},api,{botId:'BBOT',botUserId:'UBOT'},{download:async()=>bytes,fetcher:async()=>new Response('ok')});
 const serve=staticAssets();const shell=readFileSync('dist/editor/index.html','utf8').replace('<meta name="rhwp-api-origin" content="">',`<meta name="rhwp-api-origin" content="${apiOrigin}">`);
 const frontend=createServer((req,res)=>{res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',editorPolicy(apiOrigin));res.setHeader('Referrer-Policy','no-referrer');
   const path=new URL(req.url!,editorOrigin).pathname;
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
  await page.goto(String(preview.preview_url));await expect(page.locator('#slack-save button')).toBeVisible({timeout:60_000});expect(new URL(page.url()).hash).toBe('');
  const input=page.frameLocator('#editor iframe').getByLabel('문서 편집 입력',{exact:true});await input.focus();await input.pressSequentially('Cross origin ');await expect(page).toHaveTitle(/^\* /);
  await page.locator('#slack-save button').click();await expect(page.locator('#slack-save p')).toHaveText('편집본과 PDF를 Slack에 저장했습니다.',{timeout:60_000});
  const posts=api.calls.filter(c=>c.method==='chat.postMessage');expect(posts).toHaveLength(2);expect(posts[1].args.thread_ts).toBe('123.456');
  await Promise.all(staticRequests);expect(failures).toEqual([]);
 }finally{await runtime.receiver.stop();await runtime.close();await new Promise<void>((r,j)=>frontend.close(e=>e?j(e):r()));}
});

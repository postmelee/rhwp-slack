import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
const origin='http://127.0.0.1:4174',ticket='t'.repeat(43),freshTicket='f'.repeat(43),bearer='s'.repeat(43),freshBearer='n'.repeat(43);
const identity={teamId:'TTEST',channelId:'CTEST',userId:'UTEST',cardId:'11111111-1111-4111-a111-111111111111'};
async function expiredEditor(page:Page,changedIdentity=false){
 const uploads:{id:string;bytes:Buffer;token:string}[]=[];let sources=0;
 await page.context().route(origin+'/api/editor/**',async route=>{
  const r=route.request(),path=new URL(r.url()).pathname,auth=r.headers().authorization;
  if(path.endsWith('/exchange')){await route.fulfill({json:{token:r.postDataJSON().ticket===ticket?bearer:freshBearer}});return;}
  if(path.endsWith('/document'))await route.fulfill({json:{name:'reconnect.hwp',format:'hwp',identity:auth==='Bearer '+freshBearer&&changedIdentity?{...identity,userId:'UOTHER'}:identity}});
  else if(path.endsWith('/source')){sources++;await route.fulfill({contentType:'application/octet-stream',body:readFileSync('tests/fixtures/viewer-two-pages.hwp')});}
  else if(path.endsWith('/save')){
   uploads.push({id:r.headers()['x-save-request-id'],bytes:r.postDataBuffer()!,token:auth});
   await route.fulfill(auth==='Bearer '+bearer?{status:403,json:{error:'expired',code:'session_expired'}}:{json:{saved:true,pdf:'ready'}});
  }else if(path.includes('/saves/'))await route.fulfill({json:{saved:true,pdf:'ready'}});else await route.fallback();
 });
 await page.goto(origin+'/editor/#'+new URLSearchParams({ticket,workspace:identity.teamId}));
 await expect(page.locator('#save-to-slack')).toBeVisible({timeout:60_000});
 const input=page.frameLocator('#editor iframe').getByRole('textbox',{name:'문서 편집 입력',exact:true});await input.focus();await input.pressSequentially('Preserved edit ');
 await page.locator('#save-to-slack').click();await expect(page.locator('#reconnect-slack')).toBeVisible();await expect(page).toHaveTitle(/^\* /);
 return {uploads,input,get sources(){return sources;}};
}
async function loginPopup(page:Page,finish=true){
 await page.context().route(origin+'/browser/open?**',async route=>{
  const u=new URL(route.request().url());expect(u.searchParams.get('workspace')).toBe(identity.teamId);expect(u.searchParams.get('document')).toBe(identity.cardId);
  if(!finish){await route.fulfill({contentType:'text/html',body:'<p>Login pending</p>'});return;}
  await route.fulfill({status:302,headers:{Location:origin+'/editor/#'+new URLSearchParams({ticket:freshTicket,workspace:identity.teamId,reconnect:u.searchParams.get('reconnect')!})}});
 });
 const popup=page.waitForEvent('popup');await page.locator('#reconnect-slack').click();return popup;
}
test('reauthentication keeps Studio and pending export, checks identity, retries identical save and preserves later edits',async({page})=>{
 const f=await expiredEditor(page);await f.input.focus();await f.input.pressSequentially('Later edit ');
 const oldFrame=page.frames()[1];await loginPopup(page);await expect(page.locator('#reconnect-slack')).toBeHidden();
 expect(page.frames()[1]).toBe(oldFrame);expect(f.sources).toBe(1);await expect(page).toHaveTitle(/^\* /);
 await page.locator('#save-to-slack').click();await expect.poll(()=>f.uploads.length).toBe(2);
 expect(f.uploads[1].id).toBe(f.uploads[0].id);expect(f.uploads[1].bytes).toEqual(f.uploads[0].bytes);expect(f.uploads[1].token).toBe('Bearer '+freshBearer);
 await expect(page.locator('#save-to-slack')).toBeEnabled();await expect(page).toHaveTitle(/^\* /);
 expect(await page.evaluate(()=>JSON.stringify({local:{...localStorage},session:{...sessionStorage}}))).not.toContain(freshBearer);
});
test('another authenticated user cannot replace the original actor; unsaved work can still be downloaded',async({page})=>{
 const f=await expiredEditor(page,true);await loginPopup(page);await expect(page.locator('#slack-save p')).toContainText('처음 편집한');await expect(page).toHaveTitle(/^\* /);
 await page.locator('#save-to-slack').click();await expect.poll(()=>f.uploads.length).toBe(2);expect(f.uploads[1].token).toBe('Bearer '+bearer);
 const downloaded=page.waitForEvent('download');await page.locator('#download-edits').click();const download=await downloaded;expect(download.suggestedFilename()).toBe('reconnect_편집본.hwp');
 expect(readFileSync((await download.path())!).length).toBeGreaterThan(100);await expect(page).toHaveTitle(/^\* /);
});
test('forged postMessage and cancelled popup do not replace the session or destroy the editor',async({page})=>{
 const f=await expiredEditor(page);const popup=await loginPopup(page,false);await popup.waitForLoadState();
 const nonce=new URL(popup.url()).searchParams.get('reconnect');
 await page.evaluate(({nonce,freshTicket,identity})=>window.dispatchEvent(new MessageEvent('message',{origin:location.origin,source:window,data:{type:'rhwp:reconnect',nonce,ticket:freshTicket,workspace:identity.teamId}})),{nonce,freshTicket,identity});
 await popup.evaluate(({freshTicket,identity})=>window.opener.postMessage({type:'rhwp:reconnect',nonce:'x'.repeat(43),ticket:freshTicket,workspace:identity.teamId},location.origin),{freshTicket,identity});
 await popup.close();await expect(page.locator('#slack-save p')).toContainText('로그인을 취소');await expect(page).toHaveTitle(/^\* /);expect(f.sources).toBe(1);
 await page.locator('#save-to-slack').click();await expect.poll(()=>f.uploads.length).toBe(2);expect(f.uploads[1].token).toBe('Bearer '+bearer);
});

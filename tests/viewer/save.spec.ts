import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import init,{HwpDocument} from '@rhwp/core';
const origin='http://127.0.0.1:4174';
const bearer='s'.repeat(43),ticket='t'.repeat(43);
async function session(page:Page,format='hwp'){
  const requests:string[]=[];
  await page.route(origin+'/api/editor/**',async route=>{
    const request=route.request(),path=new URL(request.url()).pathname;requests.push(path);
    if(path.endsWith('/exchange')){expect(request.postDataJSON()).toEqual({ticket});await route.fulfill({json:{token:bearer}});return;}
    expect(request.headers().authorization).toBe('Bearer '+bearer);
    if(path.endsWith('/document'))await route.fulfill({json:{name:`문서.${format}`,format}});
    else if(path.endsWith('/source'))await route.fulfill({contentType:'application/octet-stream',body:readFileSync(`tests/fixtures/viewer-two-pages.${format}`)});
    else if(path.includes('/saves/'))await route.fulfill({json:{saved:true,pdf:'ready'}});
    else await route.fallback();
  });
  await page.goto(origin+'/editor/#ticket='+ticket);
  await expect(page.locator('#slack-save button')).toBeVisible({timeout:60_000});
  await expect(page).toHaveTitle(`문서.${format} · rhwp`);
  expect(new URL(page.url()).hash).toBe('');
  expect(await page.evaluate(()=>Object.hasOwn(window,'__studio'))).toBe(false);
  return requests;
}
for(const format of ['hwp','hwpx'])test(`${format}: production save keeps edits made during upload dirty and acknowledges only the saved revision`,async({page})=>{
  let release!:()=>void;const gate=new Promise<void>(r=>release=r);const uploads:{id:string;bytes:Buffer}[]=[];
  await page.route(origin+'/api/editor/save',async route=>{
    const r=route.request();expect(r.headers()['x-document-format']).toBe(format);
    uploads.push({id:r.headers()['x-save-request-id'],bytes:r.postDataBuffer()!});
    if(uploads.length===1)await gate;
    await route.fulfill({json:{saved:true,pdf:'pending'}});
  });
  await session(page,format);
  const input=page.frameLocator('#editor iframe').getByLabel('문서 편집 입력',{exact:true});
  await input.focus();await input.pressSequentially('Before save ');await expect(page).toHaveTitle(/^\* /);
  await page.locator('#slack-save button').click();await expect.poll(()=>uploads.length).toBe(1);
  await input.focus();await input.pressSequentially('After save ');release();
  await expect(page.locator('#slack-save button')).toBeEnabled();await expect(page).toHaveTitle(/^\* /);
  await expect(page.locator('#status')).toHaveText('저장하지 않은 변경 있음');
  await init({module_or_path:readFileSync('node_modules/@rhwp/core/rhwp_bg.wasm')});
  const document=new HwpDocument(uploads[0].bytes);const text=document.getTextFileText();document.free();
  expect(text).toContain('Before save');expect(text).not.toContain('After save');
  await page.locator('#slack-save button').click();await expect.poll(()=>uploads.length).toBe(2);
  await expect(page).toHaveTitle(`문서.${format} · rhwp`);expect(uploads[0].id).not.toBe(uploads[1].id);
  await page.setViewportSize({width:669,height:863});await expect(page.locator('#host')).toHaveCount(0);
  expect(await page.locator('#editor iframe').boundingBox()).toMatchObject({x:0,y:0,width:669,height:863});
  const storage=await page.evaluate(()=>JSON.stringify({local:{...localStorage},session:{...sessionStorage}}));expect(storage).not.toContain(bearer);expect(storage).not.toContain(ticket);
  await page.screenshot({path:`test-results/slack-save-${format}.png`});
});
test('failed save remains dirty and retries the exact same export after further edits',async({page})=>{
  const uploads:{id:string;bytes:Buffer}[]=[];
  await page.route(origin+'/api/editor/save',async route=>{
    const r=route.request();uploads.push({id:r.headers()['x-save-request-id'],bytes:r.postDataBuffer()!});
    await route.fulfill(uploads.length===1?{status:503,json:{error:'저장 결과를 확인 중입니다.'}}:{json:{saved:true,pdf:'failed'}});
  });
  await session(page);const input=page.frameLocator('#editor iframe').getByLabel('문서 편집 입력',{exact:true});
  await input.focus();await input.pressSequentially('First edit ');await page.locator('#slack-save button').click();
  await expect(page.locator('#slack-save button')).toHaveText('같은 저장 요청 다시 확인');await expect(page).toHaveTitle(/^\* /);
  await input.focus();await input.pressSequentially('Later edit ');await page.locator('#slack-save button').click();
  await expect(page.locator('#slack-save button')).toHaveText('편집본을 Slack에 저장');expect(uploads).toHaveLength(2);
  expect(uploads[1]).toEqual(uploads[0]);await expect(page).toHaveTitle(/^\* /);
  await expect(page.locator('#slack-save p')).toContainText('PDF 생성 실패');
  await expect(page.locator('#slack-save p')).toContainText('현재 변경은 미저장입니다.');
});

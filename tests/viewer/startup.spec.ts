import {test,expect} from '@playwright/test';
const origin='http://127.0.0.1:4174',ticket='t'.repeat(43),bearer='s'.repeat(43);
test('direct external opening guides the user to the Slack card without loading an empty editor',async({page})=>{
 await page.goto(origin+'/editor/');await expect(page.locator('#reopen')).toContainText('rhwp에서 편집');
 await expect(page.locator('#editor iframe')).toHaveCount(0);await expect(page.locator('#slack-save')).toHaveCount(0);
});
test('a stalled iframe has a deadline and cannot replace recovery guidance with a late result',async({page})=>{
 await page.clock.install();
 let release!:()=>void;const gate=new Promise<void>(r=>release=r);
 await page.route(origin+'/api/editor/exchange',route=>route.fulfill({json:{token:bearer}}));
 await page.route('**/studio/**',async route=>{await gate;await route.fulfill({contentType:'text/html',body:'<!doctype html><title>late</title>'}).catch(()=>{});});
 try{
  await page.goto(origin+'/editor/#ticket='+ticket,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#editor iframe')).toHaveCount(1);await expect(page.locator('#status')).toContainText('편집기를 준비');
  await page.clock.fastForward(120_001);
  await expect(page.locator('body')).toHaveAttribute('data-state','error');await expect(page.locator('#reopen')).toBeVisible();
  await expect(page.locator('#editor iframe')).toHaveCount(0);release();await page.clock.fastForward(60_000);
  await expect(page.locator('body')).toHaveAttribute('data-state','error');await expect(page.locator('#slack-save')).toHaveCount(0);
 }finally{release();}
});
test('source transfer failure removes the editor and offers a fresh Slack entry',async({page})=>{
 await page.route(origin+'/api/editor/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/exchange'))await route.fulfill({json:{token:bearer}});
  else if(path.endsWith('/document'))await route.fulfill({json:{name:'문서.hwp',format:'hwp'}});
  else await route.fulfill({status:503,json:{error:'문서를 가져오지 못했습니다.'}});
 });
 await page.goto(origin+'/editor/#ticket='+ticket);
 await expect(page.locator('#status')).toContainText('문서를 가져오지 못했습니다.',{timeout:60_000});
 await expect(page.locator('#editor iframe')).toHaveCount(0);await expect(page.locator('#reopen')).toBeVisible();
 expect(new URL(page.url()).hash).toBe('');
});

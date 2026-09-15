import {test,expect} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
for(const extension of ['hwp','hwpx']) {
  test(`${extension}: PDF reading opens the same source in a separate compact editor`,async({page,context,request})=>{
    await page.goto('/viewer/');
    expect(page.frames().some(f=>f.url().includes('/studio/'))).toBe(false);
    const pdfResponse=page.waitForResponse(r=>r.url().endsWith('/pdf')&&r.status()===200);
    await page.locator('#file').setInputFiles(`tests/fixtures/viewer-two-pages.${extension}`);
    await expect(page.locator('#edit')).toBeVisible({timeout:60_000});
    await expect(page.locator('#pdf')).toBeVisible();
    const pdf=await (await pdfResponse).body();
    await expect(page.locator('#page-counter')).toHaveText('1 / 2쪽');
    await expect(page.locator('#pdf-canvas')).toHaveAttribute('aria-label',/첫 번째 페이지/);
    await page.screenshot({path:`test-results/pdf-reader-${extension}-1.png`});
    await page.locator('#next').click();
    await expect(page.locator('#page-counter')).toHaveText('2 / 2쪽');
    await expect(page.locator('#pdf-canvas')).toHaveAttribute('aria-label',/두 번째 페이지/);
    await page.screenshot({path:`test-results/pdf-reader-${extension}-2.png`});
    expect(Buffer.from(pdf).subarray(0,5).toString()).toBe('%PDF-');
    writeFileSync(`test-results/preview-${extension}.pdf`,Buffer.from(pdf));
    const popupPromise=context.waitForEvent('page');await page.locator('#edit').click();const editor=await popupPromise;
    await expect(editor.locator('#document-name')).toHaveText(`viewer-two-pages.${extension}`,{timeout:60_000});
    expect(await editor.evaluate(()=>window.__studio.pageCount())).toBe(2);
    expect(await editor.evaluate(()=>window.__studio.hwpctrl.call('GetTextFile',['TEXT','']))).toContain('첫 번째 페이지');
    await expect(editor.locator('#status')).toHaveText('변경 없음');
    await editor.evaluate(()=>window.__studio.hwpctrl.call('SetTextFile',['편집 중','TEXT','']));
    await expect(editor.locator('#status')).toHaveText('저장하지 않은 변경 있음');
    await expect(editor.locator('#save')).toBeHidden();
    await expect(editor.locator('#file')).toBeHidden();
    expect(await editor.evaluate(()=>location.hash)).toBe('');
    // The read view remains the immutable original PDF after unsaved edits.
    const unchanged=await (await request.get((await pdfResponse).url())).body();
    expect(unchanged).toEqual(pdf);
    await editor.setViewportSize({width:669,height:863});
    await editor.screenshot({path:`test-results/editor-compact-${extension}.png`});
  });
}
test('long filename fits one-line editor header and foreign dirty events are ignored',async({page})=>{
  await page.setViewportSize({width:400,height:800});await page.goto('/editor/');
  await page.waitForFunction(()=>Boolean(window.__studio));
  const name='21868765_별표2_보건소_분장사무_매우긴문서이름_'.repeat(5)+'.hwp';
  await page.locator('#file').setInputFiles({name,mimeType:'application/octet-stream',buffer:readFileSync('tests/fixtures/viewer-two-pages.hwp')});
  await expect(page.locator('#document-name')).toHaveText(name);
  expect((await page.locator('#host').boundingBox())!.height).toBe(40);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(400);
  await page.evaluate(()=>window.postMessage({type:'rhwp-slack:dirty',dirty:true},location.origin));
  await expect(page.locator('#status')).toHaveText('변경 없음');
  await page.screenshot({path:'test-results/editor-long-name.png'});
});
test('PDF failure clears previous document and production exposes no conversion API',async({page,request})=>{
  await page.goto('/viewer/');
  await page.locator('#file').setInputFiles('tests/fixtures/viewer-two-pages.hwp');
  await expect(page.locator('#edit')).toBeVisible({timeout:60_000});
  await page.locator('#file').setInputFiles({name:'bad.hwpx',mimeType:'application/octet-stream',buffer:Buffer.from([80,75,3,4,0])});
  await expect(page.locator('#status')).toContainText('PDF를 만들지 못했습니다.',{timeout:60_000});
  await expect(page.locator('#pdf')).toBeHidden();await expect(page.locator('#edit')).toBeHidden();
  expect((await request.post('http://127.0.0.1:4174/api/dev/documents',{data:'test'})).status()).toBe(404);
  expect((await request.post('/api/dev/documents',{data:'test',headers:{Origin:'https://other.invalid'}})).status()).toBe(403);
  await page.goto('/editor/#document=00000000-0000-0000-0000-000000000000');
  await expect(page.locator('#status')).toContainText('문서가 만료',{timeout:60_000});
});

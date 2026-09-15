import { test, expect, type Locator } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const fixtures = JSON.parse(readFileSync('tests/fixtures/manifest.json','utf8')) as {file:string;pages:number;expected:string[][]}[];
async function expectGlyphs(content: Locator, text: string) {
  // rhwp emits individually positioned glyphs, with spacing represented by x coordinates.
  expect((await content.locator('text').allTextContents()).join('').replace(/\s/g,'')).toContain(text.replace(/\s/g,''));
}
for (const fixture of fixtures) for (const sandbox of [false,true]) {
  test(`${fixture.file}: ${sandbox ? 'opaque iframe' : 'standalone'} actual rendering`, async ({page}, info) => {
    const external: string[]=[];
    page.on('request',r=>{ if (r.url().startsWith('http') && !r.url().startsWith('http://127.0.0.1:4173/')) external.push(r.url()); });
    await page.goto(sandbox?'/sandbox':'/viewer/');
    const ui=sandbox?page.frameLocator('iframe'):page;
    await ui.getByLabel('문서 선택',{exact:true}).setInputFiles(resolve('tests/fixtures',fixture.file));
    await expect(ui.locator('#status')).toHaveText('1 / 2페이지',{timeout:60_000});
    const content=ui.locator('#paper');
    for (const text of fixture.expected[0]) await expectGlyphs(content,text);
    await expect(content.locator('svg')).toBeVisible();
    const glyphHeights = await content.locator('text').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
    expect(Math.min(...glyphHeights)).toBeGreaterThan(8);
    const before=(await content.boundingBox())!.width;
    await ui.getByLabel('확대 배율').selectOption('150');
    await expect.poll(async ()=>(await content.boundingBox())!.width).toBeCloseTo(before*1.5,0);
    await ui.getByLabel('확대 배율').selectOption('100');
    await page.screenshot({path:info.outputPath('page-1.png'),fullPage:true});
    await ui.getByLabel('다음 페이지').click();
    await expect(ui.locator('#status')).toHaveText('2 / 2페이지');
    for (const text of fixture.expected[1]) await expectGlyphs(content,text);
    await expect(content.locator('image')).toHaveCount(1);
    await expectGlyphs(content,'그림 1. 초록색 사각형');
    expect(await content.locator('image').evaluate(node=>node.getAttribute('href')||node.getAttribute('xlink:href'))).toMatch(/^data:image\/png;base64,/);
    await expect(ui.getByLabel('다음 페이지')).toBeDisabled();
    await page.screenshot({path:info.outputPath('page-2.png'),fullPage:true});
    for (const value of ['0','-1','1.5','3']) {
      await ui.getByLabel('페이지 번호').fill(value); await ui.getByLabel('페이지 번호').press('Enter');
      await expect(ui.locator('#status')).toContainText('정수'); await expectGlyphs(content,fixture.expected[1][0]);
    }
    await ui.getByLabel('페이지 번호').fill('1'); await ui.getByLabel('페이지 번호').press('Enter');
    await expect(ui.locator('#status')).toHaveText('1 / 2페이지');
    await ui.getByRole('button',{name:'닫기',exact:true}).click();
    await expect(content).toBeHidden();
    await expect.poll(()=>page.workers().length).toBe(0);
    expect(external).toEqual([]);
  });
}
test('damaged document fails visibly and a subsequent valid file opens',async ({page})=>{
  await page.goto('/viewer/');
  await page.getByLabel('문서 선택',{exact:true}).setInputFiles({name:'broken.hwp',mimeType:'application/octet-stream',buffer:Buffer.from([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1])});
  await expect(page.locator('#status')).toContainText('문서를 열지 못했습니다',{timeout:60_000});
  await page.getByLabel('문서 선택',{exact:true}).setInputFiles(resolve('tests/fixtures',fixtures[1].file));
  await expect(page.locator('#status')).toHaveText('1 / 2페이지',{timeout:60_000});
});
test('replacing and cancelling in-flight documents cannot paint stale content',async ({page})=>{
  await page.route('**/rhwp_bg.wasm',async route=>{await new Promise(r=>setTimeout(r,500));await route.continue().catch(()=>{});});
  await page.goto('/viewer/');
  const input=page.getByLabel('문서 선택',{exact:true});
  await input.setInputFiles(resolve('tests/fixtures',fixtures[0].file));
  await expect(page.getByRole('button',{name:'닫기',exact:true})).toBeEnabled();
  await input.setInputFiles(resolve('tests/fixtures',fixtures[1].file));
  await expect(page.locator('#status')).toHaveText('1 / 2페이지',{timeout:60_000});
  await expect(page.locator('#filename')).toHaveText(fixtures[1].file);
  await input.setInputFiles(resolve('tests/fixtures',fixtures[0].file));
  await expect(page.getByRole('button',{name:'닫기',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'닫기',exact:true}).click();
  await page.waitForTimeout(750); await expect(page.locator('#paper')).toBeHidden();
  await expect(page.locator('#status')).toHaveText('문서를 닫았습니다.');
});
test('production has no file input or testing API',async ({page})=>{
  await page.goto('http://127.0.0.1:4174/viewer/');
  await expect(page.locator('input[type=file]')).toHaveCount(0);
  expect(await page.evaluate(()=>Object.hasOwn(globalThis,'rhwpTesting'))).toBe(false);
  await expect(page.locator('#status')).toContainText('Slack 연결을 준비 중');
});

import { test, expect } from '@playwright/test';
import init, { HwpDocument } from '@rhwp/core';
import { readFile } from 'node:fs/promises';
test('201 real pages are rejected after parsing before rendering', async ({page}) => {
  await init({module_or_path:await readFile('node_modules/@rhwp/core/rhwp_bg.wasm')});
  const doc=HwpDocument.createEmpty(); doc.createBlankDocument();
  let p=0;
  for(let i=0;i<200;i++) p=JSON.parse(doc.insertPageBreak(0,p,0)).paraIdx;
  const bytes=Buffer.from(doc.exportHwp()); doc.free();
  await page.goto('/sandbox');
  const ui=page.frameLocator('iframe');
  await ui.getByLabel('문서 선택',{exact:true}).setInputFiles({name:'201-pages.hwp',mimeType:'application/octet-stream',buffer:bytes});
  await expect(ui.locator('#status')).toContainText('1~200페이지',{timeout:60_000});
  await expect(ui.locator('#paper')).toBeHidden();
  await expect.poll(()=>page.workers().length).toBe(0);
});

import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const source=readFileSync('tests/fixtures/viewer-two-pages.hwp');
test('SVG policy blocks executable and remote resources while retaining local graphics',async ({page})=>{
  const outgoing:string[]=[];
  await page.route('https://attacker.invalid/**',route=>{outgoing.push(route.request().url());return route.abort();});
  await page.goto('/viewer/');
  await page.waitForFunction(()=>Object.hasOwn(globalThis,'rhwpTesting'));
  const result=await page.evaluate(()=>{
    const api=(globalThis as any).rhwpTesting;
    const svg=api.sanitizeSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" onload="window.attacked=true">
      <script>window.attacked=true</script><foreignObject><img src="https://attacker.invalid/foreign"/></foreignObject>
      <style>@import url(https://attacker.invalid/css); text{fill:red}</style>
      <defs><clipPath id="safeClip"><rect width="200" height="100"/></clipPath></defs>
      <rect id="safe" width="150" height="30" fill="#24685b" clip-path="url(#safeClip)"/>
      <text x="10" y="20" style="font-size:16px; fill:#000; position:fixed; background:url(https://attacker.invalid/bg)">정상</text>
      <image href="https://attacker.invalid/image" width="10" height="10"/>
      <image href="data:image/svg+xml;base64,PHN2Zy8+"/>
      <image href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=" width="1" height="1"/>
      <animate attributeName="href" values="https://attacker.invalid/animate"/>
      <g style="fill:u\\72l(https://attacker.invalid/escape);filter:var(--remote)"><text x="1" y="40">문자</text></g>
      </svg>`);
    document.getElementById('paper')!.append(svg);
    document.getElementById('paper')!.hidden=false;
    return { html:svg.outerHTML,clip:svg.querySelector('#safe')!.getAttribute('clip-path'),text:svg.textContent,attacked:(globalThis as any).attacked };
  });
  expect(result.html).not.toMatch(/attacker|foreignObject|<script|<style|onload|<animate|position:|svg\+xml|var\(/);
  expect(result.html).toContain('data:image/png;base64,');
  expect(result.clip).toBe('url(#safeClip)'); expect(result.text).toContain('정상');
  expect(result.attacked).toBeUndefined();
  await page.waitForTimeout(150); expect(outgoing).toEqual([]);
});
test('a blocked worker is terminated at the deadline and UI remains responsive',async ({page})=>{
  await page.goto('/viewer/');
  // Warm the real font registry before isolating the synchronous worker deadline.
  await page.getByLabel('문서 선택',{exact:true}).setInputFiles(resolve('tests/fixtures/viewer-two-pages.hwp'));
  await expect(page.locator('#status')).toHaveText('1 / 2페이지',{timeout:60_000});
  await page.getByRole('button',{name:'닫기',exact:true}).click();
  await page.route('**/engine.worker-*.js',route=>route.fulfill({contentType:'text/javascript',body:`self.onmessage=({data})=>{if(data.type==='init')self.postMessage({id:data.id,result:true});else if(data.type==='open'){while(true){}}};`}));
  const result=await page.evaluate(async bytes=>{
    const engine=new (globalThis as any).rhwpTesting.Engine(500);
    const started=performance.now();
    try {await engine.open(new Uint8Array(bytes).buffer);return {code:'unexpected-success',elapsed:0};}
    catch(error){return {code:(error as any).code,elapsed:performance.now()-started};}
    finally{engine.dispose();}
  },[...source]);
  expect(result.code).toBe('timeout'); expect(result.elapsed).toBeGreaterThanOrEqual(450); expect(result.elapsed).toBeLessThan(5000);
  await expect(page.locator('#status')).toHaveText('문서를 닫았습니다.');
});

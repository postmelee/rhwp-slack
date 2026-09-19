import {test,expect} from '@playwright/test';
test('a fresh editor reuses versioned program assets but starts with no document',async({context})=>{
  const visits=[];
  for(let i=0;i<2;i++){
    const page=await context.newPage();await page.goto('/editor/');await page.waitForFunction(()=>Boolean(window.__studio));
    expect(await page.evaluate(()=>window.__studio.pageCount())).toBe(0);
    const frame=page.frames().find(f=>f.url().includes('/studio/'))!;
    const assets=await frame.evaluate(()=>performance.getEntriesByType('resource').filter(e=>new URL(e.name).pathname.startsWith('/static/')).map(e=>({path:new URL(e.name).pathname,transfer:(e as PerformanceResourceTiming).transferSize})));
    expect(assets.some(a=>a.path.endsWith('.wasm'))).toBeTruthy();visits.push(assets);
    await page.close();
  }
  expect(visits[0].some(a=>a.transfer>0)).toBeTruthy();
  expect(visits[1].filter(a=>/\.(wasm|js|woff2)$/.test(a.path)).every(a=>a.transfer===0)).toBeTruthy();
});

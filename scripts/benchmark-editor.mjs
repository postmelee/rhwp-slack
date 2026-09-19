// Project-owned browser benchmark. Provider issues a fresh, short-lived test ticket per visit.
// Never records URLs, credentials, headers, document names or contents.
import {chromium} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
export async function benchmark({issue,close=async()=>{},labels,origin,output,repeats=3,revision,condition='server warm / browser cache varied'}) {
  const browser=await chromium.launch();
  const result={revision,condition,origin,client:process.platform+' '+process.arch,browser:browser.version(),samples:[]};
  try {
    for(let repeat=1;repeat<=repeats;repeat++){
      const context=await browser.newContext({viewport:{width:1152,height:900}});
      try {
        for(const [cache,label] of [['cold',labels[0]],['warm-same',labels[0]],['warm-other',labels[1]]]){
          const url=await issue(label); // outside the navigation timer
          const page=await context.newPage();
          const sample={repeat,cache,label,at:new Date().toISOString(),ok:false,requests:[]};
          const pending=[];
          page.on('requestfinished',request=>pending.push((async()=>{
            const response=await request.response();
            const pathname=new URL(request.url()).pathname;
            if(!/^\/(editor|studio|static|api\/editor)\//.test(pathname))return;
            const sizes=await request.sizes(),timing=request.timing();
            sample.requests.push({path:pathname.replace(/\/saves\/.*/, '/saves/:id'),status:response?.status(),start:timing.startTime,ms:timing.responseEnd,bodyBytes:sizes.responseBodySize,headersBytes:sizes.responseHeadersSize});
          })().catch(()=>{})));
          const start=Date.now();
          try {
            await page.goto(url,{waitUntil:'domcontentloaded'});
            await page.locator('#slack-save button').waitFor({state:'visible',timeout:125_000});
            sample.readyMs=Date.now()-start;sample.ok=true;
            // ResourceTiming includes the iframe assets and distinguishes HTTP cache hits.
            sample.resources=[];
            for(const frame of page.frames()) sample.resources.push(...await frame.evaluate(()=>performance.getEntriesByType('resource').map(e=>({path:new URL(e.name).pathname,transferBytes:e.transferSize,encodedBytes:e.encodedBodySize,decodedBytes:e.decodedBodySize,ms:e.duration}))).catch(()=>[]));
            sample.marks=await page.evaluate(()=>performance.getEntriesByType('mark').filter(e=>e.name.startsWith('rhwp:')).map(e=>({name:e.name,ms:e.startTime})));
          } catch {sample.readyMs=Date.now()-start;sample.error='editor_not_ready';}
          await Promise.all(pending);await page.close();
          result.samples.push(sample);
          await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(result,null,2),{mode:0o600});
          console.log(JSON.stringify({repeat,cache,label,ok:sample.ok,readyMs:sample.readyMs}));
          if(!sample.ok)throw Error('Editor benchmark failed; sanitized partial results saved');
        }
      } finally {await context.close();}
    }
  } finally {await browser.close();await close();}
  return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const provider=await import(pathToFileURL(resolve(process.argv[2])).href);
  await benchmark(await provider.setup());
}

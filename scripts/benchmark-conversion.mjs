// Local/Linux conversion-only benchmark. No Slack credentials or source bytes are logged.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname} from 'node:path';
import {convertPreview,validMetric,closeConversionRuntime} from '../src/conversion/convert.mjs';
const args=process.argv.slice(2),input=args[0];
function option(name,fallback){const i=args.indexOf(name);return i<0?fallback:args[i+1];}
if(!input||input.startsWith('--'))throw new Error('Usage: node scripts/benchmark-conversion.mjs INPUT --output JSON [--runs 3] [--timeout-ms 60000]');
const output=option('--output',undefined),runs=Number(option('--runs','3')),timeoutMs=Number(option('--timeout-ms','60000'));
if(!output||!Number.isSafeInteger(runs)||runs<1||runs>20||!Number.isSafeInteger(timeoutMs)||timeoutMs<1000||timeoutMs>900000)throw new Error('Invalid benchmark options');
const bytes=await readFile(input),result={schema:1,runtime:process.version,platform:process.platform,arch:process.arch,inputSha256:createHash('sha256').update(bytes).digest('hex'),inputBytes:bytes.length,timeoutMs,scope:args.includes('--fresh-runtime')?'conversion-only; new runtime per call':'conversion-only; reused runtime, fresh document thread/context per call',samples:[]};
for(let run=1;run<=runs;run++){
 if(args.includes('--fresh-runtime'))await closeConversionRuntime();
 const metrics=[],milestones=[],started=performance.now();
 try{
  const preview=await convertPreview(bytes,{timeoutMs,onPdf:()=>milestones.push({name:'pdf_generated',elapsedMs:Math.round(performance.now()-started)}),onPage:page=>milestones.push({name:'png_generated',page:page.page,elapsedMs:Math.round(performance.now()-started)}),onMetric:value=>{const m=validMetric(value);if(m)metrics.push(m);}});
  result.samples.push({run,ok:true,durationMs:Math.round(performance.now()-started),pageCount:preview.pageCount,pdfBytes:preview.pdf.length,pngBytes:preview.pages.map(p=>p.png.length),metrics,milestones});
 }catch(error){result.samples.push({run,ok:false,durationMs:Math.round(performance.now()-started),errorCode:['conversion_timeout','conversion_child','conversion_output','conversion_start'].includes(error.code)?error.code:'internal',metrics});}
 await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(result,null,2),{mode:0o600});
 console.log(JSON.stringify({run,ok:result.samples.at(-1).ok,durationMs:result.samples.at(-1).durationMs}));
}
await closeConversionRuntime();
const values=result.samples.filter(s=>s.ok).map(s=>s.durationMs).sort((a,b)=>a-b);
console.log(JSON.stringify({successes:values.length,runs,...(values.length?{medianMs:(values[Math.floor((values.length-1)/2)]+values[Math.floor(values.length/2)])/2,minMs:values[0],maxMs:values.at(-1)}:{})}));
if(values.length!==runs)process.exitCode=1;

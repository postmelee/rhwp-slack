import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {workerEnvironment} from './worker-env.mjs';
export const MAX_PDF_BYTES=50*1024*1024;
export const MAX_PNG_BYTES=5*1024*1024;
export const MAX_PNG_TOTAL_BYTES=25*1024*1024;
export const MAX_PREVIEW_PAGES=10;
const PNG_SIGNATURE='89504e470d0a1a0a';
const METRIC_STAGES=new Set(['browser_start','process_start','input','wasm_init','parse','svg_render','fonts_prepare','browser_render','dom_prepare','page_attach','fonts_ready','pdf','png','output']);
export class ConversionError extends Error {constructor(code,message,stage){super(message);this.code=code;this.stage=stage;}}
export function validMetric(value){
  if(!value||!METRIC_STAGES.has(value.stage)||!['start','finish','failed'].includes(value.phase))return;
  if(value.durationMs!==undefined&&(!Number.isFinite(value.durationMs)||value.durationMs<0||value.durationMs>3600000))return;
  if(value.rssBytes!==undefined&&(!Number.isSafeInteger(value.rssBytes)||value.rssBytes<0))return;
  return {stage:value.stage,phase:value.phase,...(value.durationMs!==undefined?{durationMs:value.durationMs}:{}),...(value.rssBytes!==undefined?{rssBytes:value.rssBytes}:{})};
}
export function convertPdf(bytes,options={}){return convert(bytes,options,'pdf',0,0);}
export function convertPreview(bytes,options={}){return convert(bytes,options,'preview',1,3);}
export function convertPageImages(bytes,{start=1,end=10,...options}={}){
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<1||end<start||end>MAX_PREVIEW_PAGES)return Promise.reject(new Error('미리보기 페이지 범위가 올바르지 않습니다.'));
  return convert(bytes,options,'images',start,end);
}
function decode(output,mode,start,end){
  if(mode==='pdf'){
    if(output.length>MAX_PDF_BYTES||output.subarray(0,5).toString()!=='%PDF-')throw new Error('pdf');
    return output;
  }
  if(output.length<4)throw new Error('header');
  const length=output.readUInt32BE(0);if(length<2||length>4096||length+4>output.length)throw new Error('header');
  const header=JSON.parse(output.subarray(4,4+length).toString());
  if(!Number.isSafeInteger(header.pageCount)||header.pageCount<1||header.pageCount>200||!Array.isArray(header.pages)||!Number.isSafeInteger(header.pdfBytes)||header.pdfBytes<0||header.pdfBytes>MAX_PDF_BYTES)throw new Error('manifest');
  const expected=Math.max(0,Math.min(end,header.pageCount)-start+1);
  if(header.pages.length!==expected||(mode==='images'&&header.pdfBytes!==0))throw new Error('range');
  let offset=4+length,total=0;const pdf=output.subarray(offset,offset+header.pdfBytes);offset+=header.pdfBytes;
  if(mode==='preview'&&pdf.subarray(0,5).toString()!=='%PDF-')throw new Error('pdf');
  const pages=header.pages.map((entry,i)=>{
    if(entry.page!==start+i||!Number.isSafeInteger(entry.bytes)||entry.bytes<8||entry.bytes>MAX_PNG_BYTES)throw new Error('page');
    total+=entry.bytes;if(total>MAX_PNG_TOTAL_BYTES)throw new Error('images-size');
    const png=output.subarray(offset,offset+entry.bytes);offset+=entry.bytes;
    if(png.length!==entry.bytes||png.subarray(0,8).toString('hex')!==PNG_SIGNATURE)throw new Error('png');
    return {page:entry.page,png};
  });
  if(offset!==output.length)throw new Error('trailing-output');
  return mode==='preview'?{pdf,pageCount:header.pageCount,pages}:{pageCount:header.pageCount,pages};
}
function convert(bytes,{timeoutMs=60_000,onMetric}={},mode,start,end){
  return new Promise((resolveResult,reject)=>{
    let child,browserServer,size=0,done=false,stage='browser_start',pendingMetrics='',childStarted=false,spawnedAt=0;const chunks=[];
    const metric=value=>{const clean=validMetric(value);if(!clean)return;if(clean.phase==='start')stage=clean.stage;try{onMetric?.(clean);}catch{}};
    const started=performance.now();metric({stage,phase:'start'});
    const limit=MAX_PDF_BYTES+(mode==='pdf'?0:MAX_PNG_TOTAL_BYTES+4100);
    const killGroup=pid=>{if(!pid)return;try{process.kill(process.platform==='win32'?pid:-pid,'SIGKILL');}catch{}};
    const cleanup=()=>{killGroup(child?.pid);killGroup(browserServer?.process().pid);void browserServer?.close().catch(()=>{});};
    const fail=(message,code='conversion_start')=>{if(done)return;done=true;clearTimeout(timer);cleanup();reject(new ConversionError(code,message,stage));};
    const timer=setTimeout(()=>fail('문서 변환 시간이 초과되었습니다.','conversion_timeout'),timeoutMs);
    void import('@playwright/test').then(({chromium})=>chromium.launchServer({headless:true,env:workerEnvironment(),host:'127.0.0.1',timeout:Math.min(10_000,timeoutMs)})).then(server=>{
      browserServer=server;if(done){cleanup();return;}
      metric({stage:'browser_start',phase:'finish',durationMs:Math.round(performance.now()-started)});
      spawnedAt=performance.now();metric({stage:'process_start',phase:'start'});
      child=spawn(process.execPath,['--import','tsx',resolve('src/conversion/pdf-child.mjs'),mode,String(start),String(end)],{
        detached:process.platform!=='win32',stdio:['pipe','pipe','pipe','pipe'],env:{...workerEnvironment(),RHWP_PDF_BROWSER_WS:server.wsEndpoint()},
      });
      child.on('error',()=>fail('문서 변환기를 시작하지 못했습니다.'));child.stdin.on('error',()=>{});child.stderr.resume();
      child.stdio[3].on('data',chunk=>{
        if(done)return;
        pendingMetrics+=chunk.toString('utf8');
        if(pendingMetrics.length>8192){pendingMetrics='';return;}
        for(let index;(index=pendingMetrics.indexOf('\n'))>=0;){
          const line=pendingMetrics.slice(0,index);pendingMetrics=pendingMetrics.slice(index+1);
          try{const value=validMetric(JSON.parse(line));if(!value)continue;
            if(!childStarted){childStarted=true;metric({stage:'process_start',phase:'finish',durationMs:Math.round(performance.now()-spawnedAt)});}
            metric(value);
          }catch{}
        }
      });
      child.stdout.on('data',chunk=>{size+=chunk.length;if(size>limit)fail('변환 결과가 용량 제한을 초과했습니다.','conversion_output');else chunks.push(chunk);});
      child.on('close',code=>{
        if(done)return;done=true;clearTimeout(timer);cleanup();
        try{if(code!==0)throw new Error('child');resolveResult(decode(Buffer.concat(chunks),mode,start,end));}
        catch{reject(new ConversionError(code!==0?'conversion_child':'conversion_output','문서 변환에 실패했습니다. 지원되는 HWP/HWPX와 페이지 범위인지 확인하세요.',stage));}
      });child.stdin.end(bytes);
    }).catch(()=>fail('문서 변환기를 시작하지 못했습니다.'));
  });
}

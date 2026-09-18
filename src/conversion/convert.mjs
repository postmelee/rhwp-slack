import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {workerEnvironment} from './worker-env.mjs';
import {readFrames,OutputError,MAX_PDF_BYTES} from './frames.mjs';
export {MAX_PDF_BYTES,MAX_PNG_BYTES,MAX_PNG_TOTAL_BYTES,MAX_PREVIEW_PAGES} from './frames.mjs';
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
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<1||end<start||end>10)return Promise.reject(new Error('미리보기 페이지 범위가 올바르지 않습니다.'));
  return convert(bytes,options,'images',start,end);
}
function convert(bytes,{timeoutMs=60_000,onMetric,signal,onPdf,onPage}={},mode,start,end){
  return new Promise((resolveResult,reject)=>{
    let child,browserServer,size=0,done=false,stage='browser_start',pendingMetrics='',childStarted=false,spawnedAt=0;const chunks=[];
    const metric=value=>{const clean=validMetric(value);if(!clean)return;if(clean.phase==='start')stage=clean.stage;try{onMetric?.(clean);}catch{}};
    const started=performance.now();metric({stage,phase:'start'});
    const limit=MAX_PDF_BYTES;
    const killGroup=pid=>{if(!pid)return;try{process.kill(process.platform==='win32'?pid:-pid,'SIGKILL');}catch{}};
    const cleanup=()=>{signal?.removeEventListener('abort',abort);killGroup(child?.pid);killGroup(browserServer?.process().pid);void browserServer?.close().catch(()=>{});};
    const fail=(message,code='conversion_start')=>{if(done)return;done=true;clearTimeout(timer);cleanup();reject(new ConversionError(code,message,stage));};
    const timer=setTimeout(()=>fail('문서 변환 시간이 초과되었습니다.','conversion_timeout'),timeoutMs);
    const abort=()=>fail('문서 변환이 취소되었습니다.','conversion_aborted');
    signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted){abort();return;}
    void import('@playwright/test').then(({chromium})=>chromium.launchServer({headless:true,env:workerEnvironment(),host:'127.0.0.1',timeout:Math.min(10_000,timeoutMs)})).then(server=>{
      browserServer=server;if(done){cleanup();return;}
      metric({stage:'browser_start',phase:'finish',durationMs:Math.round(performance.now()-started)});
      spawnedAt=performance.now();metric({stage:'process_start',phase:'start'});
      child=spawn(process.execPath,[resolve('.cache/conversion/pdf-child.mjs'),mode,String(start),String(end)],{
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
      const closed=new Promise(resolve=>child.on('close',resolve));
      void (async()=>{
        let result;
        if(mode==='pdf'){
          for await(const chunk of child.stdout){size+=chunk.length;if(size>limit)throw new OutputError();chunks.push(chunk);}
          result=Buffer.concat(chunks);if(result.subarray(0,5).toString()!=='%PDF-')throw new OutputError();
        }else result=await readFrames(child.stdout,mode,start,end,{onPdf,onPage});
        const code=await closed;if(done)return;
        if(code!==0)throw new ConversionError('conversion_child','문서 변환에 실패했습니다.',stage);
        done=true;clearTimeout(timer);cleanup();resolveResult(result);
      })().catch(error=>{
        if(done)return;done=true;clearTimeout(timer);cleanup();
        reject(error instanceof OutputError?new ConversionError('conversion_output','문서 변환 결과를 확인할 수 없습니다.',stage):error);
      });
      child.stdin.end(bytes);
    }).catch(()=>fail('문서 변환기를 시작하지 못했습니다.'));
  });
}

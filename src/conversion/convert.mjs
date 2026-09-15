import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
export const MAX_PDF_BYTES=50*1024*1024;
export function convertPdf(bytes, {timeoutMs=60_000}={}) {
  return new Promise((resolveResult,reject)=>{
    let child,browserServer,size=0,done=false;const chunks=[];
    const killGroup=pid=>{if(!pid)return;try{process.kill(process.platform==='win32'?pid:-pid,'SIGKILL');}catch{}};
    const cleanup=()=>{killGroup(child?.pid);killGroup(browserServer?.process().pid);void browserServer?.close().catch(()=>{});};
    const fail=message=>{if(done)return;done=true;clearTimeout(timer);cleanup();reject(new Error(message));};
    const timer=setTimeout(()=>fail('PDF 변환 시간이 초과되었습니다.'),timeoutMs);
    // The supervisor owns Chromium as well as the parser, including their separate process groups.
    void chromium.launchServer({headless:true,host:'127.0.0.1',timeout:Math.min(10_000,timeoutMs)}).then(server=>{
      browserServer=server;if(done){cleanup();return;}
      child=spawn(process.execPath,['--import','tsx',resolve('src/conversion/pdf-child.mjs')],{
        detached:process.platform!=='win32',stdio:['pipe','pipe','pipe'],
        env:{...process.env,RHWP_PDF_BROWSER_WS:server.wsEndpoint()},
      });
      child.on('error',()=>fail('PDF 변환기를 시작하지 못했습니다.'));
      child.stdin.on('error',()=>{});child.stderr.resume();
      child.stdout.on('data',chunk=>{size+=chunk.length;if(size>MAX_PDF_BYTES)fail('PDF가 50 MiB를 초과합니다.');else chunks.push(chunk);});
      child.on('close',code=>{
        if(done)return;done=true;clearTimeout(timer);cleanup();const pdf=Buffer.concat(chunks);
        if(code!==0||pdf.subarray(0,5).toString()!=='%PDF-')reject(new Error('PDF 변환에 실패했습니다. 지원되는 HWP/HWPX인지 확인하세요.'));
        else resolveResult(pdf);
      });
      child.stdin.end(bytes);
    }).catch(()=>fail('PDF 변환기를 시작하지 못했습니다.'));
  });
}

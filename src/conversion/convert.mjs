import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import {workerEnvironment} from './worker-env.mjs';
export const MAX_PDF_BYTES=50*1024*1024;
export const MAX_PNG_BYTES=5*1024*1024;
export function convertPdf(bytes, options={}) {return convert(bytes,options,false);}
export function convertPreview(bytes, options={}) {return convert(bytes,options,true);}
function convert(bytes, {timeoutMs=60_000}={}, preview) {
  return new Promise((resolveResult,reject)=>{
    let child,browserServer,size=0,done=false;const chunks=[];
    const killGroup=pid=>{if(!pid)return;try{process.kill(process.platform==='win32'?pid:-pid,'SIGKILL');}catch{}};
    const cleanup=()=>{killGroup(child?.pid);killGroup(browserServer?.process().pid);void browserServer?.close().catch(()=>{});};
    const fail=message=>{if(done)return;done=true;clearTimeout(timer);cleanup();reject(new Error(message));};
    const timer=setTimeout(()=>fail('PDF 변환 시간이 초과되었습니다.'),timeoutMs);
    // The supervisor owns Chromium as well as the parser, including their separate process groups.
    void chromium.launchServer({headless:true,env:workerEnvironment(),host:'127.0.0.1',timeout:Math.min(10_000,timeoutMs)}).then(server=>{
      browserServer=server;if(done){cleanup();return;}
      child=spawn(process.execPath,['--import','tsx',resolve('src/conversion/pdf-child.mjs'),...(preview?['--preview']:[])],{
        detached:process.platform!=='win32',stdio:['pipe','pipe','pipe'],
        env:{...workerEnvironment(),RHWP_PDF_BROWSER_WS:server.wsEndpoint()},
      });
      child.on('error',()=>fail('PDF 변환기를 시작하지 못했습니다.'));
      child.stdin.on('error',()=>{});child.stderr.resume();
      child.stdout.on('data',chunk=>{size+=chunk.length;if(size>MAX_PDF_BYTES+(preview?MAX_PNG_BYTES+8:0))fail('PDF가 50 MiB를 초과합니다.');else chunks.push(chunk);});
      child.on('close',code=>{
        if(done)return;done=true;clearTimeout(timer);cleanup();const output=Buffer.concat(chunks);
        const length=preview&&output.length>=8?output.readUInt32BE(0):0;
        const imageLength=preview&&output.length>=8?output.readUInt32BE(4):0;
        const pdf=preview?output.subarray(8,8+length):output;
        const png=preview?output.subarray(8+length):undefined;
        if(preview&&(length>MAX_PDF_BYTES||imageLength>MAX_PNG_BYTES||length+imageLength+8!==output.length||png.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')){reject(new Error('미리보기 변환에 실패했습니다.'));return;}
        if(code!==0||pdf.subarray(0,5).toString()!=='%PDF-')reject(new Error('PDF 변환에 실패했습니다. 지원되는 HWP/HWPX인지 확인하세요.'));
        else resolveResult(preview?{pdf,png}:pdf);
      });
      child.stdin.end(bytes);
    }).catch(()=>fail('PDF 변환기를 시작하지 못했습니다.'));
  });
}

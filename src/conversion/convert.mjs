import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {chromium} from '@playwright/test';
import {workerEnvironment} from './worker-env.mjs';
export const MAX_PDF_BYTES=50*1024*1024;
export const MAX_PNG_BYTES=5*1024*1024;
export const MAX_PNG_TOTAL_BYTES=25*1024*1024;
export const MAX_PREVIEW_PAGES=10;
const PNG_SIGNATURE='89504e470d0a1a0a';
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
function convert(bytes,{timeoutMs=60_000}={},mode,start,end){
  return new Promise((resolveResult,reject)=>{
    let child,browserServer,size=0,done=false;const chunks=[];
    const limit=MAX_PDF_BYTES+(mode==='pdf'?0:MAX_PNG_TOTAL_BYTES+4100);
    const killGroup=pid=>{if(!pid)return;try{process.kill(process.platform==='win32'?pid:-pid,'SIGKILL');}catch{}};
    const cleanup=()=>{killGroup(child?.pid);killGroup(browserServer?.process().pid);void browserServer?.close().catch(()=>{});};
    const fail=message=>{if(done)return;done=true;clearTimeout(timer);cleanup();reject(new Error(message));};
    const timer=setTimeout(()=>fail('문서 변환 시간이 초과되었습니다.'),timeoutMs);
    void chromium.launchServer({headless:true,env:workerEnvironment(),host:'127.0.0.1',timeout:Math.min(10_000,timeoutMs)}).then(server=>{
      browserServer=server;if(done){cleanup();return;}
      child=spawn(process.execPath,['--import','tsx',resolve('src/conversion/pdf-child.mjs'),mode,String(start),String(end)],{
        detached:process.platform!=='win32',stdio:['pipe','pipe','pipe'],env:{...workerEnvironment(),RHWP_PDF_BROWSER_WS:server.wsEndpoint()},
      });
      child.on('error',()=>fail('문서 변환기를 시작하지 못했습니다.'));child.stdin.on('error',()=>{});child.stderr.resume();
      child.stdout.on('data',chunk=>{size+=chunk.length;if(size>limit)fail('변환 결과가 용량 제한을 초과했습니다.');else chunks.push(chunk);});
      child.on('close',code=>{
        if(done)return;done=true;clearTimeout(timer);cleanup();
        try{if(code!==0)throw new Error('child');resolveResult(decode(Buffer.concat(chunks),mode,start,end));}
        catch{reject(new Error('문서 변환에 실패했습니다. 지원되는 HWP/HWPX와 페이지 범위인지 확인하세요.'));}
      });child.stdin.end(bytes);
    }).catch(()=>fail('문서 변환기를 시작하지 못했습니다.'));
  });
}

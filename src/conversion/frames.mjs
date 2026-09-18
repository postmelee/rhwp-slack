export const MAX_PDF_BYTES=50*1024*1024;
export const MAX_PNG_BYTES=5*1024*1024;
export const MAX_PNG_TOTAL_BYTES=25*1024*1024;
export const MAX_PREVIEW_PAGES=10;
export class OutputError extends Error {}
const invalid=()=>{throw new OutputError('Invalid conversion output');};
export async function readFrames(stream,mode,start,end,{onPdf,onPage}={}){
  const iterator=stream[Symbol.asyncIterator]();let pending=Buffer.alloc(0),total=0;
  async function next(){
    const r=await iterator.next();if(r.done)return false;
    pending=Buffer.from(r.value);total+=pending.length;
    if(total>MAX_PDF_BYTES+MAX_PNG_TOTAL_BYTES+64*1024)invalid();return true;
  }
  async function read(size){
    const chunks=[];let received=0;
    while(received<size){
      if(!pending.length&&!await next())invalid();
      const count=Math.min(size-received,pending.length);chunks.push(pending.subarray(0,count));pending=pending.subarray(count);received+=count;
    }
    return Buffer.concat(chunks,size);
  }
  async function header(){
    const length=(await read(4)).readUInt32BE();if(length<2||length>4096)invalid();
    try{return JSON.parse((await read(length)).toString('utf8'));}catch{invalid();}
  }
  const info=await header();
  if(info?.type!=='document'||!Number.isSafeInteger(info.pageCount)||info.pageCount<1||info.pageCount>200)invalid();
  const pageCount=info.pageCount,pages=[];let pdf;
  if(mode==='preview'){
    const frame=await header();if(frame?.type!=='pdf'||!Number.isSafeInteger(frame.bytes)||frame.bytes<5||frame.bytes>MAX_PDF_BYTES)invalid();
    pdf=await read(frame.bytes);if(pdf.subarray(0,5).toString()!=='%PDF-')invalid();
    await onPdf?.(pdf,pageCount);
  }else if(mode!=='images')invalid();
  let pngBytes=0;
  for(let page=start;page<=Math.min(end,pageCount);page++){
    const frame=await header();
    if(frame?.type!=='png'||frame.page!==page||!Number.isSafeInteger(frame.bytes)||frame.bytes<8||frame.bytes>MAX_PNG_BYTES)invalid();
    pngBytes+=frame.bytes;if(pngBytes>MAX_PNG_TOTAL_BYTES)invalid();
    const png=await read(frame.bytes);if(png.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')invalid();
    const image={page,png};pages.push(image);await onPage?.(image,pageCount);
  }
  if((await header())?.type!=='end'||pending.length)invalid();
  while(await next())if(pending.length)invalid();
  return mode==='preview'?{pdf,pageCount,pages}:{pageCount,pages};
}

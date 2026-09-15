import { MAX_FILE_BYTES } from '../shared/errors';
import './style.css';
import {showPdf,clearPdf} from './pdf-reader';
const status=document.querySelector<HTMLElement>('#status')!;
const input=document.querySelector<HTMLInputElement>('#file')!;
const edit=document.querySelector<HTMLAnchorElement>('#edit')!;
const download=document.querySelector<HTMLAnchorElement>('#download')!;
const title=document.querySelector<HTMLElement>('#document-name')!;
let pdfUrl:string|undefined;
function clear(){if(pdfUrl)URL.revokeObjectURL(pdfUrl);pdfUrl=undefined;clearPdf();edit.hidden=download.hidden=true;edit.removeAttribute('href');download.removeAttribute('href');title.textContent='문서 보기';title.title='';}
async function openDocument(id:string){
  const base='/api/dev/documents/'+encodeURIComponent(id);
  const [meta,response]=await Promise.all([fetch(base),fetch(base+'/pdf')]);
  if(!meta.ok||!response.ok)throw new Error('문서가 만료되었습니다. 다시 열어 주세요.');
  const {name}=await meta.json();const bytes=await response.arrayBuffer();
  if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw new Error('PDF 응답을 확인하지 못했습니다.');
  pdfUrl=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
  await showPdf(bytes);
  title.textContent=name;title.title=name;edit.href='/editor/#document='+encodeURIComponent(id);edit.hidden=false;
  download.href=pdfUrl;download.download=name.replace(/\.(hwp|hwpx)$/i,'')+'.pdf';download.hidden=false;
  status.textContent='원본 문서의 PDF입니다. 편집하려면 문서 편집을 선택하세요.';
  document.querySelector<HTMLDetailsElement>('#local')!.open=false;
}
if(__LOCAL_FILES__){
  document.querySelector<HTMLElement>('#local')!.hidden=false;status.textContent='테스트 문서를 선택하세요.';
  input.addEventListener('change',()=>{
    const file=input.files?.[0];if(!file)return;
    clear();input.disabled=true;status.textContent='PDF를 준비하고 있습니다.';
    void (async()=>{
      if(file.size>MAX_FILE_BYTES)throw new Error('20 MiB 이하 문서만 열 수 있습니다.');
      const response=await fetch('/api/dev/documents',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-Document-Name':encodeURIComponent(file.name)},body:file});
      const result=await response.json();if(!response.ok)throw new Error(result.error);
      await openDocument(result.id);
    })().catch(error=>{clear();status.textContent=error instanceof Error?error.message:'문서를 열지 못했습니다.';})
      .finally(()=>{input.disabled=false;input.value='';});
  });
}
window.addEventListener('pagehide',()=>{if(pdfUrl)URL.revokeObjectURL(pdfUrl);clearPdf();});

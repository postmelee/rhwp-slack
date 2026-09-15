import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type PDFDocumentLoadingTask, type RenderTask } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
GlobalWorkerOptions.workerSrc=workerUrl;
const root=document.querySelector<HTMLElement>('#pdf')!;
const canvas=document.querySelector<HTMLCanvasElement>('#pdf-canvas')!;
const previous=document.querySelector<HTMLButtonElement>('#previous')!;
const next=document.querySelector<HTMLButtonElement>('#next')!;
const counter=document.querySelector<HTMLElement>('#page-counter')!;
let pdf:PDFDocumentProxy|undefined,pageNumber=1,version=0;
let loadingTask:PDFDocumentLoadingTask|undefined;
let task:RenderTask|undefined,rendering=Promise.resolve();
function render(){
  const epoch=version,doc=pdf;if(!doc)return Promise.resolve();
  task?.cancel();
  rendering=rendering.catch(()=>{}).then(async()=>{
    if(epoch!==version)return;
    previous.disabled=next.disabled=true;
    const page=await doc.getPage(pageNumber);
    if(epoch!==version)return;
    const initial=page.getViewport({scale:1});
    const scale=Math.min(1.5,Math.max(.1,(root.clientWidth-32)/initial.width));
    const ratio=Math.min(2,devicePixelRatio||1);
    const viewport=page.getViewport({scale});
    canvas.width=Math.ceil(viewport.width*ratio);canvas.height=Math.ceil(viewport.height*ratio);
    canvas.style.width=viewport.width+'px';canvas.style.height=viewport.height+'px';
    task=page.render({canvas,viewport,transform:ratio===1?undefined:[ratio,0,0,ratio,0,0]});
    await task.promise;
    if(epoch!==version)return;
    const text=await page.getTextContent();
    canvas.setAttribute('aria-label',text.items.map(item=>'str' in item?item.str:'').join(' ').slice(0,4000));
    counter.textContent=`${pageNumber} / ${doc.numPages}쪽`;
    previous.disabled=pageNumber<=1;next.disabled=pageNumber>=doc.numPages;
    page.cleanup();
  });
  return rendering;
}
export async function showPdf(bytes:ArrayBuffer){
  clearPdf();const epoch=version;
  const loading=getDocument({data:new Uint8Array(bytes),useSystemFonts:false,
    cMapUrl:'/viewer/pdfjs/cmaps/',cMapPacked:true,standardFontDataUrl:'/viewer/pdfjs/standard_fonts/',wasmUrl:'/viewer/pdfjs/wasm/'});
  loadingTask=loading;
  const doc=await loading.promise;
  if(epoch!==version){await loading.destroy();return;}
  pdf=doc;root.hidden=false;pageNumber=1;await render();
}
export function clearPdf(){version++;task?.cancel();task=undefined;void loadingTask?.destroy().catch(()=>{});loadingTask=undefined;pdf=undefined;root.hidden=true;canvas.width=canvas.height=0;counter.textContent='';canvas.removeAttribute('aria-label');}
function report(error:unknown){if(error instanceof Error&&error.name==='RenderingCancelledException')return;document.querySelector<HTMLElement>('#status')!.textContent='PDF 페이지를 표시하지 못했습니다. PDF 받기로 파일을 확인해 주세요.';}
previous.addEventListener('click',()=>{if(pdf&&pageNumber>1){pageNumber--;void render().catch(report);}});
next.addEventListener('click',()=>{if(pdf&&pageNumber<pdf.numPages){pageNumber++;void render().catch(report);}});
let resizeTimer:ReturnType<typeof setTimeout>;
window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{void render().catch(report);},150);});

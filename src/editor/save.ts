import type {RhwpEditor,RhwpDocumentStateV1} from '@rhwp/editor';
import {EditorApiError} from './reconnect';
import {validateInput,MAX_PAGES} from '../shared/errors';
type State=RhwpDocumentStateV1;
interface Attempt {id:string;state:State;bytes:Uint8Array;}
interface Receipt {saved:boolean;pdf:'pending'|'ready'|'failed';}
export function attachSave(studio:RhwpEditor,api:(path:string,init?:RequestInit)=>Promise<Response>,options:{reconnect?:()=>Promise<void>;name?:string}={}):void {
  const panel=document.createElement('section');panel.id='slack-save';panel.setAttribute('aria-label','Slack에 편집본 저장');
  const message=document.createElement('p');message.setAttribute('role','status');message.textContent='편집본은 새 파일로 저장됩니다.';
  const button=document.createElement('button');button.id='save-to-slack';button.type='button';button.textContent='편집본을 Slack에 저장';
  panel.append(message,button);document.body.append(panel);
  let attempt:Attempt|undefined;let saving=false;let generation=0;let reconnecting=false;
  const login=document.createElement('button');login.type='button';login.id='reconnect-slack';login.textContent='다시 로그인';login.hidden=true;
  const download=document.createElement('button');download.type='button';download.id='download-edits';download.textContent='현재 편집본 다운로드';download.hidden=true;
  panel.append(login,download);
  let documentDirty=false;let announcement=message.textContent;
  const report=(text:string)=>{announcement=text;message.textContent=text+(documentDirty?' 현재 변경은 미저장입니다.':'');};
  login.addEventListener('click',()=>{
    if(!options.reconnect||saving||reconnecting)return;
    reconnecting=true;login.disabled=true;button.disabled=true;report('별도 창에서 Slack에 다시 로그인해 주세요. 이 편집창은 닫지 마세요.');
    // Call synchronously during the user gesture so the browser permits the popup.
    let connection:Promise<void>;
    try{connection=options.reconnect();}catch(error){connection=Promise.reject(error);}
    void connection.then(()=>{login.hidden=true;report('다시 연결했습니다. 저장 버튼을 눌러 편집본을 저장해 주세요.');},error=>report(error instanceof Error?error.message:'다시 로그인하지 못했습니다.')).finally(()=>{reconnecting=false;login.disabled=false;button.disabled=false;});
  });
  download.addEventListener('click',()=>{void(async()=>{
    download.disabled=true;
    try{
      const before=await studio.getDocumentState(),bytes=before.format==='hwpx'?await studio.exportHwpx():await studio.exportHwp();validateInput(bytes);
      if(!same(before,await studio.getDocumentState()))throw new Error('내보내는 동안 변경되었습니다. 다시 다운로드해 주세요.');
      const url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'application/octet-stream'}));
      const link=document.createElement('a');link.href=url;link.download=(options.name??'문서').replace(/\.(hwp|hwpx)$/i,'').replace(/[\/\\:*?"<>|]/g,'_')+'_편집본.'+before.format;link.click();setTimeout(()=>URL.revokeObjectURL(url),30_000);
      report('현재 편집본을 다운로드했습니다. Slack에는 아직 저장되지 않았습니다.');
    }catch(error){report(error instanceof Error?error.message:'다운로드하지 못했습니다.');}finally{download.disabled=false;}
  })();});
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==studio.element.contentWindow||event.data?.type!=='rhwp-slack:dirty'||typeof event.data.dirty!=='boolean')return;
    documentDirty=event.data.dirty;report(announcement);
  });
  const same=(a:State,b:State)=>a.documentEpoch===b.documentEpoch&&a.changeSeq===b.changeSeq&&a.documentSha256===b.documentSha256;
  async function pdfStatus(id:string,receipt:Receipt,version:number):Promise<void> {
    for(let i=0;i<30&&receipt.pdf==='pending';i++){
      await new Promise(resolve=>setTimeout(resolve,3000));if(version!==generation)return;
      try{receipt=await(await api('saves/'+id)).json();}catch{if(version===generation)report('편집본 저장 완료. PDF 상태는 Slack에서 확인하세요.');return;}
    }
    if(version!==generation)return;
    report(receipt.pdf==='ready'?'편집본과 PDF를 Slack에 저장했습니다.':receipt.pdf==='failed'?'편집본 저장 완료 · PDF 생성 실패.':'편집본 저장 완료 · PDF 준비 중. Slack에서 확인하세요.');
  }
  button.addEventListener('click',()=>{void(async()=>{
    if(saving||reconnecting)return;saving=true;button.disabled=true;const version=++generation;
    try{
      if(!attempt){
        const before=await studio.getDocumentState();if(before.pageCount>MAX_PAGES)throw new Error('200페이지 이하 문서만 저장할 수 있습니다.');
        const bytes=before.format==='hwpx'?await studio.exportHwpx():await studio.exportHwp();validateInput(bytes);
        const after=await studio.getDocumentState();if(!same(before,after))throw new Error('내보내는 동안 문서가 변경되었습니다. 다시 저장해 주세요.');
        attempt={id:crypto.randomUUID(),state:before,bytes};
      }
      report('편집본을 Slack에 저장하는 중…');
      const current=attempt;
      const result:Receipt=await(await api('save',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-Save-Request-Id':current.id,'X-Document-Format':current.state.format},body:new Uint8Array(current.bytes)})).json();
      if(!result.saved)throw new Error('저장 결과를 확인하지 못했습니다. 같은 요청으로 다시 확인해 주세요.');
      // The check and markClean execute in one Studio task, with no RPC gap between them.
      const host=studio.element.contentWindow as (Window & {rhwpStudio?:{notifySavedIfUnchanged:(state:State)=>Promise<boolean>}})|null;
      const acknowledged=await host?.rhwpStudio?.notifySavedIfUnchanged(current.state);
      attempt=undefined;button.textContent='편집본을 Slack에 저장';
      report(acknowledged?'편집본 저장 완료 · PDF 준비 중.':'편집본 저장 완료 · 이후 변경은 아직 저장되지 않았습니다.');
      void pdfStatus(current.id,result,version);
    }catch(error){report(error instanceof Error?error.message:'저장에 실패했습니다.');if(attempt)button.textContent='같은 저장 요청 다시 확인';download.hidden=false;if(error instanceof EditorApiError&&error.code==='session_expired'&&options.reconnect){login.hidden=false;report('편집 연결이 만료되었습니다. 다시 로그인하면 이 창의 편집 내용을 유지한 채 저장을 재시도할 수 있습니다.');}}
    finally{saving=false;button.disabled=false;}
  })();});
}

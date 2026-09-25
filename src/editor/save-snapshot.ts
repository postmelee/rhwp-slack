import type {RhwpEditor,RhwpDocumentStateV1} from '@rhwp/editor';
import {validateInput,MAX_PAGES} from '../shared/errors';

export interface SaveSnapshot {state:RhwpDocumentStateV1;bytes:Uint8Array;}

export async function captureSaveSnapshot(studio:RhwpEditor):Promise<SaveSnapshot>{
  const host=studio.element.contentWindow as (Window & {rhwpStudio?:{captureSlackSave?:()=>SaveSnapshot}})|null;
  if(!host?.rhwpStudio?.captureSlackSave)throw new Error('편집기를 새로 열어 저장을 다시 시도해 주세요.');
  const snapshot=host.rhwpStudio.captureSlackSave();
  validateInput(snapshot.bytes);
  if(snapshot.state.pageCount>MAX_PAGES)throw new Error('200페이지 이하 문서만 저장할 수 있습니다.');
  // Verify the actual artifact, not a pre-export hash whose saved caret may differ.
  const bytes=new Uint8Array(snapshot.bytes);
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  const sha=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
  if(sha!==snapshot.state.documentSha256)throw new Error('내보낸 문서 상태를 확인하지 못했습니다. 다시 저장해 주세요.');
  return {state:snapshot.state,bytes};
}

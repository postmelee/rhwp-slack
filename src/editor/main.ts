import { createStudio, type RhwpEditor } from '@rhwp/editor';
import { validateInput, MAX_PAGES, MAX_FILE_BYTES } from '../shared/errors';
import './style.css';
const status = document.querySelector<HTMLElement>('#status')!;
const nameLabel = document.querySelector<HTMLElement>('#document-name')!;
const input = document.querySelector<HTMLInputElement>('#file')!;
let studio: RhwpEditor;
let busy = false;
async function load(bytes: Uint8Array, name: string): Promise<void> {
  if (busy) throw new Error('문서를 여는 중입니다.');
  validateInput(bytes);
  busy = true; input.disabled = true; status.textContent = '문서를 여는 중입니다.';
  try {
    const result = await studio.loadFile(bytes, name);
    if (result.pageCount > MAX_PAGES) {
      studio.destroy(); throw new Error('200페이지 이하 문서만 열 수 있습니다. 편집기를 다시 열어 주세요.');
    }
    nameLabel.textContent = name.normalize('NFC'); nameLabel.title = name.normalize('NFC');
    status.dataset.error = 'false'; status.dataset.dirty = 'false'; status.textContent = '변경 없음';
  } finally { busy = false; input.disabled = false; }
}
try {
  studio = await createStudio('#editor', {
    studioUrl: new URL('/studio/?chrome=embed', location.origin).href,
    plugins: ['hwpctrl'], requestTimeoutMs: 60_000, handshakeTimeoutMs: 10_000,
  });
  studio.element.title = 'rhwp-studio 문서 편집기';
  status.textContent = 'Slack에서 문서 편집을 선택하세요.';
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin || event.source!==studio.element.contentWindow || event.data?.type!=='rhwp-slack:dirty' || typeof event.data.dirty!=='boolean')return;
    status.dataset.dirty=String(event.data.dirty);
    status.textContent=event.data.dirty?'저장하지 않은 변경 있음':'변경 없음';
  });
  if (__LOCAL_FILES__) {
    document.querySelector<HTMLElement>('#local')!.hidden = false;
    status.textContent = '문서를 선택하세요';
    input.addEventListener('change', () => {
      const file = input.files?.[0]; if (!file) return;
      if (file.size > MAX_FILE_BYTES) { status.textContent = '20 MiB 이하 문서만 열 수 있습니다.'; input.value = ''; return; }
      void file.arrayBuffer().then(bytes => load(new Uint8Array(bytes), file.name))
        .catch(error => { status.dataset.error = 'true'; status.textContent = error instanceof Error ? error.message : '문서를 열지 못했습니다.'; })
        .finally(() => { input.value = ''; });
    });
    // Dev build only: real SDK for integration tests; production has no file ingress yet.
    Object.assign(window, { __studio: studio, __loadDocument: load });
    const ticket = new URLSearchParams(location.hash.slice(1)).get('document');
    history.replaceState(null,'',location.pathname);
    if(ticket){
      const base='/api/dev/documents/'+encodeURIComponent(ticket);
      const [meta,response]=await Promise.all([fetch(base),fetch(base+'/source')]);
      if(!meta.ok||!response.ok)throw new Error('문서가 만료되었습니다. PDF 보기에서 다시 열어 주세요.');
      await load(new Uint8Array(await response.arrayBuffer()),(await meta.json()).name);
    }
  }
} catch (error) {
  status.dataset.error='true'; status.textContent = `편집기를 시작하지 못했습니다. ${error instanceof Error ? error.message : ''}`;
}

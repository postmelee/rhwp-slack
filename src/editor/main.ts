import { createStudio, type RhwpEditor } from '@rhwp/editor';
import { validateInput, MAX_PAGES, MAX_FILE_BYTES } from '../shared/errors';
import './style.css';

const status = document.querySelector<HTMLElement>('#status')!;
const input = document.querySelector<HTMLInputElement>('#file')!;
const local = document.querySelector<HTMLElement>('#local')!;
const devtools = __LOCAL_FILES__ && new URLSearchParams(location.search).get('devtools') === '1';
const ticket = __LOCAL_FILES__ ? new URLSearchParams(location.hash.slice(1)).get('document') : null;
// Consume the development ticket before loading the Studio iframe.
if (__LOCAL_FILES__) history.replaceState(null, '', location.pathname + location.search);
let studio: RhwpEditor;
let busy = false;
let documentName = '';

function setStatus(message: string, state: 'loading' | 'empty' | 'ready' | 'error'): void {
  status.textContent = message;
  document.body.dataset.state = state;
  local.hidden = !devtools || state === 'ready' || state === 'loading';
}
function showError(error: unknown): void {
  setStatus(error instanceof Error ? error.message : '문서를 열지 못했습니다.', 'error');
}
function setDirty(dirty: boolean): void {
  document.title = `${dirty ? '* ' : ''}${documentName} · rhwp`;
  status.dataset.dirty = String(dirty);
  setStatus(dirty ? '저장하지 않은 변경 있음' : '변경 없음', 'ready');
}
async function load(bytes: Uint8Array, name: string): Promise<void> {
  if (busy) throw new Error('문서를 여는 중입니다.');
  validateInput(bytes);
  busy = true;
  input.disabled = true;
  setStatus('문서를 여는 중입니다.', 'loading');
  try {
    const result = await studio.loadFile(bytes, name);
    if (result.pageCount > MAX_PAGES) {
      studio.destroy();
      throw new Error('200페이지 이하 문서만 열 수 있습니다. 편집기를 다시 열어 주세요.');
    }
    documentName = name.normalize('NFC');
    studio.element.title = `${documentName} · rhwp-studio 문서 편집기`;
    setDirty(false);
  } finally {
    busy = false;
    input.disabled = false;
  }
}
try {
  studio = await createStudio('#editor', {
    studioUrl: new URL('/studio/?chrome=embed', location.origin).href,
    plugins: ['hwpctrl'], requestTimeoutMs: 60_000, handshakeTimeoutMs: 10_000,
  });
  studio.element.title = 'rhwp-studio 문서 편집기';
  setStatus(devtools ? '문서를 선택하세요' : 'Slack에서 문서 열기를 선택하세요.', 'empty');
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== studio.element.contentWindow ||
        event.data?.type !== 'rhwp-slack:dirty' || typeof event.data.dirty !== 'boolean' ||
        busy || !documentName || document.body.dataset.state !== 'ready') return;
    setDirty(event.data.dirty);
  });
  if (__LOCAL_FILES__) {
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > MAX_FILE_BYTES) {
        showError(new Error('20 MiB 이하 문서만 열 수 있습니다.'));
        input.value = '';
        return;
      }
      void file.arrayBuffer().then(bytes => load(new Uint8Array(bytes), file.name))
        .catch(showError).finally(() => { input.value = ''; });
    });
    // Dev build only: actual SDK for integration tests, never a production file ingress.
    Object.assign(window, { __studio: studio, __loadDocument: load });
    if (ticket) {
      setStatus('문서를 여는 중입니다.', 'loading');
      const base = '/api/dev/documents/' + encodeURIComponent(ticket);
      const [meta, response] = await Promise.all([fetch(base), fetch(base + '/source')]);
      if (!meta.ok || !response.ok) throw new Error('문서가 만료되었습니다. Slack에서 문서 열기를 다시 선택하세요.');
      await load(new Uint8Array(await response.arrayBuffer()), (await meta.json()).name);
    }
  }
} catch (error) {
  showError(error);
}

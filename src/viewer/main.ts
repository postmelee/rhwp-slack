import { createStudio, type RhwpEditor } from '@rhwp/editor';
import { validateInput, MAX_PAGES, MAX_FILE_BYTES } from '../shared/errors';
import './style.css';
const status = document.querySelector<HTMLElement>('#status')!;
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
    status.textContent = `${name} · ${result.pageCount}페이지 · 편집 내용은 이 창에만 유지됩니다.`;
  } finally { busy = false; input.disabled = false; }
}
try {
  studio = await createStudio('#editor', {
    studioUrl: new URL('/studio/?chrome=embed', location.origin).href,
    plugins: ['hwpctrl'], requestTimeoutMs: 60_000, handshakeTimeoutMs: 10_000,
  });
  studio.element.title = 'rhwp-studio 문서 편집기';
  status.textContent = 'Slack에서 문서를 열어 주세요.';
  if (__LOCAL_FILES__) {
    document.querySelector<HTMLElement>('#local')!.hidden = false;
    status.textContent = '테스트 문서를 선택하세요. 편집 내용은 자동 저장되지 않습니다.';
    input.addEventListener('change', () => {
      const file = input.files?.[0]; if (!file) return;
      if (file.size > MAX_FILE_BYTES) { status.textContent = '20 MiB 이하 문서만 열 수 있습니다.'; input.value = ''; return; }
      void file.arrayBuffer().then(bytes => load(new Uint8Array(bytes), file.name))
        .catch(error => { status.textContent = error instanceof Error ? error.message : '문서를 열지 못했습니다.'; })
        .finally(() => { input.value = ''; });
    });
    // Dev build only: real SDK for integration tests; production has no file ingress yet.
    Object.assign(window, { __studio: studio, __loadDocument: load });
  }
} catch (error) {
  status.textContent = `편집기를 시작하지 못했습니다. ${error instanceof Error ? error.message : ''}`;
}

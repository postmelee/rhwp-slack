import { createStudio, type RhwpEditor } from '@rhwp/editor';
import { validateInput, MAX_PAGES, MAX_FILE_BYTES } from '../shared/errors';
import {attachSave} from './save';
import {Startup} from './startup';
import './style.css';

const status = document.querySelector<HTMLElement>('#status')!;
const input = document.querySelector<HTMLInputElement>('#file')!;
const local = document.querySelector<HTMLElement>('#local')!;
const devtools = __LOCAL_FILES__ && new URLSearchParams(location.search).get('devtools') === '1';
const ticket = __LOCAL_FILES__ ? new URLSearchParams(location.hash.slice(1)).get('document') : null;
const editorTicket = new URLSearchParams(location.hash.slice(1)).get('ticket');
// Remove credentials from the URL before any child frame is created.
history.replaceState(null, '', location.pathname + location.search);
// Deployment-owned HTML chooses the API; URL parameters and document data never do.
const configuredApi=document.querySelector<HTMLMetaElement>('meta[name="rhwp-api-origin"]')?.content;
const apiOrigin=configuredApi?new URL(configuredApi).origin:location.origin;
let bearer: string | undefined;
let startup:Startup|undefined;
const mark=(step:string)=>performance.mark('rhwp:'+step);
mark('host-start');
async function api(path: string, init: RequestInit = {}): Promise<Response> {
  if(['exchange','document','source'].includes(path))mark(path+'-start');
  const response = await fetch(apiOrigin+'/api/editor/' + path, {...init, credentials:'omit', cache:'no-store', referrerPolicy:'no-referrer', signal:AbortSignal.any([AbortSignal.timeout(90_000),...(startup?[startup.signal]:[])]), headers:{...init.headers, ...(bearer?{Authorization:'Bearer '+bearer}:{})}});
  if (!response.ok) throw new Error((await response.json().catch(()=>({}))).error || 'Slack 연결을 확인해 주세요.');
  if(['exchange','document','source'].includes(path))mark(path+'-headers');
  return response;
}
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
  mark('load-start');
  setStatus('문서를 여는 중입니다.', 'loading');
  try {
    const result = await (startup?startup.run(()=>studio.loadFile(bytes,name)):studio.loadFile(bytes,name));
    if (result.pageCount > MAX_PAGES) {
      studio.destroy();
      throw new Error('200페이지 이하 문서만 열 수 있습니다. 편집기를 다시 열어 주세요.');
    }
    documentName = name.normalize('NFC');
    studio.element.title = `${documentName} · rhwp-studio 문서 편집기`;
    setDirty(false);mark('document-ready');
  } finally {
    busy = false;
    input.disabled = false;
  }
}
async function initialize():Promise<void>{
  if(!editorTicket&&!__LOCAL_FILES__){
    setStatus('Slack에서 문서 열기를 선택하세요.','empty');
    document.querySelector<HTMLElement>('#reopen')!.hidden=false;return;
  }
  startup=new Startup();
  try {
  setStatus('Slack 문서 접근 권한을 확인하고 있습니다.','loading');
  if (editorTicket) bearer = (await (await api('exchange', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ticket:editorTicket})})).json()).token;
  setStatus('rhwp 편집기를 준비하고 있습니다.','loading');
  mark('studio-start');
  const studioReady = startup.run(()=>createStudio('#editor', {
    studioUrl: new URL(__STUDIO_BASE__+'?chrome=embed', location.origin).href,
    plugins: ['hwpctrl'], requestTimeoutMs: 60_000, handshakeTimeoutMs: 10_000,
  }),late=>late.destroy()).then(instance=>{studio=instance;studio.element.title='rhwp-studio 문서 편집기';mark('studio-ready');});
  // All rejections are observed immediately. Failure cancels requests and destroys even a late Studio.
  const documentReady = bearer ? Promise.all([
    api('document').then(async r=>{const value=await r.json();mark('metadata-ready');return value as {name:string};}),
    api('source').then(async r=>{const value=await r.arrayBuffer();mark('source-ready');return value;}),
  ]) : Promise.resolve(null);
  const [,sourceDocument]=await Promise.all([studioReady,documentReady]);
  if(!sourceDocument)setStatus(devtools ? '문서를 선택하세요' : 'Slack에서 문서 열기를 선택하세요.', 'empty');
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== studio.element.contentWindow ||
        event.data?.type !== 'rhwp-slack:dirty' || typeof event.data.dirty !== 'boolean' ||
        busy || !documentName || document.body.dataset.state !== 'ready') return;
    setDirty(event.data.dirty);
  });
  if (sourceDocument) {
    const [meta,bytes]=sourceDocument;
    await load(new Uint8Array(bytes), meta.name);
    attachSave(studio, api);mark('editor-ready');
  }
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
  startup.finish();startup=undefined;
  } catch (error) {
    const failure=startup?.signal.aborted?startup.signal.reason:error;
    startup?.cancel(failure);studio?.destroy();document.querySelector('#editor')!.replaceChildren();
    bearer=undefined;showError(failure);document.querySelector<HTMLElement>('#reopen')!.hidden=false;
  }
}
void initialize();

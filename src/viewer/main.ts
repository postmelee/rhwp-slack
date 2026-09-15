import './viewer.css';
import { Engine } from './engine';
import { sanitizeSvg } from './sanitize-svg';
import { MAX_FILE_BYTES } from '../shared/errors';
import { pageIndex, zoomValue } from '../shared/page-number';
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `<header><div class="brand"><span class="mark">한</span><strong>rhwp</strong><span class="divider"></span><span class="subtitle">한글 문서 보기</span></div><span class="private">내 브라우저에서 보기</span></header>
<section class="toolbar" aria-label="문서 도구"><div class="file-meta"><span class="file-icon">H</span><div><strong id="filename">문서를 기다리고 있습니다</strong><span id="filedetail">HWP · HWPX</span></div></div><div class="controls"><button id="prev" aria-label="이전 페이지" disabled>‹</button><div id="page-control"><input id="page" aria-label="페이지 번호" inputmode="numeric" value="1" disabled><span id="count">/ —</span></div><button id="next" aria-label="다음 페이지" disabled>›</button><span class="divider"></span><select id="zoom" aria-label="확대 배율" disabled><option value="50">50%</option><option value="75">75%</option><option value="100" selected>100%</option><option value="125">125%</option><option value="150">150%</option><option value="200">200%</option></select><button id="close" disabled>닫기</button></div></section>
<main id="workspace"><div id="empty"><span class="empty-icon">한</span><h1>한글 문서를 편하게 읽으세요</h1><p id="intro">Slack에서 문서 카드를 다시 열어 주세요.</p><div id="local"></div><p class="limit">HWP5 · HWPX / 최대 20 MiB · 200페이지</p></div><div id="paper" hidden></div></main><footer><span id="status" role="status" aria-live="polite">문서를 선택해 주세요.</span><span>읽기 전용</span></footer>`;
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const paper = el<HTMLDivElement>('paper');
const status = el<HTMLSpanElement>('status');
const page = el<HTMLInputElement>('page');
const zoom = el<HTMLSelectElement>('zoom');
let engine: Engine | undefined;
let generation = 0;
let rendering = 0;
let count = 0;
let current = 0;
let scale = 100;
function controls() {
  el<HTMLButtonElement>('prev').disabled = !count || current <= 0;
  el<HTMLButtonElement>('next').disabled = !count || current >= count - 1;
  page.disabled = zoom.disabled = !count;
  el<HTMLButtonElement>('close').disabled = !engine;
  page.value = String(current + 1);
  el('count').textContent = `/ ${count || '—'}`;
}
function reset() {
  generation++; rendering++; engine?.dispose(); engine = undefined; count = 0; current = 0;
  paper.replaceChildren(); paper.hidden = true; el('empty').hidden = false; controls();
}
function resize() {
  const svg = paper.querySelector('svg');
  if (!svg) return;
  paper.style.width = `${svg.viewBox.baseVal.width * scale / 100}px`;
  svg.style.width = '100%'; svg.style.height = 'auto';
}
async function show(index: number) {
  const owner = engine; const token = generation; const request = ++rendering;
  if (!owner) return;
  status.textContent = `${index + 1}페이지를 준비하고 있습니다…`;
  try {
    const source = await owner.render(index);
    if (token !== generation || request !== rendering) return;
    const svg = sanitizeSvg(source);
    paper.replaceChildren(svg); paper.hidden = false; el('empty').hidden = true;
    current = index; resize(); controls(); status.textContent = `${current + 1} / ${count}페이지`;
  } catch (error) {
    if (token !== generation || request !== rendering) return;
    reset(); status.textContent = error instanceof Error ? error.message : '문서를 표시하지 못했습니다.';
  }
}
async function openFile(file: File) {
  reset(); const token = generation;
  el('filename').textContent = file.name; el('filedetail').textContent = `${(file.size / 1024).toFixed(0)} KB · 읽기 전용`;
  status.textContent = '문서와 글꼴을 준비하고 있습니다…';
  try {
    if (file.size > MAX_FILE_BYTES) throw new Error('20 MiB 이하 문서만 열 수 있습니다.');
    const bytes = await file.arrayBuffer();
    if (token !== generation) return;
    engine = new Engine(); controls();
    const pages = await engine.open(bytes);
    if (token !== generation) return;
    count = pages;
    await show(0);
  } catch (error) {
    if (token !== generation) return;
    reset(); status.textContent = error instanceof Error ? error.message : '문서를 열지 못했습니다.';
  }
}
if (__LOCAL_FILES__) {
  el('intro').textContent = '파일을 선택하면 이 브라우저에서 문서를 엽니다.';
  el('local').innerHTML = '<label class="open-file">문서 선택<input type="file" accept=".hwp,.hwpx" aria-label="문서 선택"></label>';
  const input = el('local').querySelector('input')!;
  input.addEventListener('change', () => { if (input.files?.[0]) void openFile(input.files[0]); input.value = ''; });
} else {
  status.textContent = 'Slack 연결을 준비 중입니다. 문서 열기는 아직 사용할 수 없습니다.';
}
el('prev').addEventListener('click', () => void show(Math.max(0, current - 1)));
el('next').addEventListener('click', () => void show(Math.min(count - 1, current + 1)));
page.addEventListener('keydown', event => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  try { void show(pageIndex(page.value, count)); } catch (error) { status.textContent = (error as Error).message; }
});
zoom.addEventListener('change', () => { scale = zoomValue(Number(zoom.value)); resize(); });
el('close').addEventListener('click', () => { reset(); el('filename').textContent = '문서를 기다리고 있습니다'; el('filedetail').textContent = 'HWP · HWPX'; status.textContent = '문서를 닫았습니다.'; });
window.addEventListener('pagehide', reset);

if (__LOCAL_FILES__) void import('./testing');

import workerUrl from './engine.worker?worker&url';
import { loadUiFonts } from './fonts';
import { OPERATION_TIMEOUT_MS, ViewerError, validateInput } from '../shared/errors';
export class Engine {
  private worker?: Worker;
  private controller = new AbortController();
  private nextId = 0;
  private pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>();
  private cache = new Map<number, string>();
  private cacheBytes = 0;
  private disposed = false;
  constructor(private readonly timeout = OPERATION_TIMEOUT_MS) {}
  async open(bytes: ArrayBuffer): Promise<number> {
    validateInput(new Uint8Array(bytes));
    const base = new URL('vendor/', new URL('/viewer/', location.href)).href;
    const timer = setTimeout(() => this.dispose(new ViewerError('timeout', '문서 준비 시간이 초과되었습니다. 다시 열어 주세요.')), this.timeout);
    try {
      const response = await fetch(new URL(workerUrl, location.href), { signal: this.controller.signal });
      if (!response.ok) throw new Error('Worker unavailable');
      const code = await response.text();
      if (this.disposed) throw new ViewerError('cancelled', '문서 열기를 취소했습니다.');
      const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
      try { this.worker = new Worker(url); } finally { URL.revokeObjectURL(url); }
      this.worker.onmessage = ({ data }) => {
        const pending = this.pending.get(data.id);
        if (!pending) return;
        clearTimeout(pending.timer); this.pending.delete(data.id);
        if (data.error) pending.reject(new ViewerError('engine', data.error)); else pending.resolve(data.result);
      };
      this.worker.onerror = () => this.dispose(new ViewerError('worker', '문서 엔진이 중단되었습니다. 다시 열어 주세요.'));
      await Promise.all([loadUiFonts(base, this.controller.signal), this.call('init', { base })]);
    } catch (error) {
      this.dispose(); throw error;
    } finally { clearTimeout(timer); }
    return await this.call('open', { bytes }, [bytes]) as number;
  }
  async render(index: number): Promise<string> {
    const hit = this.cache.get(index);
    if (hit !== undefined) { this.cache.delete(index); this.cache.set(index, hit); return hit; }
    const svg = await this.call('render', { index }) as string;
    const size = new TextEncoder().encode(svg).byteLength;
    if (size <= 16 * 1024 * 1024) {
      const previous = this.cache.get(index);
      if (previous !== undefined) { this.cache.delete(index); this.cacheBytes -= new TextEncoder().encode(previous).byteLength; }
      while (this.cache.size >= 3 || this.cacheBytes + size > 16 * 1024 * 1024) {
        const [key, value] = this.cache.entries().next().value!;
        this.cache.delete(key); this.cacheBytes -= new TextEncoder().encode(value).byteLength;
      }
      this.cache.set(index, svg); this.cacheBytes += size;
    }
    return svg;
  }
  private call(type: string, payload: object, transfer: Transferable[] = []): Promise<unknown> {
    if (!this.worker || this.disposed) return Promise.reject(new ViewerError('cancelled', '문서 열기를 취소했습니다.'));
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.dispose(new ViewerError('timeout', '문서 처리 시간이 초과되었습니다. 다시 열어 주세요.')), this.timeout);
      this.pending.set(id, { resolve, reject, timer });
      this.worker!.postMessage({ id, type, ...payload }, transfer);
    });
  }
  dispose(reason = new ViewerError('cancelled', '문서 열기를 취소했습니다.')): void {
    this.disposed = true; this.controller.abort(reason);
    this.worker?.postMessage({ type: 'dispose' }); this.worker?.terminate(); this.worker = undefined;
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(reason); }
    this.pending.clear(); this.cache.clear(); this.cacheBytes = 0;
  }
}

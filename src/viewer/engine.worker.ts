import init, { HwpDocument } from '@rhwp/core';
import { MAX_PAGES, ViewerError, validateInput } from '../shared/errors';
declare const self: DedicatedWorkerGlobalScope;
let doc: HwpDocument | undefined;
self.onmessage = async ({ data }) => {
  const { id, type } = data;
  try {
    if (type === 'init') {
      // v0.8.6 lays out SVG with embedded metrics; no DOM/canvas callback is used.
      await init({ module_or_path: new URL('rhwp_bg.wasm', data.base) });
      self.postMessage({ id, result: true });
    } else if (type === 'open') {
      doc?.free(); doc = undefined;
      const bytes = new Uint8Array(data.bytes);
      validateInput(bytes);
      doc = new HwpDocument(bytes);
      const count = doc.pageCount();
      if (count < 1 || count > MAX_PAGES) { doc.free(); doc = undefined; throw new ViewerError('pages', '문서는 1~200페이지까지 열 수 있습니다.'); }
      self.postMessage({ id, result: count });
    } else if (type === 'render') {
      if (!doc || !Number.isInteger(data.index) || data.index < 0 || data.index >= doc.pageCount()) throw new Error('잘못된 페이지입니다.');
      self.postMessage({ id, result: doc.renderPageSvg(data.index) });
    } else if (type === 'dispose') {
      doc?.free(); doc = undefined; self.close();
    } else throw new Error('지원하지 않는 작업입니다.');
  } catch (error) {
    // Parser errors may contain document text. Send only a fixed public error.
    self.postMessage({ id, error: error instanceof ViewerError ? error.message : type === 'init' ? '문서 엔진을 준비하지 못했습니다.' : '문서를 열지 못했습니다. 손상·암호화·미지원 문서인지 확인하세요.' });
  }
};

import DOMPurify from 'dompurify';
import { fallbackFamily } from './fonts';
const properties = new Set(['fill','fill-opacity','fill-rule','stroke','stroke-width','stroke-opacity','stroke-dasharray','stroke-dashoffset','stroke-linecap','stroke-linejoin','stroke-miterlimit','opacity','font-family','font-size','font-weight','font-style','letter-spacing','word-spacing','text-anchor','text-decoration','dominant-baseline','alignment-baseline','white-space','clip-path','mask','filter','paint-order']);
const fragment = /^#[A-Za-z_][\w:.-]*$/;
function safeValue(value: string): boolean {
  // Reject escapes/comments so alternate spellings cannot hide CSS resource functions.
  if (/[\\@<>]|\/\*|expression\s*\(|var\s*\(/i.test(value)) return false;
  const rest = value.replace(/url\(\s*['"]?(#[\w:.-]+)['"]?\s*\)/gi, '');
  return !/url\s*\(|https?:|data:|javascript:/i.test(rest);
}
export function sanitizeSvg(source: string): SVGSVGElement {
  const clean = DOMPurify.sanitize(source, { USE_PROFILES: { svg: true, svgFilters: true }, FORBID_TAGS: ['style','a','foreignObject','animate','animateMotion','animateTransform','set','script'], RETURN_DOM_FRAGMENT: true });
  const root = clean.firstElementChild;
  if (!(root instanceof SVGSVGElement)) throw new Error('문서 화면을 표시하지 못했습니다.');
  for (const element of [root, ...root.querySelectorAll('*')]) {
    for (const attr of [...element.attributes]) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim();
      if (name === 'href' || name === 'xlink:href') {
        const raster = element.localName === 'image' && /^data:image\/(?:png|jpeg|gif|webp);base64,[a-z\d+/=\s]+$/i.test(value);
        if (!fragment.test(value) && !raster) element.removeAttributeNode(attr);
      } else if (name === 'style') {
        const input = document.createElement('span').style;
        input.cssText = value;
        const output = document.createElement('span').style;
        for (const property of input) {
          const val = input.getPropertyValue(property);
          if (properties.has(property) && safeValue(val)) output.setProperty(property, property === 'font-family' ? fallbackFamily(val) : val);
        }
        element.setAttribute('style', output.cssText);
      } else if (name === 'font-family') {
        element.setAttribute(name, fallbackFamily(value));
      } else if (!safeValue(value) || name.startsWith('on') || name === 'xml:base') {
        element.removeAttributeNode(attr);
      }
    }
  }
  const box = root.viewBox.baseVal;
  if (!(box.width > 0 && box.height > 0 && box.width <= 20000 && box.height <= 20000)) throw new Error('페이지 크기를 확인할 수 없습니다.');
  root.setAttribute('role', 'img'); root.setAttribute('aria-label', '한글 문서 페이지');
  return root;
}

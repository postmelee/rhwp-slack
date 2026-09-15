// One short-lived process per conversion. The parent enforces time/output limits.
import init, { HwpDocument } from '@rhwp/core';
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { validateInput, MAX_PAGES, MAX_FILE_BYTES } from '../shared/errors.ts';
import { createPrintPage } from '../../.cache/studio-source/rhwp-studio/src/command/print-pages.ts';
import { FONT_RULE_CANVAS2D_WEBFONT_RULES } from '../../.cache/studio-source/rhwp-studio/src/core/generated/font-rule-projections/webfont-supply.ts';
console.log=console.info=console.warn=()=>{};
let browser,doc;
try {
  const chunks=[];let size=0;
  for await (const chunk of process.stdin) {size+=chunk.length;if(size>MAX_FILE_BYTES)throw new Error('size');chunks.push(chunk);}
  const bytes=Buffer.concat(chunks);validateInput(bytes);
  await init({module_or_path:await readFile('node_modules/@rhwp/core/rhwp_bg.wasm')});
  doc=new HwpDocument(bytes);
  const count=doc.pageCount();if(count<1||count>MAX_PAGES)throw new Error('pages');
  const pages=[];let svgSize=0;
  for(let i=0;i<count;i++) {
    const svg=doc.renderPageSvgWithProfile(i,'print');svgSize+=Buffer.byteLength(svg);
    if(svgSize>100*1024*1024)throw new Error('svg-size');
    const info=JSON.parse(doc.getPageInfo(i));
    if(!Number.isFinite(info.width)||!Number.isFinite(info.height)||info.width<=0||info.height<=0||info.width>10000||info.height>10000)throw new Error('page-size');
    pages.push(createPrintPage(svg,info,i));
  }
  let fonts='';const seen=new Set();
  for(const rule of FONT_RULE_CANVAS2D_WEBFONT_RULES) {
    const f=rule.supply;if(!f||f.external||typeof f.sourceUrl!=='string'||!f.sourceUrl.startsWith('fonts/'))continue;
    const key=JSON.stringify([f.fontFamily,f.sourceUrl]);if(seen.has(key))continue;seen.add(key);
    const data=await readFile(resolve('.cache/studio-source/assets/fonts',basename(f.sourceUrl)));
    fonts+=`@font-face{font-family:${JSON.stringify(f.fontFamily)};src:url(data:font/woff2;base64,${data.toString('base64')}) format("woff2");}\n`;
  }
  if(!process.env.RHWP_PDF_BROWSER_WS)throw new Error('Missing conversion supervisor');
  browser=await chromium.connect(process.env.RHWP_PDF_BROWSER_WS);
  const context=await browser.newContext({serviceWorkers:'block'});
  await context.route('**/*',route=>route.abort());
  const page=await context.newPage();
  await page.setContent(`<html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; script-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'"></head><body></body></html>`);
  // Trusted pinned helper code via DevTools; document SVG never becomes script source.
  await page.evaluate((await readFile('.cache/conversion/print.js','utf8'))+';window.RhwpPrint=RhwpPrint;');
  await page.evaluate(({pages,fonts})=>{
    const style=document.createElement('style');style.textContent=fonts;document.head.append(style);
    window.RhwpPrint.appendPrintStyle(document,pages);
    for(const printPage of pages) {
      const xml=new DOMParser().parseFromString(printPage.svg,'image/svg+xml');
      if(xml.querySelector('parsererror'))throw new Error('Invalid SVG');
      for(const el of xml.querySelectorAll('script,foreignObject,iframe,object,embed,style,animate,animateTransform,set'))el.remove();
      for(const el of xml.querySelectorAll('*'))for(const attr of [...el.attributes]) {
        if(/^on/i.test(attr.name))el.removeAttribute(attr.name);
        if(/href$/i.test(attr.name)&&!attr.value.startsWith('#')&&!/^data:image\/(png|jpeg|gif|webp);base64,/i.test(attr.value))el.removeAttribute(attr.name);
      }
      const svg=new XMLSerializer().serializeToString(xml.documentElement);
      window.RhwpPrint.appendSvgPage(document,document.body,{...printPage,svg});
    }
  },{pages,fonts});
  await page.emulateMedia({media:'print'});
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(img=>img.decode().catch(()=>{})));});
  const pdf=await page.pdf({preferCSSPageSize:true,printBackground:true,displayHeaderFooter:false});
  process.stdout.write(pdf);
} catch { process.exitCode=1; }
finally {doc?.free();await browser?.close();}

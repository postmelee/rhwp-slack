// One short-lived process per conversion. The parent enforces time/output limits.
import init, { HwpDocument } from '@rhwp/core';
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import {writeSync} from 'node:fs';
import { resolve, basename } from 'node:path';
import { validateInput, MAX_PAGES, MAX_FILE_BYTES } from '../shared/errors.ts';
import { createPrintPage } from '../../.cache/studio-source/rhwp-studio/src/command/print-pages.ts';
import { FONT_RULE_CANVAS2D_WEBFONT_RULES } from '../../.cache/studio-source/rhwp-studio/src/core/generated/font-rule-projections/webfont-supply.ts';
console.log=console.info=console.warn=()=>{};
let browser,doc,stage='input',started=performance.now();
function metric(phase){try{writeSync(3,JSON.stringify({stage,phase,...(phase==='start'?{}:{durationMs:Math.round(performance.now()-started),rssBytes:process.memoryUsage().rss})})+'\n');}catch{}}
function begin(next){metric('finish');stage=next;started=performance.now();metric('start');}
metric('start');
const [mode='pdf',first='0',last='0']=process.argv.slice(2);
const start=Number(first),end=Number(last);
if(!['pdf','preview','images'].includes(mode)||(mode!=='pdf'&&(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<1||end<start||end>10)))throw new Error('range');
try {
  const chunks=[];let size=0;
  for await (const chunk of process.stdin) {size+=chunk.length;if(size>MAX_FILE_BYTES)throw new Error('size');chunks.push(chunk);}
  const bytes=Buffer.concat(chunks);validateInput(bytes);
  begin('wasm_init');
  await init({module_or_path:await readFile('node_modules/@rhwp/core/rhwp_bg.wasm')});
  begin('parse');
  doc=new HwpDocument(bytes);
  const count=doc.pageCount();if(count<1||count>MAX_PAGES)throw new Error('pages');
  begin('svg_render');
  const pages=[];let svgSize=0;
  for(let i=mode==='images'?start-1:0;i<(mode==='images'?Math.min(end,count):count);i++) {
    const svg=doc.renderPageSvgWithProfile(i,'print');svgSize+=Buffer.byteLength(svg);
    if(svgSize>100*1024*1024)throw new Error('svg-size');
    const info=JSON.parse(doc.getPageInfo(i));
    if(!Number.isFinite(info.width)||!Number.isFinite(info.height)||info.width<=0||info.height<=0||info.width>10000||info.height>10000)throw new Error('page-size');
    pages.push(createPrintPage(svg,info,i));
  }
  begin('fonts_prepare');
  let fonts='';const seen=new Set();
  for(const rule of FONT_RULE_CANVAS2D_WEBFONT_RULES) {
    const f=rule.supply;if(!f||f.external||typeof f.sourceUrl!=='string'||!f.sourceUrl.startsWith('fonts/'))continue;
    const key=JSON.stringify([f.fontFamily,f.sourceUrl]);if(seen.has(key))continue;seen.add(key);
    const data=await readFile(resolve('.cache/studio-source/assets/fonts',basename(f.sourceUrl)));
    fonts+=`@font-face{font-family:${JSON.stringify(f.fontFamily)};src:url(data:font/woff2;base64,${data.toString('base64')}) format("woff2");}\n`;
  }
  begin('browser_render');
  if(!process.env.RHWP_PDF_BROWSER_WS)throw new Error('Missing conversion supervisor');
  browser=await chromium.connect(process.env.RHWP_PDF_BROWSER_WS);
  const context=await browser.newContext({serviceWorkers:'block'});
  await context.route('**/*',route=>route.abort());
  const page=await context.newPage();
  begin('dom_prepare');
  await page.setContent(`<html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; script-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'"></head><body></body></html>`);
  // Trusted pinned helper code via DevTools; document SVG never becomes script source.
  await page.evaluate((await readFile('.cache/conversion/print.js','utf8'))+';window.RhwpPrint=RhwpPrint;');
  begin('page_attach');
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
  begin('fonts_ready');
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(img=>img.decode().catch(()=>{})));});
  begin('pdf');
  const pdf=mode==='images'?Buffer.alloc(0):await page.pdf({preferCSSPageSize:true,printBackground:true,displayHeaderFooter:false});
  if(pdf.length>50*1024*1024)throw new Error('pdf-size');
  if(mode==='pdf'){begin('output');process.stdout.write(pdf);}
  else {
    begin('png');
    const images=[];let total=0;
    for(let number=start;number<=Math.min(end,count);number++){
      const element=page.locator('.page').nth(mode==='images'?number-start:number-1);
      await element.evaluate(el=>{const rect=el.getBoundingClientRect();el.style.zoom=String(Math.min(1,800/rect.width,1200/rect.height));});
      const png=await element.screenshot({type:'png',timeout:10_000});total+=png.length;
      if(png.length>5*1024*1024||total>25*1024*1024)throw new Error('preview-size');
      images.push({page:number,png});
    }
    begin('output');
    const manifest=Buffer.from(JSON.stringify({pageCount:count,pdfBytes:pdf.length,pages:images.map(({page,png})=>({page,bytes:png.length}))}));
    const length=Buffer.alloc(4);length.writeUInt32BE(manifest.length);
    process.stdout.write(length);process.stdout.write(manifest);process.stdout.write(pdf);
    for(const {png} of images)process.stdout.write(png);
  }
  metric('finish');
} catch { metric('failed');process.exitCode=1; }
finally {doc?.free();await browser?.close();}

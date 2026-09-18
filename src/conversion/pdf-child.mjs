// One short-lived process per conversion. The parent enforces time/output limits.
import init, { HwpDocument } from '@rhwp/core';
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import {writeSync} from 'node:fs';
import {once} from 'node:events';
import { resolve } from 'node:path';
import {routeFont} from './font-routes.mjs';
import { validateInput, MAX_PAGES, MAX_FILE_BYTES } from '../shared/errors.ts';
import { createPrintPage } from '../../.cache/studio-source/rhwp-studio/src/command/print-pages.ts';
console.log=console.info=console.warn=()=>{};
let browser,doc,stage='input',started=performance.now();
function metric(phase){try{writeSync(3,JSON.stringify({stage,phase,...(phase==='start'?{}:{durationMs:Math.round(performance.now()-started),rssBytes:process.memoryUsage().rss})})+'\n');}catch{}}
function begin(next){metric('finish');stage=next;started=performance.now();metric('start');}
metric('start');
async function output(bytes){if(!process.stdout.write(bytes))await once(process.stdout,'drain');}
async function frame(info,bytes){
  const json=Buffer.from(JSON.stringify(info)),length=Buffer.alloc(4);length.writeUInt32BE(json.length);
  await output(length);await output(json);if(bytes)await output(bytes);
}
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
  for(let i=0;i<(mode==='images'?Math.min(end,count):count);i++) {
    // Preserve the preceding paper geometry for identical screenshot rounding on range retries.
    // Its document content need not be rendered again.
    const svg=mode==='images'&&i<start-1?'<svg xmlns="http://www.w3.org/2000/svg"/>':doc.renderPageSvgWithProfile(i,'print');svgSize+=Buffer.byteLength(svg);
    if(svgSize>100*1024*1024)throw new Error('svg-size');
    const info=JSON.parse(doc.getPageInfo(i));
    if(!Number.isFinite(info.width)||!Number.isFinite(info.height)||info.width<=0||info.height<=0||info.width>10000||info.height>10000)throw new Error('page-size');
    pages.push(createPrintPage(svg,info,i));
  }
  begin('fonts_prepare');
  const {css:fonts,files:fontFiles}=JSON.parse(await readFile('.cache/conversion/fonts.json','utf8'));
  begin('browser_render');
  if(!process.env.RHWP_PDF_BROWSER_WS)throw new Error('Missing conversion supervisor');
  browser=await chromium.connect(process.env.RHWP_PDF_BROWSER_WS);
  const context=await browser.newContext({serviceWorkers:'block'});
  await context.route('**/*',route=>routeFont(route,fontFiles,resolve('.cache/conversion/fonts')));
  const page=await context.newPage();
  begin('dom_prepare');
  await page.setContent(`<html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data: https://rhwp-fonts.invalid; script-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'"></head><body></body></html>`);
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
  if(mode==='pdf'){begin('output');await output(pdf);}
  else {
    await frame({type:'document',pageCount:count});
    if(mode==='preview')await frame({type:'pdf',bytes:pdf.length},pdf);
    begin('png');
    let total=0;
    for(let i=0;i<start-1;i++)await page.locator('.page').nth(i).evaluate(el=>{const rect=el.getBoundingClientRect();el.style.zoom=String(Math.min(1,800/rect.width,1200/rect.height));});
    for(let number=start;number<=Math.min(end,count);number++){
      const element=page.locator('.page').nth(number-1);
      await element.evaluate(el=>{const rect=el.getBoundingClientRect();el.style.zoom=String(Math.min(1,800/rect.width,1200/rect.height));});
      const png=await element.screenshot({type:'png',timeout:10_000});total+=png.length;
      if(png.length>5*1024*1024||total>25*1024*1024)throw new Error('preview-size');
      await frame({type:'png',page:number,bytes:png.length},png);
    }
    begin('output');
    await frame({type:'end'});
  }
  metric('finish');
} catch { metric('failed');process.exitCode=1; }
finally {doc?.free();await browser?.close();}

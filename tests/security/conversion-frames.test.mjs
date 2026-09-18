import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {readFrames,OutputError,MAX_PDF_BYTES,MAX_PNG_BYTES} from '../../src/conversion/frames.mjs';
const pdf=Buffer.from('%PDF-fixture'),png=Buffer.from('89504e470d0a1a0a','hex');
const frame=(h,b=Buffer.alloc(0))=>{const header=Buffer.from(JSON.stringify(h)),n=Buffer.alloc(4);n.writeUInt32BE(header.length);return Buffer.concat([n,header,b]);};
const info=()=>frame({type:'document',pageCount:2});
const pdfFrame=()=>frame({type:'pdf',bytes:pdf.length},pdf);
const pngFrame=(page=1)=>frame({type:'png',page,bytes:png.length},png);
const end=()=>frame({type:'end'});
const consume=b=>readFrames(Readable.from([b]),'preview',1,2);
test('bounded stream delivers a validated PDF before PNG production and handles split headers',async()=>{
 let delivered=false;
 async function* source(){
  const first=Buffer.concat([info(),pdfFrame()]);for(let i=0;i<first.length;i++)yield first.subarray(i,i+1);
  assert.equal(delivered,true);yield pngFrame();yield pngFrame(2);yield end();
 }
 const result=await readFrames(source(),'preview',1,2,{onPdf:async(bytes,count)=>{assert.deepEqual(bytes,pdf);assert.equal(count,2);delivered=true;}});
 assert.equal(result.pageCount,2);assert.deepEqual(result.pages.map(p=>p.page),[1,2]);
});
test('frames reject truncated, out-of-order, extra, oversized and invalid-signature output',async()=>{
 for(const bytes of [Buffer.alloc(0),Buffer.from([0,0,32,0]),frame({type:'document',pageCount:201}),
 Buffer.concat([info(),frame({type:'pdf',bytes:MAX_PDF_BYTES+1})]),
 Buffer.concat([info(),pdfFrame(),frame({type:'png',page:1,bytes:MAX_PNG_BYTES+1})]),
 Buffer.concat([info(),pdfFrame(),pngFrame(2)]),Buffer.concat([info(),pdfFrame(),pngFrame(),end()]),
 Buffer.concat([info(),pdfFrame(),pngFrame(),pngFrame(2),end(),Buffer.from('x')]),
 Buffer.concat([info(),frame({type:'pdf',bytes:5},Buffer.from('wrong'))]),
 Buffer.concat([info(),pdfFrame(),frame({type:'png',page:1,bytes:8},Buffer.alloc(8))])])await assert.rejects(consume(bytes),OutputError);
});
test('image-only retry can start after already uploaded pages and never accepts a PDF',async()=>{
 const stream=Readable.from([info(),pngFrame(2),end()]);
 assert.deepEqual((await readFrames(stream,'images',2,3)).pages.map(p=>p.page),[2]);
 await assert.rejects(readFrames(Readable.from([info(),pdfFrame()]),'images',2,3),OutputError);
});
test('callback failure stops consumption and keeps its typed error for retry classification',async()=>{
 const reason=Object.assign(new Error('upload failed'),{code:'upload_failed'});
 await assert.rejects(readFrames(Readable.from([info(),pdfFrame(),pngFrame(),pngFrame(2),end()]),'preview',1,2,{onPdf:async()=>{throw reason;}}),e=>e===reason);
});

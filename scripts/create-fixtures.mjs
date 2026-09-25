// Original synthetic document authored for rhwp-slack. Not a Hancom fidelity baseline.
// Run manually to regenerate fixture inputs; expected page contents below are authored independently.
import init, { HwpDocument } from '@rhwp/core';
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const imageOnly = process.argv.includes('--image-only');
const output = imageOnly ? await mkdtemp(join(tmpdir(), 'rhwp-slack-inline-')) : 'tests/fixtures';
await init({ module_or_path: await readFile('node_modules/@rhwp/core/rhwp_bg.wasm') });
const doc = HwpDocument.createEmpty();
function ok(result) { const value = JSON.parse(result); if (value.ok === false) throw new Error(result); return value; }
doc.createBlankDocument();
const heading = '한글 문서 미리보기';
ok(doc.insertText(0,0,0,heading));
ok(doc.applyCharFormat(0,0,0,heading.length,JSON.stringify({bold:true,fontSize:2000})));
let p = ok(doc.splitParagraph(0,0,heading.length)).paraIdx;
const intro = '첫 번째 페이지: 표와 한글을 확인합니다.';
ok(doc.insertText(0,p,0,intro));
ok(doc.applyCharFormat(0,p,0,intro.length,JSON.stringify({bold:false,fontSize:1100})));
p = ok(doc.splitParagraph(0,p,intro.length)).paraIdx;
const table = ok(doc.createTable(0,p,0,2,2));
for (const [cell,text] of ['항목','내용','상태','정상'].entries()) {
  ok(doc.insertTextInCell(0,table.paraIdx,table.controlIdx,cell,0,0,text));
  ok(doc.applyCharFormatInCell(0,table.paraIdx,table.controlIdx,cell,0,0,text.length,JSON.stringify({bold:false,fontSize:1100})));
}
p = doc.getParagraphCount(0)-1;
p = ok(doc.insertPageBreak(0,p,0)).paraIdx;
const second = '두 번째 페이지';
ok(doc.insertText(0,p,0,second));
ok(doc.applyCharFormat(0,p,0,second.length,JSON.stringify({bold:true,fontSize:2000})));
p = ok(doc.splitParagraph(0,p,second.length)).paraIdx;
const detail = '마지막 페이지: 초록색 그림과 English 123.';
ok(doc.insertText(0,p,0,detail));
ok(doc.applyCharFormat(0,p,0,detail.length,JSON.stringify({bold:false,fontSize:1100})));
p = ok(doc.splitParagraph(0,p,detail.length)).paraIdx;
const image = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAGAAAAAwCAYAAADuFn/PAAAAgElEQVR4nO3RsQmAQADAwJ/GqRzB9QULQTcQBOHBXJE+cGPZ1kvzGrMH6gEA0A4AgHYAALQDAKAdAADtXgPs56GHAABoBwBAOwAA2gEA0A4AgHYAALQDAKAdAADtAABoBwBAOwAA2gH4O4C+DQCAdgAAtAMAoB0AAO0AAGgHYHI3XJ8LEdmHjfoAAAAASUVORK5CYII=','base64'));
const picture=ok(doc.insertPicture(0,p,0,'[]',image,14400,7200,96,48,'png','테스트용 초록색 사각형'));
ok(doc.setPictureProperties(0,picture.paraIdx,picture.controlIdx,JSON.stringify({treatAsChar:true})));
if (!imageOnly) ok(doc.insertText(0,picture.paraIdx,8,'그림 1. 초록색 사각형'));
await mkdir(output,{recursive:true});
const entries=[];
for (const [extension,bytes] of [['hwp',doc.exportHwp()],['hwpx',doc.exportHwpx()]]) {
  const file=`viewer-two-pages.${extension}`;
  await writeFile(`${output}/${file}`,bytes);
  entries.push({file,sha256:createHash('sha256').update(bytes).digest('hex'),pages:2,expected:[['한글 문서 미리보기',intro,'항목','내용','상태','정상'],[second,detail]],imagePage:2,source:'scripts/create-fixtures.mjs, original text/table/PNG authored for this project; blank structure from MIT @rhwp/core 0.8.6',license:'MIT',fidelity:'Synthetic integration fixture; no independent Hancom output.'});
}
doc.free();
await writeFile(`${output}/manifest.json`,JSON.stringify(entries,null,2)+'\n');
console.log(`Created original HWP5/HWPX fixtures in ${output}.`);
if (imageOnly) {
  for (const entry of entries) {
    const check=new HwpDocument(await readFile(`${output}/${entry.file}`));
    console.log(JSON.stringify({file:entry.file,expectedImagesOnPage2:1,actualImagesOnPage2:(check.renderPageSvg(1).match(/<image/g)||[]).length}));
    check.free();
  }
}

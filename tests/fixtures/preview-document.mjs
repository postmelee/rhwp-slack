// Authored synthetic input, with an independent 12-page/page-label contract.
// It is an integration fixture, not a Hancom fidelity reference.
import init,{HwpDocument} from '@rhwp/core';
import {readFile} from 'node:fs/promises';
let initialized;
export async function previewDocument(format='hwp'){
  initialized??=init({module_or_path:await readFile('node_modules/@rhwp/core/rhwp_bg.wasm')});await initialized;
  const doc=HwpDocument.createEmpty();
  const ok=s=>{const v=JSON.parse(s);if(v.ok===false)throw new Error('Synthetic fixture creation failed');return v;};
  try{
    doc.createBlankDocument();let p=0;
    for(let page=1;page<=12;page++){
      if(page>1)p=ok(doc.insertPageBreak(0,doc.getParagraphCount(0)-1,0)).paraIdx;
      const title=`페이지 미리보기 테스트 — ${page} / 12`;
      ok(doc.insertText(0,p,0,title));ok(doc.applyCharFormat(0,p,0,title.length,JSON.stringify({bold:true,fontSize:2000})));
      p=ok(doc.splitParagraph(0,p,title.length)).paraIdx;
      const text='직접 만든 합성 문서입니다. 첫 3페이지와 추가 10페이지, 전체 PDF 및 편집을 확인하세요.';
      ok(doc.insertText(0,p,0,text));ok(doc.applyCharFormat(0,p,0,text.length,JSON.stringify({bold:false,fontSize:1100})));
      p=ok(doc.splitParagraph(0,p,text.length)).paraIdx;
      const table=ok(doc.createTable(0,p,0,3,2));
      for(const [cell,value] of ['문서','rhwp 테스트','페이지',String(page),'검증','PNG · PDF · 편집'].entries())ok(doc.insertTextInCell(0,table.paraIdx,table.controlIdx,cell,0,0,value));
    }
    if(doc.pageCount()!==12)throw new Error('Expected 12 pages');
    return Buffer.from(format==='hwpx'?doc.exportHwpx():doc.exportHwp());
  }finally{doc.free();}
}

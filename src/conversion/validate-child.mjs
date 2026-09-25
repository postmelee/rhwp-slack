// Parse only, isolated from the receiver and without Slack credentials.
import init,{HwpDocument} from '@rhwp/core';
import {readFile} from 'node:fs/promises';
console.log=console.info=console.warn=()=>{};
let document;
try {
  const chunks=[];let length=0;
  for await(const chunk of process.stdin){length+=chunk.length;if(length>20*1024*1024)throw new Error('size');chunks.push(chunk);}
  await init({module_or_path:await readFile('node_modules/@rhwp/core/rhwp_bg.wasm')});
  document=new HwpDocument(Buffer.concat(chunks));
  const count=document.pageCount();if(count<1||count>200)throw new Error('pages');
  process.stdout.write('ok');
}catch{process.exitCode=1;}finally{document?.free();}

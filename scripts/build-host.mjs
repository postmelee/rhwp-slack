import { build } from 'vite';
import {cpSync} from 'node:fs';
import { resolve } from 'node:path';
const dev=process.argv.includes('--dev');
for (const surface of ['viewer','editor']) await build({
  configFile:'vite.config.ts', mode:dev?'development':'production',
  root:`src/${surface}`, base:`/${surface}/`,
  build:{outDir:resolve(`dist/${dev?'dev-':''}${surface}`),emptyOutDir:true},
});
// Bundle the pinned upstream print DOM helpers for the isolated converter.
await build({configFile:false,publicDir:false,build:{
  lib:{entry:resolve('.cache/studio-source/rhwp-studio/src/command/print-pages.ts'),name:'RhwpPrint',formats:['iife'],fileName:()=> 'print.js'},
  outDir:resolve('.cache/conversion'),emptyOutDir:true,
}});

for(const folder of ['cmaps','standard_fonts','wasm','LICENSE']) cpSync(resolve('node_modules/pdfjs-dist',folder),resolve(`dist/${dev?'dev-':''}viewer/pdfjs`,folder),{recursive:true});

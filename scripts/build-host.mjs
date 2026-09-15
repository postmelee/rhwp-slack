import { build } from 'vite';
import {rmSync} from 'node:fs';
import { resolve } from 'node:path';
const dev=process.argv.includes('--dev');
// Remove obsolete PDF reader bundles from previous builds.
for (const folder of ['viewer', 'dev-viewer']) rmSync(resolve('dist', folder), {recursive:true, force:true});
const surface='editor';
await build({
  configFile:'vite.config.ts', mode:dev?'development':'production',
  root:`src/${surface}`, base:`/${surface}/`,
  build:{outDir:resolve(`dist/${dev?'dev-':''}${surface}`),emptyOutDir:true},
});
// Bundle the pinned upstream print DOM helpers for the isolated converter.
await build({configFile:false,publicDir:false,build:{
  lib:{entry:resolve('.cache/studio-source/rhwp-studio/src/command/print-pages.ts'),name:'RhwpPrint',formats:['iife'],fileName:()=> 'print.js'},
  outDir:resolve('.cache/conversion'),emptyOutDir:true,
}});

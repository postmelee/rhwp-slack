import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import {staticVersion} from './scripts/static-version.mjs';
const staticBase='/static/'+staticVersion()+'/';
export default defineConfig(({ mode }) => ({
  root: 'src/editor',
  base: staticBase+'editor/',
  publicDir: false,
  define: { __LOCAL_FILES__: JSON.stringify(mode === 'development'), __STUDIO_BASE__: JSON.stringify(staticBase+'studio/') },
  build: { outDir: resolve(mode === 'development' ? 'dist/dev-editor' : 'dist/editor'), emptyOutDir: true, target: 'es2022' },
  worker: { format: 'iife' },
}));

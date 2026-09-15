import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig(({ mode }) => ({
  root: 'src/viewer',
  base: '/viewer/',
  publicDir: false,
  define: { __LOCAL_FILES__: JSON.stringify(mode === 'development') },
  build: { outDir: resolve(mode === 'development' ? 'dist/dev-viewer' : 'dist/viewer'), emptyOutDir: true, target: 'es2022' },
  worker: { format: 'iife' },
}));

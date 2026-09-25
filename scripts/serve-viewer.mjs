// Local fixture/dev server only. Stage 4 supplies the authenticated production server.
import { DevDocuments } from '../src/server/dev-documents.mjs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const dev = process.argv.includes('--dev');
const port = Number(process.env.PORT || 4173);
const documents=dev?new DevDocuments():null;
if(documents)setInterval(()=>documents.sweep(),60_000).unref();
const origin = `http://127.0.0.1:${port}`;
const mime = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.json':'application/json', '.wasm':'application/wasm', '.woff2':'font/woff2', '.woff':'font/woff', '.ttf':'font/ttf', '.svg':'image/svg+xml', '.png':'image/png', '.ico':'image/x-icon' };
createServer(async (req,res) => {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Security-Policy', `default-src 'none'; script-src ${origin} 'wasm-unsafe-eval'; worker-src ${origin} blob:; style-src ${origin} 'unsafe-inline'; font-src ${origin} data:; connect-src ${origin}; img-src ${origin} data: blob:; frame-src ${origin}; object-src 'none'; frame-ancestors ${origin}; base-uri 'none'; form-action 'none'`);
  try {
    const url = new URL(req.url, origin);
    const path = url.pathname;
    if (req.headers.host !== new URL(origin).host) {res.writeHead(403).end();return;}
    if (path === '/' || path === '/viewer' || path === '/viewer/' || path === '/editor') {
      // A redirect without a fragment preserves the caller's document ticket.
      res.writeHead(302, {Location: '/editor/' + url.search}).end(); return;
    }
    if (documents && await documents.handle(req,res,path,origin)) return;
    if (dev && path === '/sandbox') {
      res.setHeader('Content-Type','text/html');
      res.end('<!doctype html><html><head><title>Slack sandbox test</title></head><body style="margin:0"><iframe title="문서 편집기" sandbox="allow-scripts allow-same-origin" src="/editor/" style="width:100vw;height:100vh;border:0"></iframe></body></html>'); return;
    }
    if(path.startsWith('/static/')){const {staticAssets}=await import('../src/server/static-assets.ts');await staticAssets()(req,res,path);return;}
    if (!path.startsWith('/studio/') && !path.startsWith('/editor/')) { res.writeHead(404).end(); return; }
    const mount = path.startsWith('/studio/') ? resolve('dist/studio') : resolve(dev?'dist/dev-editor':'dist/editor');
    const file = resolve(mount, decodeURIComponent(path.slice(8) || 'index.html'));
    if (!file.startsWith(mount+'/')) { res.writeHead(403).end(); return; }
    const body = await readFile(file);
    res.setHeader('Content-Type',mime[extname(file)] || 'application/octet-stream'); res.end(body);
  } catch { res.writeHead(404).end(); }
}).listen(port, '127.0.0.1', () => console.log(`Local editor: ${origin}/editor/${dev?'?devtools=1':''}`));

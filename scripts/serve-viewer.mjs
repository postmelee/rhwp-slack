// Local fixture/dev server only. Stage 2 supplies the authenticated production server.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const dev = process.argv.includes('--dev');
const root = resolve(dev ? 'dist/dev-viewer' : 'dist/viewer');
const port = Number(process.env.PORT || 4173);
const origin = `http://127.0.0.1:${port}`;
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.wasm':'application/wasm', '.woff2':'font/woff2' };
createServer(async (req,res) => {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Security-Policy', `default-src 'none'; script-src ${origin} 'wasm-unsafe-eval'; worker-src blob:; style-src ${origin} 'unsafe-inline'; font-src ${origin}; connect-src ${origin}; img-src data:; frame-src ${origin}; frame-ancestors ${origin}; base-uri 'none'; form-action 'none'`);
  try {
    const path = new URL(req.url, origin).pathname;
    if (dev && path === '/sandbox') {
      res.setHeader('Content-Type','text/html');
      res.end('<!doctype html><html><head><title>Opaque origin test</title></head><body style="margin:0"><iframe title="문서 뷰어" sandbox="allow-scripts" src="/viewer/" style="width:100vw;height:100vh;border:0"></iframe></body></html>'); return;
    }
    if (!path.startsWith('/viewer/')) { res.writeHead(404).end(); return; }
    const file = resolve(root, decodeURIComponent(path.slice(8) || 'index.html'));
    if (!file.startsWith(root+'/')) { res.writeHead(403).end(); return; }
    const body = await readFile(file);
    res.setHeader('Content-Type',mime[extname(file)] || 'application/octet-stream'); res.end(body);
  } catch { res.writeHead(404).end(); }
}).listen(port, '127.0.0.1', () => console.log(`Local viewer: ${origin}/viewer/`));

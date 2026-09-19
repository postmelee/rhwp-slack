import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {brotliCompressSync} from 'node:zlib';
import {staticAssets} from '../../src/server/static-assets';

test('static program cache: version, encoding, conditional GET/HEAD and stale-version isolation',async()=>{
  const root=await mkdtemp(join(tmpdir(),'rhwp-static-'));const bytes=Buffer.from('export default "public program";'.repeat(50)),br=brotliCompressSync(bytes),version='a'.repeat(64);
  await mkdir(join(root,'studio'));await writeFile(join(root,'studio','index.html'),bytes);await writeFile(join(root,'studio','index.html.br'),br);
  const representation=(file:string,body:Buffer)=>({file,size:body.length,etag:'"'+createHash('sha256').update(body).digest('hex')+'"'});
  await writeFile(join(root,'static-manifest.json'),JSON.stringify({version,files:{'studio/index.html':{identity:representation('studio/index.html',bytes),br:representation('studio/index.html.br',br)}}}));
  // An unrelated file exists on disk but must never be served without a manifest entry.
  await writeFile(join(root,'studio','private.env'),'not-public');
  const handler=staticAssets(root),server=createServer((req,res)=>{res.setHeader('Cache-Control','no-store');void handler(req,res,new URL(req.url!,'http://localhost').pathname).catch(()=>res.writeHead(500).end());});
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const address=server.address();assert.ok(address&&typeof address!=='string');const origin=`http://127.0.0.1:${address.port}`;
  try{
    const path=`/static/${version}/studio/`;
    const compressed=await fetch(origin+path,{headers:{'Accept-Encoding':'br'}});
    assert.equal(compressed.status,200);assert.equal(compressed.headers.get('cache-control'),'public, max-age=31536000, immutable');
    assert.equal(compressed.headers.get('content-encoding'),'br');assert.equal(compressed.headers.get('vary'),'Accept-Encoding');assert.deepEqual(Buffer.from(await compressed.arrayBuffer()),bytes);
    const etag=compressed.headers.get('etag')!;
    const conditional=await fetch(origin+path,{headers:{'Accept-Encoding':'br','If-None-Match':etag}});assert.equal(conditional.status,304);assert.equal(await conditional.text(),'');
    const head=await fetch(origin+path,{method:'HEAD',headers:{'Accept-Encoding':'br'}});assert.equal(head.status,200);assert.equal(head.headers.get('content-length'),String(br.length));assert.equal(await head.text(),'');
    const identity=await fetch(origin+path,{headers:{'Accept-Encoding':'br;q=0, identity'}});assert.equal(identity.headers.get('content-encoding'),null);assert.notEqual(identity.headers.get('etag'),etag);
    const legacy=await fetch(origin+'/studio/');assert.equal(legacy.status,200);assert.equal(legacy.headers.get('cache-control'),'no-cache');
    for(const invalid of ['/static/'+('b'.repeat(64))+'/studio/','/static/'+version+'/studio/private.env','/static/'+version+'/studio/%2e%2e%2fprivate.env']){
      const denied=await fetch(origin+invalid);assert.equal(denied.status,404);assert.equal(denied.headers.get('cache-control'),'no-store');
    }
  }finally{await new Promise<void>((r,j)=>server.close(e=>e?j(e):r()));await rm(root,{recursive:true,force:true});}
});

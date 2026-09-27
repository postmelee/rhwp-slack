import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const exporter=resolve('scripts/export-pages.mjs');
test('Pages public site is opt-in, links only the deployment API and publishes no document or secret files',async()=>{
 const cwd=await mkdtemp(join(tmpdir(),'rhwp-public-site-'));
 try{
  await mkdir(join(cwd,'dist/editor'),{recursive:true});await mkdir(join(cwd,'dist/studio'),{recursive:true});
  const shell='<meta name="rhwp-api-origin" content="">',program='public program';
  await writeFile(join(cwd,'dist/editor/index.html'),shell);await writeFile(join(cwd,'dist/studio/index.html'),program);
  await writeFile(join(cwd,'dist/.env'),'must never be public');await writeFile(join(cwd,'dist/source.hwp'),'private document');
  const version='a'.repeat(64);
  await writeFile(join(cwd,'dist/static-manifest.json'),JSON.stringify({version,files:{'studio/index.html':{identity:{file:'studio/index.html',etag:'"'+createHash('sha256').update(program).digest('hex')+'"'}}}}));
  const run=(...args)=>execFileSync(process.execPath,[exporter,...args],{cwd,encoding:'utf8',stdio:'pipe'});
  run('https://api.example.test');
  await assert.rejects(readFile(join(cwd,'dist/pages/index.html')),{code:'ENOENT'});
  assert.match(await readFile(join(cwd,'dist/pages/robots.txt'),'utf8'),/Disallow: \/\n/);
  assert.ok(!(await readFile(join(cwd,'dist/pages/_headers'),'utf8')).includes('media-src'));
  run('https://api.example.test','--public-site');
  const root=join(cwd,'dist/pages'),files=await readdir(root,{recursive:true});
  assert.ok(files.includes('privacy/index.html'));assert.ok(files.includes('guide/index.html'));assert.ok(files.includes('support/index.html'));
  assert.ok(files.includes('licenses/index.html'));
  assert.equal(await readFile(join(root,'licenses/MIT.txt'),'utf8'),await readFile(new URL('../../LICENSE',import.meta.url),'utf8'));
  assert.equal(await readFile(join(root,'licenses/THIRD_PARTY_NOTICES.md'),'utf8'),await readFile(new URL('../../THIRD_PARTY_NOTICES.md',import.meta.url),'utf8'));
  assert.ok(!files.some(f=>f.startsWith('mydocs/')));
  assert.ok(!files.includes('.env'));assert.ok(!files.includes('source.hwp'));
  for(const path of files.filter(f=>f.endsWith('.html'))){
   const html=await readFile(join(root,path),'utf8');assert.ok(!html.includes('{{INSTALL_URL}}'));
   if(!path.startsWith('static/')&&!path.startsWith('editor/')&&path!=='404.html'){
    assert.match(html,/https:\/\/api.example.test\/install/);assert.ok(!/<script\b/i.test(html));
    for(const [,url] of html.matchAll(/(?:href|src)="(\/[^"#]*)"/g)){
     await readFile(join(root,url.replace(/^\//,'')+(url.endsWith('/')?'index.html':'')));
    }
   }
  }
  const headers=await readFile(join(root,'_headers'),'utf8');
  assert.match(headers,/connect-src 'self' https:\/\/api.example.test/);
  assert.match(headers,/media-src 'self'(?:;|\n)/);
  assert.match(headers,/default-src 'none'/);
  assert.ok(files.includes('assets/demo/rhwp-slack-20260926.mp4'));
  assert.ok(files.includes('assets/demo/rhwp-slack-20260926.jpg'));
  assert.ok(!headers.split('\n\n')[0].includes('X-Robots-Tag'));
  assert.match(headers,/\/editor\/\*\n  Cache-Control: no-cache\n  X-Robots-Tag: noindex, nofollow/);
  assert.match(await readFile(join(root,'editor/index.html'),'utf8'),/content="https:\/\/api.example.test"/);
  assert.throws(()=>run('https://api.example.test/unsafe','--public-site'));
  assert.throws(()=>run('http://api.example.test','--public-site'));
 }finally{await rm(cwd,{recursive:true,force:true});}
});

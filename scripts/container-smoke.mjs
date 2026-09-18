import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync,writeFileSync,readFileSync} from 'node:fs';
assert.equal(process.platform,'linux');assert.notEqual(process.getuid(),0);
for(const file of ['.env','.git','dist/dev-editor','studio/upstream.json'])assert.equal(existsSync(file),false,`${file} leaked into runtime`);
assert.throws(()=>writeFileSync('/app/should-be-read-only','x'));
for(const suite of ['unit','slack','security']){
  const result=spawnSync(process.execPath,['scripts/run-tests.mjs',suite],{stdio:'inherit'});
  assert.equal(result.status,0,`${suite} checks failed`);
}
const conversion=spawnSync(process.execPath,['--test','tests/conversion/render.test.mjs'],{stdio:'inherit'});
assert.equal(conversion.status,0,'streaming PDF and range retry failed');
if(process.argv.includes('--server-only')){
  const {convertPdf,closeConversionRuntime}=await import('../src/conversion/convert.mjs');
  for(const format of ['hwp','hwpx']){
    const pdf=await convertPdf(readFileSync(`tests/fixtures/viewer-two-pages.${format}`));
    assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
  }
  await closeConversionRuntime();
}else{
  // This target additionally hosts the user's Studio browser inside the same cgroup.
  const result=spawnSync(process.execPath,['node_modules/@playwright/test/cli.js','test','tests/viewer/slack-flow.spec.ts','--output=/tmp/test-results'],{stdio:'inherit'});
  assert.equal(result.status,0,'production Studio + PDF smoke failed');
}
if(existsSync('/sys/fs/cgroup/memory.events')){
  const events=readFileSync('/sys/fs/cgroup/memory.events','utf8');
  assert.match(events,/^oom_kill 0$/m,'cgroup reported an OOM kill');
  console.log('Cgroup peak bytes: '+readFileSync('/sys/fs/cgroup/memory.peak','utf8').trim());
}
console.log('Container smoke passed: Linux non-root, read-only runtime; Slack API is synthetic.');

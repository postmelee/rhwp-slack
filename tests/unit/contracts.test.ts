import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pageIndex, zoomValue } from '../../src/shared/page-number';
import { validateInput, MAX_FILE_BYTES } from '../../src/shared/errors';
test('user pages are one-based and reject ambiguous or out-of-range input', () => {
  assert.equal(pageIndex('1',2),0); assert.equal(pageIndex(2,2),1);
  for (const n of ['0','-1','1.5','1e0','',' 1','3',NaN,Infinity]) assert.throws(()=>pageIndex(n,2));
});
test('zoom boundaries are explicit', () => {
  assert.equal(zoomValue(50),50); assert.equal(zoomValue(200),200);
  for (const n of [49,201,NaN,Infinity]) assert.throws(()=>zoomValue(n));
});
test('actual bytes enforce format and source size before parsing', () => {
  assert.throws(()=>validateInput(new Uint8Array()));
  assert.throws(()=>validateInput(new TextEncoder().encode('renamed HWP file')));
  const bytes=new Uint8Array(MAX_FILE_BYTES+1); bytes.set([0x50,0x4b,3,4]); assert.throws(()=>validateInput(bytes));
});
test('fixture files exist, match recorded provenance hashes and both formats', async () => {
  const fixtures=JSON.parse(await readFile('tests/fixtures/manifest.json','utf8'));
  assert.equal(fixtures.length,2);
  assert.deepEqual(fixtures.map((f:{file:string})=>f.file.split('.').at(-1)).sort(),['hwp','hwpx']);
  for (const fixture of fixtures) {
    const bytes=await readFile(`tests/fixtures/${fixture.file}`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),fixture.sha256);
    validateInput(bytes); assert.equal(fixture.pages,2); assert.ok(fixture.source); assert.ok(fixture.license);
  }
});

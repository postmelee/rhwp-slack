import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../../studio/adapters/persistence';
test('disabled document stores neither read old data nor report successful persistence', async()=>{
  assert.deepEqual(await store.listAutosaveDrafts(),[]);
  assert.deepEqual(await store.listRecentDocs(),[]);
  assert.deepEqual(await store.listHistoryMeta(),[]);
  assert.equal(await store.getAutosaveDraft(),null);
  assert.equal(await store.getHistoryPayload(),null);
  await assert.rejects(store.saveAutosaveDraft(),/disabled/);
  await assert.rejects(store.saveHistoryIrSnapshot(),/disabled/);
  await store.addRecentDoc(); await store.deleteAutosaveDraft();
  await store.clearAutosaveDrafts(); await store.clearRecentDocs(); await store.clearHistory();
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {documentMessage} from '../../src/server/document-message';
import {isPermanentConversionFailure} from '../../src/conversion/failures.mjs';
import {MAX_PAGES} from '../../src/shared/errors';
import type {Card} from '../../src/server/documents';

test('page-limit rejection states the actual limit and splitting guidance without automatic retry',()=>{
  const card:Card={id:'synthetic',actor:{teamId:'TTEST',channelId:'CTEST',userId:'UTEST'},fileId:'FTEST',rootFileId:'FTEST',name:'synthetic.hwpx',size:100,createdAt:1,revision:1,pdf:'failed',imageState:'failed',recovery:{taskId:'synthetic-task',state:'failed',attempt:1,maxAttempts:3,errorCode:'conversion_page_limit'}};
  const message=JSON.stringify(documentMessage(card,'https://example.test','browser'));
  assert.ok(message.includes(`1~${MAX_PAGES}페이지`));assert.match(message,/문서를 나누어 새 파일로/);
  assert.doesNotMatch(message,/자동으로 다시 시도|rhwp_retry_preview/);
  assert.equal(isPermanentConversionFailure('conversion_page_limit'),true);
});

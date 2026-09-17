import test from 'node:test';
import assert from 'node:assert/strict';
import {workerEnvironment} from '../../src/conversion/worker-env.mjs';
test('parser and browser environment excludes Slack and arbitrary host credentials',()=>{
  assert.deepEqual(workerEnvironment({PATH:'/usr/bin',HOME:'/tmp',PLAYWRIGHT_BROWSERS_PATH:'/ms-playwright',SLACK_BOT_TOKEN:'synthetic',SLACK_SIGNING_SECRET:'synthetic',AWS_SECRET_ACCESS_KEY:'synthetic',NODE_OPTIONS:'--require=untrusted'}),{PATH:'/usr/bin',HOME:'/tmp',PLAYWRIGHT_BROWSERS_PATH:'/ms-playwright'});
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {validMetric} from '../../src/conversion/convert.mjs';
import {failureCode,isPermanentConversionFailure} from '../../src/conversion/failures.mjs';
test('failure telemetry allows fixed reasons and bounded counts but no document content',()=>{
 const metric={stage:'svg_render',phase:'failed',failureReason:'svg_size',pageNumber:72,pageCount:80,svgBytes:104880785};
 assert.deepEqual(validMetric({...metric,message:'private document',stack:'secret',filename:'private.hwp'}),metric);
 for(const value of [{failureReason:'secret'},{pageNumber:201},{pageCount:Infinity},{svgBytes:-1},{svgBytes:1.5}])assert.equal(validMetric({...metric,...value}),undefined);
 assert.equal(validMetric({...metric,phase:'start'}).failureReason,undefined);
});
test('only known document limits are permanent, render and transient failures still retry',()=>{
 for(const reason of ['svg_size','page_count','page_size','pdf_size','preview_size'])assert.equal(isPermanentConversionFailure(failureCode(reason)),true);
 for(const code of ['conversion_render','conversion_output','conversion_timeout','conversion_child','conversion_busy','slack_unavailable',undefined])assert.equal(isPermanentConversionFailure(code),false);
});

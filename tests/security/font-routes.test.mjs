import test from 'node:test';
import assert from 'node:assert/strict';
import {fontAsset,routeFont} from '../../src/conversion/font-routes.mjs';
const file='a'.repeat(64)+'.woff2',url='https://rhwp-fonts.invalid/'+file;
const files={[url]:file};
const request=(u=url,method='GET',type='font')=>({url:()=>u,method:()=>method,resourceType:()=>type});
test('font delivery accepts only exact compiled assets and font GETs',()=>{
 assert.equal(fontAsset(request(),files),file);
 for(const u of ['https://example.com/font.woff2',url+'?secret=x','http://rhwp-fonts.invalid/'+file,'https://rhwp-fonts.invalid/../secret','file:///etc/passwd','https://rhwp-fonts.invalid/'+'b'.repeat(64)+'.woff2'])assert.equal(fontAsset(request(u),files),undefined);
 assert.equal(fontAsset(request(url,'POST'),files),undefined);assert.equal(fontAsset(request(url,'GET','image'),files),undefined);
 assert.equal(fontAsset(request(),{[url]:'../../secret'}),undefined);
 assert.equal(fontAsset(request(),Object.create(files)),undefined);
});
test('unrecognized document requests are aborted without a network fallback',async()=>{
 let aborted=0,fulfilled=0;
 await routeFont({request:()=>request('https://example.com/secret'),abort:async()=>{aborted++;},fulfill:async()=>{fulfilled++;}},files,'/nonexistent');
 assert.equal(aborted,1);assert.equal(fulfilled,0);
});

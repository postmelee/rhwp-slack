import {test,expect} from '@playwright/test';
import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
// @ts-expect-error synthetic fixture helper has no declaration file
import {previewDocument} from '../fixtures/preview-document.mjs';
import {convertPreview,convertPageImages} from '../../src/conversion/convert.mjs';
for(const format of ['hwp','hwpx'])test(`${format}: first 3 and additional 4–10 are distinct numbered images of a 12-page document`,async({},info)=>{
  const bytes=await previewDocument(format);
  const preview=await convertPreview(bytes);expect(preview.pageCount).toBe(12);expect(preview.pages.map(p=>p.page)).toEqual([1,2,3]);
  const more=await convertPageImages(bytes,{start:4,end:10});expect(more.pageCount).toBe(12);expect(more.pages.map(p=>p.page)).toEqual([4,5,6,7,8,9,10]);
  const hashes=new Set<string>();
  for(const image of [...preview.pages,...more.pages]){
    expect(image.png.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');
    hashes.add(createHash('sha256').update(image.png).digest('hex'));
    if([1,3,10].includes(image.page))await writeFile(info.outputPath(`page-${image.page}.png`),image.png);
  }
  expect(hashes.size).toBe(10);expect(preview.pdf.subarray(0,5).toString()).toBe('%PDF-');
  await writeFile(info.outputPath('all-pages.pdf'),preview.pdf);
  await expect(convertPageImages(bytes,{start:1,end:11})).rejects.toThrow(/범위/);
});

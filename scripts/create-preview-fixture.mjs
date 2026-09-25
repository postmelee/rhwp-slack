import {mkdir,writeFile} from 'node:fs/promises';
import {previewDocument} from '../tests/fixtures/preview-document.mjs';
const directory='.cache/test-documents';await mkdir(directory,{recursive:true});
for(const format of ['hwp','hwpx']){
  const path=`${directory}/rhwp-12페이지-테스트.${format}`;
  await writeFile(path,await previewDocument(format));console.log(path);
}

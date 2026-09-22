import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
const pages=['index.html','guide/index.html','privacy/index.html','support/index.html','site.css','rhwp-logo.png','assets/slack-preview-20260922.jpg'];
/** Explicit allowlist: never publish repository files, environment data or test documents. */
export async function exportPublicSite(output,apiOrigin){
  const api=new URL(apiOrigin);
  if(api.protocol!=='https:'||api.origin!==apiOrigin||api.username||api.password)throw Error('Expected exact HTTPS API origin');
  if(output!==resolve('dist/pages'))throw Error('Output must be dist/pages');
  let bytes=0;
  for(const path of pages){
    let data=await readFile(new URL('../site/'+path,import.meta.url));
    if(path.endsWith('.html')){
      const html=data.toString().replaceAll('{{INSTALL_URL}}',api.origin+'/install');
      if(/\{\{[A-Z_]+\}\}/.test(html))throw Error('Unresolved public site configuration');
      data=Buffer.from(html);
    }
    if(data.length>25*1024*1024)throw Error('Pages file limit exceeded');
    await mkdir(dirname(output+'/'+path),{recursive:true});await writeFile(output+'/'+path,data);bytes+=data.length;
  }
  return {files:pages.length,bytes};
}

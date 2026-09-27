import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
const pages=['index.html','guide/index.html','privacy/index.html','support/index.html','licenses/index.html','site.css','rhwp-logo.png','assets/banner.png','assets/slack-thread-20260922.png','assets/demo/rhwp-slack-20260926.mp4','assets/demo/rhwp-slack-20260926.jpg','review/index.html','assets/review/01-install.png','assets/review/02-installed.png','assets/review/03-channel-settings.png','assets/review/04-editor-signin.png','assets/review/05-editor-save.png','assets/review/06-slack-result.png'];
const notices=[['LICENSE','licenses/MIT.txt'],['THIRD_PARTY_NOTICES.md','licenses/THIRD_PARTY_NOTICES.md']];
/** Publish only listed site assets and license notices; exclude environment data and test documents. */
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
  for(const [source,path] of notices){
    const data=await readFile(new URL('../'+source,import.meta.url));
    if(data.length>25*1024*1024)throw Error('Pages file limit exceeded');
    await mkdir(dirname(output+'/'+path),{recursive:true});await writeFile(output+'/'+path,data);bytes+=data.length;
  }
  return {files:pages.length+notices.length,bytes};
}

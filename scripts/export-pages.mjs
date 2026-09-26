// Export already-built program assets only. No environment files, credentials or document data.
import {readFile,writeFile,mkdir,copyFile,rm} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {exportPublicSite} from './public-site.mjs';
import {editorPolicy} from '../src/server/editor-policy.ts';
export async function exportPages(apiOrigin,output=resolve('dist/pages'),{publicSite=false}={}){
 const api=new URL(apiOrigin);
 if(api.protocol!=='https:'||api.username||api.password||api.pathname!=='/'||api.search||api.hash||api.hostname.includes('*'))throw Error('Supply one exact HTTPS API origin');
 const manifest=JSON.parse(await readFile('dist/static-manifest.json','utf8'));
 if(!/^[a-f0-9]{64}$/.test(manifest.version))throw Error('Invalid static manifest');
 // Fixed output under dist prevents accidentally erasing an unrelated directory.
 if(output!==resolve('dist/pages'))throw Error('Output must be dist/pages');
 await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
 const headers=[`/*\n  Referrer-Policy: no-referrer\n  X-Content-Type-Options: nosniff\n${publicSite?'':'  X-Robots-Tag: noindex, nofollow\n'}  Content-Security-Policy: ${editorPolicy(api.origin)}${publicSite?"; media-src 'self'":""}`, `/editor/*\n  Cache-Control: no-cache${publicSite?'\n  X-Robots-Tag: noindex, nofollow':''}`, `/api/*\n  Cache-Control: no-store${publicSite?'\n  X-Robots-Tag: noindex, nofollow':''}`, '/404.html\n  Cache-Control: no-store'];
 if(publicSite){
  headers.push('/static/*\n  X-Robots-Tag: noindex, nofollow','/review/*\n  X-Robots-Tag: noindex, nofollow','/assets/review/*\n  X-Robots-Tag: noindex, nofollow');
  for(const path of ['/','/guide/','/privacy/','/support/','/licenses/','/licenses/MIT.txt','/licenses/THIRD_PARTY_NOTICES.md','/review/','/site.css','/rhwp-logo.png'])headers.push(path+'\n  Cache-Control: no-cache');
 }
 let count=0,total=0;
 for(const [path,record] of Object.entries(manifest.files)){
   if(!/^(studio|editor)\//.test(path)||path.split('/').includes('..'))throw Error('Invalid public asset');
   const bytes=await readFile(resolve('dist',record.identity.file));
   if(bytes.length>25*1024*1024)throw Error('Pages file limit exceeded');
   if('"'+createHash('sha256').update(bytes).digest('hex')+'"'!==record.identity.etag)throw Error('Asset changed after manifest generation');
   const target=`/static/${manifest.version}/${path}`;
   await mkdir(dirname(output+target),{recursive:true});await copyFile(resolve('dist',record.identity.file),output+target);
   headers.push(`${target.endsWith('/index.html')?target.slice(0,-10):target}\n  Cache-Control: public, max-age=31536000, immutable`);
   total+=bytes.length;count++;
 }
 const shell=await readFile('dist/editor/index.html','utf8');
 if(!shell.includes('<meta name="rhwp-api-origin" content="">'))throw Error('Editor config anchor changed');
 await mkdir(output+'/editor');await writeFile(output+'/editor/index.html',shell.replace('<meta name="rhwp-api-origin" content="">',`<meta name="rhwp-api-origin" content="${api.origin}">`));
 await writeFile(output+'/404.html','<!doctype html><meta charset="utf-8"><title>rhwp</title><p>Slack에서 편집 카드를 다시 열어 주세요.</p>');
 const site=publicSite?await exportPublicSite(output,api.origin):{files:0,bytes:0};
 await writeFile(output+'/robots.txt',publicSite?'User-agent: *\nAllow: /\nDisallow: /editor/\nDisallow: /static/\nDisallow: /api/\nDisallow: /review/\nDisallow: /assets/review/\n':'User-agent: *\nDisallow: /\n');
 if(headers.length>100||headers.some(h=>h.split('\n').some(l=>l.length>2000)))throw Error('Pages header limit exceeded');
 await writeFile(output+'/_headers',headers.join('\n\n')+'\n');
 // Explicit 404 disables Pages SPA fallback; no redirects forward fragments to the API.
 return {version:manifest.version,apiOrigin:api.origin,files:count+4+site.files,programBytes:total,siteBytes:site.bytes,headers:headers.length};
}
if(process.argv[1]?.endsWith('export-pages.mjs'))console.log(JSON.stringify(await exportPages(process.argv[2],undefined,{publicSite:process.argv.includes('--public-site')})));

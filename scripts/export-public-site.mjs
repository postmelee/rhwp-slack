import {copyFile,mkdir,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {exactApiOrigin} from './pages-headers.mjs';
import {exportPublicSite} from './public-site.mjs';

if(process.argv.length!==3)throw Error('Usage: export-public-site.mjs HTTPS_API_ORIGIN');
const apiOrigin=exactApiOrigin(process.argv[2]);
const output=resolve('dist/public-site');
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
const site=await exportPublicSite(output,apiOrigin);
const config=['404.html','_headers','robots.txt','sitemap.xml'];
for(const path of config){
 await copyFile(new URL('../site/pages/public/'+path,import.meta.url),resolve(output,path));
}
console.log(JSON.stringify({apiOrigin,files:site.files+config.length}));

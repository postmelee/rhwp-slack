import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';

// Fixed build assets only. A document cannot make the browser fetch network URLs.
export function fontAsset(request,files){
  if(request.method()!=='GET'||request.resourceType()!=='font')return;
  const url=request.url();
  if(!/^https:\/\/rhwp-fonts\.invalid\/[a-f0-9]{64}\.woff2$/.test(url))return;
  const file=Object.hasOwn(files,url)?files[url]:undefined;
  if(typeof file!=='string'||file!==url.slice('https://rhwp-fonts.invalid/'.length))return;
  return file;
}
export async function routeFont(route,files,directory){
  const file=fontAsset(route.request(),files);
  if(!file){await route.abort();return;}
  try{
    await route.fulfill({status:200,contentType:'font/woff2',headers:{'Access-Control-Allow-Origin':'*'},body:await readFile(resolve(directory,file))});
  }catch{await route.abort().catch(()=>{});}
}

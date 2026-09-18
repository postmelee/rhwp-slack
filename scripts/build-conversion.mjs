// All resources are pinned build inputs. No documents, credentials or runtime state.
import {build} from 'esbuild';
import {readFile,writeFile,mkdir,copyFile,rm} from 'node:fs/promises';
import {resolve,basename} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const out=resolve('.cache/conversion');await mkdir(out,{recursive:true});
await build({entryPoints:['.cache/studio-source/rhwp-studio/src/core/generated/font-rule-projections/webfont-supply.ts'],bundle:true,platform:'node',format:'esm',outfile:resolve(out,'font-rules.mjs')});
const {FONT_RULE_CANVAS2D_WEBFONT_RULES:rules}=await import(pathToFileURL(resolve(out,'font-rules.mjs')).href);
const seen=new Set(),files={},sources=new Map();let css='',previousInlineBytes=0;
await mkdir(resolve(out,'fonts'),{recursive:true});
for(const rule of rules){
 const f=rule.supply;if(!f||f.external||typeof f.sourceUrl!=='string'||!f.sourceUrl.startsWith('fonts/'))continue;
 const key=JSON.stringify([f.fontFamily,f.sourceUrl]);if(seen.has(key))continue;seen.add(key);
 let asset=sources.get(f.sourceUrl);
 if(!asset){
  const path=resolve('.cache/studio-source/assets/fonts',basename(f.sourceUrl)),data=await readFile(path),digest=createHash('sha256').update(data).digest('hex');
  asset={digest,bytes:data.length};sources.set(f.sourceUrl,asset);await copyFile(path,resolve(out,'fonts',digest+'.woff2'));
  files[`https://rhwp-fonts.invalid/${digest}.woff2`]=digest+'.woff2';
 }
 const prefix=`@font-face{font-family:${JSON.stringify(f.fontFamily)};src:url(`;
 css+=`${prefix}https://rhwp-fonts.invalid/${asset.digest}.woff2) format("woff2");}\n`;
 previousInlineBytes+=Buffer.byteLength(prefix+'data:font/woff2;base64,'+') format("woff2");}\n')+4*Math.ceil(asset.bytes/3);
}
await writeFile(resolve(out,'fonts.json'),JSON.stringify({css,files}));
await build({entryPoints:['src/conversion/pdf-child.mjs'],bundle:true,platform:'node',format:'esm',packages:'external',outfile:resolve(out,'pdf-child.mjs')});
await rm(resolve(out,'font-rules.mjs'));
console.log(JSON.stringify({conversionBuild:true,fontFamilies:seen.size,fontFiles:sources.size,fontCssBytes:Buffer.byteLength(css),previousInlineBytes}));

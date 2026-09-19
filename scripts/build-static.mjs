import {readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {brotliCompressSync,gzipSync,constants} from 'node:zlib';
import {staticVersion} from './static-version.mjs';
import {existsSync} from 'node:fs';
const version=staticVersion(),files={};
async function visit(mount,dir=''){
  const entries=await readdir('dist/'+mount+'/'+dir,{withFileTypes:true});
  for(const entry of entries)if(!entry.isDirectory()&&/\.(br|gz)$/.test(entry.name))await rm('dist/'+mount+'/'+dir+entry.name);
  for(const entry of entries){
    const path=dir+entry.name;
    if(entry.isDirectory()){await visit(mount,path+'/');continue;}
    if(/\.(br|gz)$/.test(path))continue;
    const bytes=await readFile('dist/'+mount+'/'+path),record={};
    for(const [encoding,data,suffix] of [['identity',bytes,''],...(/\.(html|js|css|json|wasm|svg|ttf)$/.test(path)?[
      ['br',brotliCompressSync(bytes,{params:{[constants.BROTLI_PARAM_QUALITY]:6}}),'.br'],['gzip',gzipSync(bytes,{level:9}),'.gz']]:[])]){
      if(suffix){if(data.length>=bytes.length)continue;await writeFile('dist/'+mount+'/'+path+suffix,data);}
      record[encoding]={file:mount+'/'+path+suffix,size:data.length,etag:'"'+createHash('sha256').update(data).digest('hex')+'"'};
    }
    files[mount+'/'+path]=record;
  }
}
for(const mount of ['editor','studio'])if(existsSync('dist/'+mount))await visit(mount);
await writeFile('dist/static-manifest.json',JSON.stringify({version,files}));
console.log(`Static namespace ${version}, ${Object.keys(files).length} files`);

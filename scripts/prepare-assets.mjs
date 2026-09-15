import { readFile, writeFile, mkdir, cp, readdir, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const out = 'public/vendor';
await rm(out, { recursive: true, force: true });
await mkdir(`${out}/fonts`, { recursive: true });
await mkdir(`${out}/licenses`, { recursive: true });
await cp('node_modules/@rhwp/core/rhwp_bg.wasm', `${out}/rhwp_bg.wasm`);
const faces = [];
for (const name of ['noto-sans-kr', 'noto-serif-kr']) {
  const base = `node_modules/@fontsource/${name}`;
  for (const weight of [400, 700]) {
    const css = await readFile(`${base}/${weight}.css`, 'utf8');
    for (const block of css.matchAll(/@font-face\s*\{([^}]+)\}/g)) {
      const value = key => block[1].match(new RegExp(`${key}:\\s*([^;]+);`))?.[1];
      const file = block[1].match(/url\(\.\/files\/([^()]+\.woff2)\)/)?.[1];
      if (!file || !value('unicode-range')) throw new Error('Invalid font CSS');
      await cp(`${base}/files/${file}`, `${out}/fonts/${file}`);
      faces.push({ family: value('font-family').replace(/['"]/g, ''), weight: String(weight), unicodeRange: value('unicode-range'), file: `fonts/${file}` });
    }
  }
  await cp(`${base}/LICENSE`, `${out}/licenses/${name}.txt`);
}
await writeFile(`${out}/fonts.json`, JSON.stringify(faces));
for (const [pkg, file] of [['@rhwp/core','LICENSE'],['dompurify','LICENSE']]) {
  await cp(`node_modules/${pkg}/${file}`, `${out}/licenses/${pkg.replaceAll('/','-')}.txt`);
}
const hashes = {};
async function walk(dir, prefix = '') {
  for (const ent of (await readdir(dir, { withFileTypes: true })).sort((a,b)=>a.name.localeCompare(b.name))) {
    const rel = join(prefix, ent.name);
    if (ent.isDirectory()) await walk(join(dir, ent.name), rel);
    else hashes[rel] = createHash('sha256').update(await readFile(join(dir, ent.name))).digest('hex');
  }
}
await walk(out);
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
await writeFile(`${out}/manifest.json`, JSON.stringify({ engine: '0.8.6', integrity: lock.packages['node_modules/@rhwp/core'].integrity, files: hashes }, null, 2)+'\n');
console.log(`Prepared ${faces.length} font faces and ${Object.keys(hashes).length} verified assets.`);

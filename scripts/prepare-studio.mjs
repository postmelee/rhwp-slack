import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, writeFileSync, cpSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const spec = JSON.parse(readFileSync('studio/upstream.json', 'utf8'));
const cache = resolve('.cache');
mkdirSync(cache, {recursive:true});
const archive = resolve(cache, 'studio.tar');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
if (!existsSync(archive)) execFileSync('python3', ['scripts/prepare-studio-archive.py'], {stdio:'inherit',timeout:600_000});
if (hash(readFileSync(archive)) !== spec.archiveSha256) throw new Error('Studio source archive integrity mismatch');
const source = resolve(cache, 'studio-source');
mkdirSync(source, {recursive:true});
execFileSync('tar', ['-xf', archive, '-C', source]);
const studio = resolve(source, 'rhwp-studio');
const packagePath = resolve(studio, 'package.json');
const lockPath = resolve(studio, 'package-lock.json');
// The v0.9.1 commit references an AJV vendor directory absent from the
// public source tree. Use the verified npm release and preserve the locked
// fast-uri override. The upstream source archive itself stays byte-for-byte pinned.
if (spec.version === '0.9.1') {
  const pkg = JSON.parse(readFileSync(packagePath));
  const lock = JSON.parse(readFileSync(lockPath));
  const node = lock.packages['node_modules/ajv'];
  const vendor = 'file:../vendor/npm/ajv';
  if (pkg.devDependencies.ajv !== vendor || lock.packages[''].devDependencies.ajv !== vendor ||
      pkg.overrides['ajv@^8.0.0'] !== '$ajv' || node.resolved !== vendor ||
      node.version !== '8.20.0' || node.dependencies['fast-uri'] !== '4.2.2' ||
      lock.packages['node_modules/fast-uri'].version !== '4.2.2') {
    throw new Error('Unrecognized Studio 0.9.1 AJV dependency lock');
  }
  pkg.devDependencies.ajv = node.version;
  pkg.overrides['ajv@^8.0.0'] = {'.':'$ajv','fast-uri':'4.2.2'};
  lock.packages[''].devDependencies.ajv = node.version;
  node.resolved = 'https://registry.npmjs.org/ajv/-/ajv-8.20.0.tgz';
  node.integrity = 'sha512-Thbli+OlOj+iMPYFBVBfJ3OmCAnaSyNn4M1vz9T6Gka5Jt9ba/HIR56joy65tY6kx/FCF5VXNB819Y7/GUrBGA==';
  node.dependencies['fast-uri'] = '^3.0.1';
  writeFileSync(packagePath, JSON.stringify(pkg, null, 2)+'\n');
  writeFileSync(lockPath, JSON.stringify(lock, null, 2)+'\n');
}
const lockHash = hash(readFileSync(lockPath));
const stamp = resolve(studio, 'node_modules/.rhwp-slack-lock');
if (!existsSync(stamp) || readFileSync(stamp,'utf8') !== lockHash) {
  execFileSync('npm', ['ci', '--prefix', studio, '--ignore-scripts', '--no-audit', '--no-fund'], {stdio:'inherit'});
  writeFileSync(stamp, lockHash);
}
// Only static editor resources; omit sample documents and offline service workers.
const publicDir = resolve(cache, 'studio-public');
rmSync(publicDir, {recursive:true,force:true});
mkdirSync(publicDir, {recursive:true});
for (const name of ['fonts','icons','images','favicon.ico','theme-init.js','locale-init.js']) {
  cpSync(resolve(studio, 'public', name), resolve(publicDir, name), {recursive:true, dereference:true});
}
cpSync(resolve(source,'LICENSE'), resolve(publicDir,'LICENSE'));
cpSync(resolve(source,'THIRD_PARTY_LICENSES.md'), resolve(publicDir,'THIRD_PARTY_LICENSES.md'));
console.log(`Prepared verified Studio ${spec.version} (${spec.commit})`);

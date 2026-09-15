import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const files = (await readdir('tests/unit')).filter(f=>/\.test\.(ts|mjs)$/.test(f)).sort().map(f=>`tests/unit/${f}`);
if (!files.length) throw new Error('No unit tests discovered');
const result = spawnSync(process.execPath, ['--import','tsx','--test',...files], { stdio:'inherit' });
process.exit(result.status ?? 1);

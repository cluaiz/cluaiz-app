import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';
const output = 'node_modules/.cache/cluaiz-tests/extension-finish';
if (process.argv.slice(2).some(value => !['--activities', '--desktop'].includes(value))) throw Error('Unknown check option.');
const suite = process.argv.includes('--desktop') ? 'desktop_lifecycle' : process.argv.includes('--activities') ? 'activities' : 'packages';
await fs.mkdir(output, { recursive: true });
const script = output + '/' + suite + '.test.mjs';
await build({ entryPoints: ['test/' + (suite === 'desktop_lifecycle' ? suite : 'extension_' + suite) + '.test.ts'], outfile: script,
    bundle: true, platform: 'node', format: 'esm', external: ['@tauri-apps/*'] });
const result = spawnSync(process.execPath, [script], { encoding: 'utf8', timeout: 60000, windowsHide: true });
const log = (result.stdout ?? '') + (result.stderr ?? '');
await fs.writeFile(output + '/' + suite + '-checks.txt', log);
console.log(log);
if (result.error) console.error(result.error);
process.exitCode = result.status === 0 ? 0 : 1;

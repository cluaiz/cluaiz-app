import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';
import assert from 'node:assert/strict';

const root = process.cwd();
const output = path.join(root, 'node_modules/.cache/cluaiz-tests/component-reference');
await fs.mkdir(output, { recursive: true });
const bundled = path.join(output, 'checks.test.mjs');
await build({ entryPoints: ['test/component_reference.test.tsx'], outfile: bundled,
    bundle: true, platform: 'node', format: 'esm', jsx: 'automatic',
    external: ['react', 'react/*', 'react-dom', 'react-dom/*', 'zustand', 'zustand/*', '@tauri-apps/*', 'esbuild'] });
const checked = spawnSync(process.execPath, [bundled], { encoding: 'utf8', timeout: 60000, windowsHide: true });
await fs.writeFile(path.join(output, 'checks.txt'), checked.stdout + checked.stderr);
console.log(checked.stdout + checked.stderr);
assert.equal(checked.status, 0, 'Component reference checks failed.');
if (process.argv.slice(2).some(value => value !== '--browser')) throw Error('Only --browser is accepted.');
if (!process.argv.includes('--browser')) process.exit(0);

const require = createRequire(path.join(root, 'app/package.json'));
const { createServer } = await import(pathToFileURL(require.resolve('vite')));
const { default: tailwind } = await import(pathToFileURL(require.resolve('@tailwindcss/vite')));
let origin, result, vite;
const server = http.createServer(async (request, response) => {
    if (!origin || request.headers.origin !== origin) { response.writeHead(403).end(); return; }
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Cache-Control', 'no-store');
    if (request.method === 'OPTIONS') { response.end(); return; }
    if (request.url !== '/result' || request.method !== 'POST') { response.writeHead(404).end(); return; }
    const chunks = []; let size = 0;
    for await (const chunk of request) {
        size += chunk.length;
        if (size > 128 * 1024) { response.writeHead(413).end(); return; }
        chunks.push(chunk);
    }
    try { result = JSON.parse(Buffer.concat(chunks).toString()); response.end('ok'); }
    catch { response.writeHead(400).end(); }
});
try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const report = `http://127.0.0.1:${server.address().port}`;
    const probe = net.createServer();
    await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
    const port = probe.address().port;
    await new Promise(resolve => probe.close(resolve));
    vite = await createServer({ root, configFile: false, envFile: false, publicDir: path.join(root, 'public'),
        plugins: [tailwind()], esbuild: { jsx: 'automatic' }, clearScreen: false,
        server: { host: '127.0.0.1', port, strictPort: true, cors: false,
            watch: { ignored: ['**/app/src-tauri/**', '**/app/dist/**', '**/.agent/**'] } } });
    await vite.listen();
    origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
    const url = origin + '/test/fixtures/components-reference.html?report=' + encodeURIComponent(report);
    await fs.writeFile(path.join(output, 'browser-url.json'), JSON.stringify({ url }));
    console.log('COMPONENT_REFERENCE_BROWSER_URL=' + url);
    const deadline = Date.now() + 180000;
    while (!result && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 200));
    assert.ok(result, 'Browser component acceptance timed out.');
    await fs.writeFile(path.join(output, 'browser-result.json'), JSON.stringify(result, null, 2));
    console.log('COMPONENT_REFERENCE_RESULT=' + JSON.stringify(result));
    assert.ok(result.passed, result.error);
} finally { await vite?.close(); server.close(); }

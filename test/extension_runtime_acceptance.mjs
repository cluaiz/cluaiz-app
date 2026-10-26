import fs from 'node:fs/promises';
import { openSync, closeSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const background = process.argv.includes('--background');
const floating = process.argv.includes('--floating') || background;
const packages = process.argv.includes('--packages') || floating;
const evidenceRoot = path.join(root, 'node_modules/.cache/cluaiz-tests/extension-finish');
const output = path.join(evidenceRoot, background ? 'background-runtime' : floating ? 'floating-runtime' : packages ? 'packages-runtime' : 'runtime', randomUUID());
await fs.mkdir(output, { recursive: true });
const document = await fs.readFile(path.join(evidenceRoot, 'runtime-document.html'));
const digest = createHash('sha256').update(document).digest('hex');
const require = createRequire(path.join(root, 'app/package.json'));
const { createServer } = await import(pathToFileURL(require.resolve('vite')));
const { default: tailwind } = await import(pathToFileURL(require.resolve('@tailwindcss/vite')));
const results = {};
const webOnly = process.argv.includes('--web-only');
const desktopOnly = process.argv.includes('--desktop-only') || background;
if (webOnly && desktopOnly) throw new Error('Choose only one single-host mode.');
if (process.argv.slice(2).some(value => !['--web-only', '--desktop-only', '--packages', '--floating', '--background'].includes(value))) throw new Error('Unknown acceptance option.');
let escapes = 0;
let app;
let vite;
let origin;
const normalExitCodes = [];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const server = http.createServer(async (request, response) => {
    if (request.url === '/escape') { escapes++; response.end('unexpected guest request'); return; }
    if (!origin || request.headers.origin !== origin) { response.writeHead(403).end(); return; }
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Cache-Control', 'no-store');
    if (request.method === 'OPTIONS') { response.end(); return; }
    if (request.url === '/document') { response.setHeader('Content-Type', 'text/plain; charset=utf-8'); response.end(document); return; }
    if (request.url === '/package' && packages) { response.end(await fs.readFile(path.join(evidenceRoot, 'runtime-author-artifacts/fixture-runtime-0.1.0.tgz'))); return; }
    if (request.url !== '/result') { response.writeHead(404).end(); return; }
    const chunks = []; let size = 0;
    for await (const chunk of request) {
        size += chunk.length;
        if (size > 128 * 1024) { response.writeHead(413).end(); return; }
        chunks.push(chunk);
    }
    try {
        const result = JSON.parse(Buffer.concat(chunks).toString());
        if (!['web', 'desktop'].includes(result.kind)) throw new Error('Invalid result host kind');
        const key = background && result.phase === 2 ? 'desktop-close-off' : result.kind;
        results[key] = result;
        await fs.writeFile(path.join(output, key + '.json'), JSON.stringify(result, null, 2));
        console.log('EXTENSION_RUNTIME_RESULT=' + JSON.stringify({ kind: result.kind, phase: result.phase, passed: result.passed, error: result.error, digest: result.digest }));
        response.end('ok');
    } catch (error) { response.writeHead(400).end(String(error)); }
});
function launch(command, args, name, options = {}) {
    const fd = openSync(path.join(output, name + '.txt'), 'w');
    const child = spawn(command, args, { cwd: root, windowsHide: true, stdio: ['ignore', fd, fd], ...options });
    closeSync(fd);
    child.on('error', error => { child.launchError = error; });
    return child;
}
async function stop(child) {
    if (!child || child.exitCode !== null) return;
    if (process.platform === 'win32') await new Promise(resolve => {
        const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
        killer.on('exit', resolve); killer.on('error', resolve);
    });
    else child.kill('SIGTERM');
}
async function requireNormalExit(child) {
    const deadline = Date.now() + 30000;
    while (child.exitCode === null && Date.now() < deadline) await pause(100);
    assert.equal(child.exitCode, 0, 'Native App must exit normally without driver taskkill');
    normalExitCodes.push(child.exitCode);
}
let originalExit = 1;
try {
    assert.equal(process.platform, 'win32', 'Desktop acceptance currently executes on Windows.');
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const report = `http://127.0.0.1:${server.address().port}`;
    const probe = net.createServer();
    await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
    const port = probe.address().port;
    await new Promise(resolve => probe.close(resolve));
    vite = await createServer({ root, configFile: false, envFile: false, publicDir: false,
        plugins: [tailwind()], esbuild: { jsx: 'automatic' }, clearScreen: false,
        server: { host: '127.0.0.1', port, strictPort: true, cors: false,
            watch: { ignored: ['**/app/dist/**', '**/app/src-tauri/**', '**/.agent/**'] } } });
    await vite.listen();
    origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
    const url = origin + '/test/fixtures/extensions/runtime.html?report=' + encodeURIComponent(report) + (packages ? '&installed=1' : '') + (floating ? '&floating=1' : '') + (background ? '&background=1' : '');
    console.log('EXTENSION_RUNTIME_BROWSER_URL=' + url);
    console.log('EXTENSION_RUNTIME_EVIDENCE=' + output);
    await fs.writeFile(path.join(output, 'urls.json'), JSON.stringify({ url, report, digest }, null, 2));
    const config = { identifier: 'com.cluaiz.runtime-test-' + randomUUID().replaceAll('-', ''), build: { beforeDevCommand: '', devUrl: origin },
        app: { windows: [{ label: 'main', title: 'Cluaiz extension runtime acceptance', visible: background,
            width: 1000, height: 720, url, dataDirectory: path.join(output, 'main-profile') }] } };
    const configPath = path.join(output, 'tauri.config.json');
    await fs.writeFile(configPath, JSON.stringify(config));
    const home = path.join(output, 'engine-home');
    await fs.mkdir(home, { recursive: true });
    const environment = { ...process.env, CARGO_NET_OFFLINE: 'true', CLUAIZ_HOME: home };
    delete environment.WEBVIEW2_USER_DATA_FOLDER;
    if (!webOnly) app = launch(process.execPath, [path.join(root, 'node_modules/@tauri-apps/cli/tauri.js'),
        'dev', '--no-watch', '--no-dev-server', '--config', configPath], 'tauri', { cwd: path.join(root, 'app'), env: environment });
    const deadline = Date.now() + 360000;
    while ((!desktopOnly && !results.web) || (!webOnly && !results.desktop)) {
        if (app?.launchError) throw app.launchError;
        if (app && app.exitCode !== null && !results.desktop) throw new Error('Desktop exited before reporting: see tauri.txt');
        if (Object.values(results).some(result => !result.passed)) throw new Error(JSON.stringify(results));
        if (Date.now() > deadline) throw new Error('Runtime acceptance deadline exceeded; inspect renderer/native logs.');
        await pause(200);
    }
    if (background) {
        assert.equal(results.desktop.passed, true, results.desktop.error);
        await requireNormalExit(app);
        app = launch(process.execPath, [path.join(root, 'node_modules/@tauri-apps/cli/tauri.js'),
            'dev', '--no-watch', '--no-dev-server', '--config', configPath], 'tauri-close-off', { cwd: path.join(root, 'app'), env: environment });
        while (!results['desktop-close-off']) {
            if (app.launchError) throw app.launchError;
            if (app.exitCode !== null) throw Error('Restart exited before close-off proof');
            if (Date.now() > deadline) throw Error('Close-off restart timed out');
            if (Object.values(results).some(result => !result.passed)) throw Error(JSON.stringify(results));
            await pause(100);
        }
        await requireNormalExit(app);
    }
    for (const result of Object.values(results)) {
        assert.equal(result.passed, true, result.error);
        assert.equal(result.digest, digest, 'Hosts loaded different artifacts');
    }
    assert.equal(escapes, 0, 'Guest network request escaped CSP');
    originalExit = 0;
} catch (error) {
    await fs.writeFile(path.join(output, 'failure.txt'), String(error.stack ?? error));
    console.error(String(error));
} finally {
    await stop(app);
    await vite?.close();
    server.close();
    // Restore the ordinary debug binary; never leave a test URL embedded there.
    let restored = null;
    if (app) {
        const restore = launch('cargo', ['build', '--offline', '--locked', '--manifest-path', 'app/src-tauri/Cargo.toml'], 'restore-default-build');
        restored = await new Promise(resolve => { restore.on('exit', resolve); restore.on('error', () => resolve(-1)); });
    }
    const summary = { passed: originalExit === 0 && (webOnly || restored === 0), hosts: webOnly ? ['web'] : desktopOnly ? ['desktop'] : ['web', 'desktop'],
        results, escapes, digest, normalExitCodes, defaultBuildRestored: restored === null ? null : restored === 0 };
    await fs.writeFile(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2));
    console.log('EXTENSION_RUNTIME_SUMMARY=' + JSON.stringify({ passed: summary.passed, escapes, defaultBuildRestored: summary.defaultBuildRestored }));
    process.exitCode = summary.passed ? 0 : 1;
}

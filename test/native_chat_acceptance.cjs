// Windows acceptance runner: real Tauri/WebView + native Engine IPC + installed model.
// Requires an existing release Engine and model; never builds or edits the Engine repo.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const seed = path.resolve(process.env.CLUAIZ_ACCEPT_SEED || path.join(process.env.USERPROFILE, '.cluaiz'));
const exe = process.env.CLUAIZ_ACCEPT_ENGINE;
const model = process.env.CLUAIZ_ACCEPT_MODEL;
const browserMode = process.env.CLUAIZ_ACCEPT_BROWSER === '1';
const httpPort = Number(process.env.CLUAIZ_ACCEPT_HTTP_PORT);
const vitePort = browserMode ? Number(process.env.CLUAIZ_ACCEPT_VITE_PORT) : 1442;
if (browserMode) assert.ok(Number.isInteger(httpPort) && httpPort >= 1024 && httpPort <= 65535,
    'Browser mode needs an explicit unused CLUAIZ_ACCEPT_HTTP_PORT.');
if (browserMode) assert.ok(Number.isInteger(vitePort) && vitePort >= 1024 && vitePort <= 65535 && vitePort !== httpPort,
    'Browser mode needs a distinct unused CLUAIZ_ACCEPT_VITE_PORT for its isolated browser origin.');
const documentPath = process.env.CLUAIZ_ACCEPT_DOCUMENT;
const developerDocument = documentPath ? fs.readFileSync(path.resolve(documentPath)) : null;
if (browserMode) assert.ok(developerDocument, 'Browser mode requires the selected developer document.');
const documentDigest = developerDocument ? crypto.createHash('sha256').update(developerDocument).digest('hex') : null;
assert.ok(exe && fs.existsSync(exe), 'Supply CLUAIZ_ACCEPT_ENGINE (existing compatible release binary).');
assert.ok(model, 'Supply CLUAIZ_ACCEPT_MODEL (installed model ID).');
const output = path.join(root, 'node_modules/.cache/cluaiz-tests/extension-chat-hardening/native', crypto.randomUUID());
const home = path.join(output, 'engine-home');
fs.mkdirSync(path.join(home, 'engine/config'), { recursive: true });
function linkTree(from, to) {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
        const target = path.join(to, entry.name);
        if (entry.isDirectory()) linkTree(path.join(from, entry.name), target);
        else if (fs.statSync(path.join(from, entry.name)).size < 1024 * 1024) fs.copyFileSync(path.join(from, entry.name), target);
        else fs.linkSync(path.join(from, entry.name), target);
    }
}
linkTree(path.join(seed, 'bin'), path.join(home, 'bin'));
// Replace only the disposable link, not the user's installed executable.
fs.unlinkSync(path.join(home, 'bin/cluaiz.exe'));
fs.copyFileSync(path.resolve(exe), path.join(home, 'bin/cluaiz.exe'));
for (const directory of ['engine/drivers', 'engine/media']) {
    if (fs.existsSync(path.join(seed, directory))) linkTree(path.join(seed, directory), path.join(home, directory));
}
if (fs.existsSync(path.join(seed, 'engine/config/hardware_profile.json'))) {
    fs.copyFileSync(path.join(seed, 'engine/config/hardware_profile.json'), path.join(home, 'engine/config/hardware_profile.json'));
}
const read = name => JSON.parse(fs.readFileSync(path.join(seed, 'engine/config', name), 'utf8'));
const registry = read('model_registry.json');
const entry = registry.installed_models[model];
assert.ok(entry && entry.category === 'chat', 'Selected installed chat model is missing.');
registry.installed_models = { [model]: entry };
const permission = read('permission.json');
permission.connection_protocol = browserMode ? 'http' : 'ffi';
if (browserMode) { permission.api_host = '127.0.0.1'; permission.api_port = httpPort; }
permission.chat_models = { text: model, vision: null, audio: null };
if (permission.active_slots?.chat_slot) permission.active_slots.chat_slot.model_id = model;
permission.api_auth = { ...permission.api_auth, tokens: [] };
const settings = read('settings.json');
settings.optimization.think_mode = 'Off';
settings.samplers.temp = 0;
if (developerDocument) {
    // Bound only this disposable live test; do not alter the user's planner settings.
    settings.optimization.custom_context_window = 2048;
    settings.optimization.n_gpu_layers = 0;
    settings.optimization.n_threads = 2;
}
for (const [name, value] of Object.entries({ 'model_registry.json': registry, 'permission.json': permission, 'settings.json': settings })) {
    fs.writeFileSync(path.join(home, 'engine/config', name), JSON.stringify(value, null, 2));
}
const guards = ['session.token', 'engine/config/permission.json', 'engine/config/settings.json', 'engine/config/model_registry.json'];
const hashes = () => Object.fromEntries(guards.map(name => [name,
    crypto.createHash('sha256').update(fs.readFileSync(path.join(seed, name))).digest('hex')]));
const before = hashes();
const userPath = () => cp.execFileSync('powershell.exe', ['-NoProfile', '-Command',
    "[Environment]::GetEnvironmentVariable('Path','User')"], { encoding: 'utf8', windowsHide: true });
const pathBefore = userPath();
let progress, result, vite, app;
let hostOrigin, browserToken, browserGuards;
const engineOrigin = browserMode ? `http://127.0.0.1:${httpPort}` : null;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const server = http.createServer(async (req, res) => {
    if (browserMode) {
        if (req.headers.origin !== hostOrigin || !hostOrigin) { res.writeHead(403).end('Test host origin required'); return; }
        res.setHeader('Access-Control-Allow-Origin', hostOrigin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Cache-Control', 'no-store');
    } else res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') { res.end(); return; }
    if (req.url === '/config') { res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ model, documentDigest, kind: browserMode ? 'web' : 'desktop',
            ...(browserMode ? { engineOrigin, token: browserToken } : {}) })); return; }
    if (req.url === '/document' && developerDocument) { res.setHeader('Content-Type', 'text/plain; charset=utf-8'); res.end(developerDocument); return; }
    const chunks = [];
    for await (const chunk of req) {
        chunks.push(chunk);
        if (chunks.reduce((sum, row) => sum + row.length, 0) > 1_000_000) { res.writeHead(413).end(); return; }
    }
    try {
        const body = JSON.parse(Buffer.concat(chunks).toString());
        if (req.url === '/progress') progress = body;
        else if (req.url === '/result') result = body;
        else { res.writeHead(404).end(); return; }
        fs.writeFileSync(path.join(output, req.url.slice(1) + '.json'), JSON.stringify(body, null, 2));
        console.log(JSON.stringify({ phase: req.url, passed: body.passed, checks: body.checks, error: body.error }));
        res.end('ok');
    } catch { res.writeHead(400).end(); }
});
function launch(command, args, name, options = {}) {
    const log = fs.openSync(path.join(output, name + '.log'), 'a');
    const child = cp.spawn(command, args, { cwd: root, windowsHide: true, stdio: ['ignore', log, log], ...options });
    fs.closeSync(log);
    child.on('error', error => { child.launchError = error; });
    return child;
}
async function stop(child) {
    if (!child || child.exitCode !== null) return;
    if (process.platform === 'win32') cp.spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    else child.kill('SIGTERM');
}
async function run() {
    assert.equal(process.platform, 'win32', 'This native runner currently covers Windows.');
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const report = `http://127.0.0.1:${server.address().port}`;
    const viteCli = path.join(path.dirname(require.resolve('vite/package.json', { paths: [path.join(root, 'app')] })), 'bin/vite.js');
    vite = launch(process.execPath, [viteCli, '--config', 'app/vite.config.ts', '--host', '127.0.0.1', '--port', String(vitePort), '--strictPort'], 'vite');
    const origin = `http://127.0.0.1:${vitePort}`;
    hostOrigin = origin;
    const viteDeadline = Date.now() + 60000;
    for (let i = 0; ; i++) {
        if (vite.launchError) throw vite.launchError;
        if (vite.exitCode !== null) throw Error(`Vite exited (${vite.exitCode}) before readiness; inspect vite.log.`);
        try { if ((await fetch(origin + '/test/fixtures/extensions/native-chat.html')).ok) break; } catch {}
        assert.ok(Date.now() < viteDeadline, 'Vite readiness timed out; inspect vite.log.'); await sleep(100);
    }
    const fixture = developerDocument ? 'live-chat' : 'native-chat';
    // Tauri 2.11.2's WindowConfig -> WebviewAttributes conversion does not
    // forward dataDirectory. A fresh test identifier isolates the actual default
    // WebView profile, shared only by the two launches of this one run.
    const config = { identifier: 'com.cluaiz.acceptance.run-' + path.basename(output), build: { beforeDevCommand: '', devUrl: origin },
        app: { windows: [{ label: 'main', title: 'Cluaiz isolated native acceptance', width: 1100, height: 700,
            visible: !developerDocument,
            url: origin + `/test/fixtures/extensions/${fixture}.html?report=` + encodeURIComponent(report) }] } };
    const configPath = path.join(output, 'tauri.acceptance.json');
    fs.writeFileSync(configPath, JSON.stringify(config));
    const env = { ...process.env, CARGO_NET_OFFLINE: 'true', CLUAIZ_HOME: home,
        PATH: path.join(home, 'bin') + path.delimiter + process.env.PATH,
        HTTP_PROXY: 'http://127.0.0.1:9', HTTPS_PROXY: 'http://127.0.0.1:9', ALL_PROXY: 'http://127.0.0.1:9',
        NO_PROXY: '127.0.0.1,localhost' };
    // A global WebView2 profile override would also override isolated child views.
    delete env.WEBVIEW2_USER_DATA_FOLDER;
    if (browserMode) {
        app = launch(path.resolve(exe), ['serve'], 'engine-http', { env });
        const readyDeadline = Date.now() + 60000;
        while (true) {
            if (app.launchError) throw app.launchError;
            if (app.exitCode !== null) throw Error('Owned HTTP Engine exited before readiness; inspect engine-http.log.');
            try {
                browserToken = fs.readFileSync(path.join(home, 'session.token'), 'utf8').trim();
                if ((await fetch(engineOrigin + '/health', { headers: { Authorization: 'Bearer ' + browserToken } })).ok) break;
            } catch {}
            assert.ok(Date.now() < readyDeadline, 'Owned HTTP Engine readiness timed out.');
            await sleep(100);
        }
        const listener = cp.execFileSync('powershell.exe', ['-NoProfile', '-Command',
            `Get-NetTCPConnection -State Listen -OwningProcess ${app.pid} | Select-Object -ExpandProperty LocalAddress | ConvertTo-Json -Compress`],
            { encoding: 'utf8', windowsHide: true }).trim();
        const addresses = JSON.parse(listener);
        assert.ok([addresses].flat().length && [addresses].flat().every(value => value === '127.0.0.1' || value === '::1'),
            'Owned HTTP Engine must listen on loopback only.');
        const missingOrigin = await fetch(report + '/config');
        const wrongOrigin = await fetch(report + '/config', { headers: { Origin: 'https://untrusted.example' } });
        assert.equal(missingOrigin.status, 403, 'Config without host origin exposed the test token.');
        assert.equal(wrongOrigin.status, 403, 'Config from another origin exposed the test token.');
        browserGuards = { addresses, configWithoutOrigin: missingOrigin.status, configWrongOrigin: wrongOrigin.status };
        const url = origin + '/test/fixtures/extensions/live-chat.html?report=' + encodeURIComponent(report);
        fs.writeFileSync(path.join(output, 'browser-url.json'), JSON.stringify({ url, engineOrigin, documentDigest }));
        console.log('EXTENSION_LIVE_BROWSER_URL=' + url);
        const deadline = Date.now() + 600000;
        while (!result) {
            assert.ok(app.exitCode === null, 'Owned HTTP Engine exited during browser acceptance.');
            assert.ok(Date.now() < deadline, 'Browser acceptance timed out.');
            await sleep(200);
        }
        assert.ok(result.passed, result.error || 'No browser result.');
        assert.equal(result.digest, documentDigest, 'Browser loaded another artifact.');
        return;
    }
    const cli = path.join(root, 'node_modules/@tauri-apps/cli/tauri.js');
    for (let phase = 0; phase < 2; phase++) {
        app = launch(process.execPath, [cli, 'dev', '--no-watch', '--no-dev-server', '--config', configPath], 'tauri', {
            cwd: path.join(root, 'app'), env,
        });
        const deadline = Date.now() + 600_000;
        while (app.exitCode === null) {
            if (app.launchError) throw app.launchError;
            if (Date.now() > deadline) throw Error('Native acceptance timed out; inspect tauri/vite logs.');
            if (result) { await sleep(500); break; }
            await sleep(200);
        }
        if (result) break;
        assert.ok(progress, 'Desktop exited before real model/disk progress; see logs.');
        assert.equal(phase, 0, 'Second desktop launch exited before final result.');
    }
    assert.ok(result?.passed, result?.error || 'No native acceptance result.');
    assert.ok(progress, 'Native acceptance must create its first turn in this run before restoring it.');
    const files = fs.readdirSync(path.join(home, 'data/chats'));
    assert.ok(files.includes('sessions_index.json'), 'Real disk catalog is missing.');
} 
run().then(() => { process.exitCode = 0; }, error => {
    result = { ...result, passed: false, error: error.message }; process.exitCode = 1;
}).finally(async () => {
    await stop(app); await stop(vite); server.close();
    // The dev acceptance config is embedded in the debug artifact. Restore the
    // normal configuration so running the usual App binary cannot reopen a test URL.
    let restored = { status: 0 };
    if (!browserMode) {
        const restoreLog = fs.openSync(path.join(output, 'restore-default-build.log'), 'w');
        restored = cp.spawnSync('cargo', ['build', '--offline', '--locked', '--manifest-path', 'app/src-tauri/Cargo.toml'], {
            cwd: root, windowsHide: true, timeout: 300_000, stdio: ['ignore', restoreLog, restoreLog],
        });
        fs.closeSync(restoreLog);
    }
    const unchanged = JSON.stringify(before) === JSON.stringify(hashes());
    const userPathUnchanged = pathBefore === userPath();
    fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify({ result, progress,
        guardedUserFilesUnchanged: unchanged, userPathUnchanged, defaultBuildRestored: restored.status === 0,
        nativeBuildLaunched: !browserMode, browserGuards, documentDigest, engine: path.resolve(exe), output }, null, 2));
    console.log(JSON.stringify({ passed: result?.passed, error: result?.error, guardedUserFilesUnchanged: unchanged, userPathUnchanged, output }));
    if (!unchanged || !userPathUnchanged || restored.status !== 0) process.exitCode = 1;
});

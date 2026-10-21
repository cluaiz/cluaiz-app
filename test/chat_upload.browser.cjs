// Real browser + local release engine. No model responses or App modules are replaced.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { createHash } = require('node:crypto');

function required(name) {
    assert.ok(process.env[name], `Set ${name}`);
    return process.env[name];
}
const { chromium } = require(required('CLUAIZ_BROWSER_PLAYWRIGHT'));
const engine = path.resolve(required('CLUAIZ_BROWSER_ENGINE'));
const seed = path.resolve(required('CLUAIZ_BROWSER_SEED_HOME'));
let appUrl = process.env.CLUAIZ_BROWSER_APP_URL;
const visionModel = required('CLUAIZ_BROWSER_VISION_MODEL');
const output = path.resolve('node_modules/.cache/cluaiz-tests/browser-upload', new Date().toISOString().replace(/[:.]/g, '-'));
const home = path.join(output, 'home');
const checks = [];
const blocked = [];
const guardedFiles = process.env.CLUAIZ_BROWSER_GUARD_HOME ? ['session.token', 'engine/config/settings.json', 'engine/config/model_registry.json', 'engine/config/permission.json'].map(name => path.join(process.env.CLUAIZ_BROWSER_GUARD_HOME, name)) : [];
function fingerprints() {
    return guardedFiles.map(file => ({ file, sha256: fs.existsSync(file) ? createHash('sha256').update(fs.readFileSync(file)).digest('hex') : null }));
}
const original = fingerprints();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let browser;
let daemon;
let engineLog;
let page;
let preview;
let previewLog;

function linkTree(from, to) {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
        const source = path.join(from, entry.name);
        const destination = path.join(to, entry.name);
        if (entry.isDirectory()) linkTree(source, destination);
        else fs.linkSync(source, destination);
    }
}

async function freePort() {
    const socket = net.createServer();
    await new Promise((resolve, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', resolve); });
    const port = socket.address().port;
    await new Promise(resolve => socket.close(resolve));
    return port;
}

async function run() {
    fs.mkdirSync(path.join(home, 'engine/config'), { recursive: true });
    const registry = JSON.parse(fs.readFileSync(path.join(seed, 'engine/config/model_registry.json'), 'utf8'));
    assert.ok(registry.installed_models[visionModel], 'Configured vision package must be installed');
    fs.writeFileSync(path.join(home, 'engine/config/model_registry.json'), JSON.stringify(registry));
    const settings = JSON.parse(fs.readFileSync(path.join(seed, 'engine/config/settings.json'), 'utf8'));
    settings.optimization.think_mode = 'Off';
    settings.samplers.temp = 0;
    if (process.env.CLUAIZ_BROWSER_BATCH_TOKENS) {
        const batch = Number(process.env.CLUAIZ_BROWSER_BATCH_TOKENS);
        assert.ok(Number.isSafeInteger(batch) && batch > 0, 'Batch tokens must be a positive integer');
        settings.optimization.batch_size = batch;
        settings.optimization.ubatch_size = batch;
    }
    fs.writeFileSync(path.join(home, 'engine/config/settings.json'), JSON.stringify(settings));
    linkTree(path.join(seed, 'engine/media'), path.join(home, 'engine/media'));
    const port = await freePort();
    const base = `http://127.0.0.1:${port}`;
    fs.writeFileSync(path.join(home, 'engine/config/permission.json'), JSON.stringify({
        api_host: '127.0.0.1', api_port: port, api_auth: { required: true, tokens: [] },
        lazy_load_model: true, agent_security_mode: 'strict',
        chat_models: { text: visionModel },
        active_slots: { chat_slot: { model_id: visionModel, format_type: 'gguf', supported_tasks: ['text-generation'] } },
        vectorize_user_input: false, vectorize_ai_response: false,
    }));
    engineLog = fs.createWriteStream(path.join(output, 'engine.log'));
    daemon = spawn(engine, ['serve'], {
        cwd: path.dirname(engine), windowsHide: true,
        env: { ...process.env, CLUAIZ_HOME: home, CLUAIZ_HOST: '127.0.0.1', CLUAIZ_PORT: String(port) },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    daemon.stdout.pipe(engineLog); daemon.stderr.pipe(engineLog);
    let spawnError;
    daemon.on('error', error => { spawnError = error; });
    const deadline = Date.now() + 60_000;
    while (true) {
        if (spawnError) throw spawnError;
        assert.equal(daemon.exitCode, null, 'Isolated engine exited; see engine.log');
        try { if ((await fetch(`${base}/health`)).ok) break; } catch {}
        assert.ok(Date.now() < deadline, 'Isolated engine did not become healthy');
        await sleep(200);
    }
    const token = fs.readFileSync(path.join(home, 'session.token'), 'utf8').trim();
    async function endpointMemory(label) {
        const response = await fetch(`${base}/v1/system/live`, { headers: { Authorization: `Bearer ${token}` } });
        const value = await response.json();
        console.log('ENGINE STARTUP SNAPSHOT:', label, JSON.stringify(value.memory));
        fs.writeFileSync(path.join(output, `memory-${label}.json`), JSON.stringify(value, null, 2));
    }
    await endpointMemory('before-browser');
    if (!appUrl) {
        const appPort = await freePort();
        appUrl = `http://127.0.0.1:${appPort}`;
        const vite = path.join(path.dirname(require.resolve('vite/package.json', { paths: [path.resolve('app')] })), 'bin/vite.js');
        previewLog = fs.createWriteStream(path.join(output, 'app.log'));
        preview = spawn(process.execPath, [vite, 'preview', '--host', '127.0.0.1', '--port', String(appPort), '--strictPort'], {
            cwd: path.resolve('app'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
        });
        preview.stdout.pipe(previewLog); preview.stderr.pipe(previewLog);
        preview.on('error', error => { spawnError = error; });
        const deadline = Date.now() + 30_000;
        while (true) {
            if (spawnError) throw spawnError;
            assert.equal(preview.exitCode, null, 'App preview exited; see app.log');
            try { if ((await fetch(appUrl)).ok) break; } catch {}
            assert.ok(Date.now() < deadline, 'App preview did not become healthy');
            await sleep(100);
        }
    }
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(({ port, token }) => {
        localStorage.setItem('cluaiz_connection_fallback', JSON.stringify({ protocol: 'http', host: '127.0.0.1', port }));
        localStorage.setItem('cluaiz_api_token', token);
    }, { port, token });
    // Keep this test confined to the App and its isolated local engine.
    await context.route('**/*', route => {
        const origin = new URL(route.request().url()).origin;
        return origin === new URL(appUrl).origin || origin === base ? route.continue() : route.abort();
    });
    page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(appUrl);
    const prompt = page.locator('[role=textbox][contenteditable=true]');
    await prompt.waitFor({ state: 'visible', timeout: 60_000 });
    console.log('BROWSER READY:', (await page.locator('body').innerText()).slice(-1200));
    if (process.argv.includes('--inspect')) {
        console.log('FILE INPUT ACCEPT:', await page.locator('input[type=file]').getAttribute('accept'));
        await page.screenshot({ path: path.join(output, 'ready.png'), fullPage: true });
        return;
    }
    if (process.argv.includes('--picker')) {
        await page.waitForFunction(() => document.querySelector('input[type=file]')?.accept.includes('image/*'));
        const accept = await page.locator('input[type=file]').getAttribute('accept');
        console.log('FILE INPUT ACCEPT:', accept);
        assert.ok(accept.includes('audio/*'), 'Upload picker must offer audio accepted by the existing staging handler');
        assert.ok(accept.includes('video/*'), 'Vision upload picker must offer video accepted by the existing staging handler');
        checks.push('audio-and-video-picker-filters');
        const fixtures = required('CLUAIZ_BROWSER_MEDIA_FIXTURES');
        for (const [name, file, mimeType] of [
            ['browser-audio.wav', 'jfk.wav', 'audio/wav'],
            ['browser-video.mp4', 'red-blue-audio.mp4', 'video/mp4'],
        ]) {
            await pick([{ name, mimeType, buffer: fs.readFileSync(path.join(fixtures, file)) }]);
            await page.getByText(name, { exact: true }).first().waitFor();
            await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });
            await page.getByText(name, { exact: true }).first().hover();
            await page.getByTitle('Remove file', { exact: true }).click();
            await page.getByText(name, { exact: true }).first().waitFor({ state: 'hidden' });
            checks.push(`${mimeType}-picker-staging-removal`);
        }
        await pick([{ name: 'blocked.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('not executable') }]);
        await page.getByText(/Archive and executable files.*are not supported/).waitFor();
        assert.equal(await page.getByText('blocked.exe', { exact: true }).count(), 0);
        checks.push('executable-rejected-before-send');
        assert.deepEqual(errors, []);
        for (const check of checks) console.log('PASS:', check);
        return;
    }

    async function pick(files) {
        await page.getByTitle('Add context, files, or skills').click();
        const chooserPromise = page.waitForEvent('filechooser');
        await page.getByRole('button', { name: 'Upload File' }).click();
        await (await chooserPromise).setFiles(files);
    }

    async function upload(files, question, expected, types, label) {
        await page.goto(appUrl);
        await prompt.waitFor({ state: 'visible', timeout: 60_000 });
        if (types.some(type => type === 'image_url' || type === 'video_url')) {
            await page.waitForFunction(() => document.querySelector('input[type=file]')?.accept.includes('image/*'));
        }
        await pick(files);
        for (const file of files) await page.getByText(file.name, { exact: true }).first().waitFor();
        await prompt.fill(question);
        const requestPromise = page.waitForRequest(r => new URL(r.url()).pathname === '/v1/chat/completions' && r.method() === 'POST');
        const responsePromise = page.waitForResponse(r => new URL(r.url()).pathname === '/v1/chat/completions' && r.request().method() === 'POST', { timeout: 180_000 });
        await page.getByTitle('Send message', { exact: true }).click();
        const request = await requestPromise;
        const payload = request.postDataJSON();
        const last = payload.messages.at(-1).content;
        const media = last.filter(part => part.type !== 'text');
        assert.deepEqual(media.map(part => part.type), types);
        for (let i = 0; i < files.length; i++) {
            const value = media[i][types[i]];
            const uri = value.url;
            assert.ok(Buffer.from(uri.split(',')[1], 'base64').equals(files[i].buffer), 'Actual browser bytes must survive serialization');
            if (types[i] === 'file_url') assert.equal(value.name, files[i].name);
            if (types[i] === 'video_url') assert.equal(value.fps, undefined);
            if (types[i] === 'audio_url') assert.ok(uri.startsWith(`data:${files[i].mimeType};base64,`));
        }
        const response = await responsePromise;
        assert.equal(response.status(), 200, await response.text());
        await response.finished();
        await page.getByTitle('Stop generating', { exact: true }).waitFor({ state: 'hidden', timeout: 180_000 });
        const messages = page.locator('[data-message-index]');
        assert.ok(await messages.count() >= 2, 'User attachment and assistant answer must render');
        const answer = await messages.last().innerText();
        if (/Request failed: (Media needs \d+ host bytes; live RAM budget is \d+|Insufficient live RAM for media request:)/.test(answer)) {
            blocked.push({ label, reason: answer });
            checks.push(`${label}-bytes-and-visible-memory-refusal`);
            console.log('BLOCKED:', label, answer.replace(/\s+/g, ' '));
        } else {
            for (const value of expected) assert.match(answer, value);
            checks.push(label);
            console.log('PASS:', label);
        }
        fs.writeFileSync(path.join(output, `${label}.json`), JSON.stringify({ payload, answer }, null, 2));
        await page.screenshot({ path: path.join(output, `${label}.png`), fullPage: true });
        return { answer, url: page.url() };
    }

    if (!process.argv.includes('--visual')) {
    const code = await upload([
        { name: 'browser-proof.tsx', mimeType: 'text/plain', buffer: Buffer.from('export const uploadProof = "ORBIT739";\n') },
        { name: 'browser-note.md', mimeType: 'text/markdown', buffer: Buffer.from('# Browser note\nReference: MAPLE461\n') },
    ], 'Read both attached files. Reply with only the uploadProof string and the Reference value.',
    [/ORBIT739/, /MAPLE461/], ['file_url', 'file_url'], 'code-and-markdown');

    await page.reload();
    await prompt.waitFor({ state: 'visible', timeout: 60_000 });
    await page.locator('[data-message-index]').last().getByText(/ORBIT739/).first().waitFor({ timeout: 30_000 });
    assert.equal(page.url(), code.url, 'Refresh must retain this chat');
    for (const name of ['browser-proof.tsx', 'browser-note.md']) {
        await page.locator('[data-message-index]').getByText(name, { exact: true }).first().waitFor();
    }
    checks.push('code-attachments-and-answer-survive-refresh');
    console.log('PASS: code-attachments-and-answer-survive-refresh');
    }
    if (process.argv.includes('--text')) {
        assert.deepEqual(errors, []);
        return;
    }

    const imageUri = await page.evaluate(() => {
        const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
        const graphics = canvas.getContext('2d'); graphics.fillStyle = '#0000ff'; graphics.fillRect(0, 0, 64, 64);
        return canvas.toDataURL('image/png');
    });
    await endpointMemory('before-image');
    await upload([{ name: 'browser-image.png', mimeType: 'image/png', buffer: Buffer.from(imageUri.split(',')[1], 'base64') }],
        'Name the dominant color in the attached image. Reply with one color word.', [/blue/i], ['image_url'], 'image-color');

    const pdfPage = await context.newPage();
    await pdfPage.setContent('<!doctype html><html><body style="margin:0;background:#ff0000;width:200px;height:200px"></body></html>');
    const pdf = await pdfPage.pdf({ width: '200px', height: '200px', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    await pdfPage.close();
    await upload([{ name: 'browser-page.pdf', mimeType: 'application/pdf', buffer: pdf }],
        'Name the dominant color of the page in the attached PDF. Reply with one color word.', [/red/i], ['file_url'], 'pdf-visual-color');

    if (process.env.CLUAIZ_BROWSER_MEDIA_FIXTURES) {
        const fixtures = process.env.CLUAIZ_BROWSER_MEDIA_FIXTURES;
        await upload([{ name: 'browser-audio.wav', mimeType: 'audio/wav', buffer: fs.readFileSync(path.join(fixtures, 'jfk.wav')) }],
            'Transcribe the attached speech in English.', [/fellow americans/i], ['audio_url'], 'audio-transcription');
        await upload([{ name: 'browser-video.mp4', mimeType: 'video/mp4', buffer: fs.readFileSync(path.join(fixtures, 'red-blue-audio.mp4')) }],
            'State the main color at 0 seconds and at 1 second, in that order. Reply with two color words.', [/red.*blue/is], ['video_url'], 'video-frame-colors');
    }

    const accept = await page.locator('input[type=file]').getAttribute('accept');
    console.log('FILE INPUT ACCEPT:', accept);
    assert.ok(accept.includes('audio/*'), 'Upload picker must offer audio accepted by the existing staging handler');
    assert.ok(accept.includes('video/*'), 'Vision upload picker must offer video accepted by the existing staging handler');
    checks.push('audio-and-video-picker-filters');
    assert.deepEqual(errors, [], 'No unhandled browser error');
    if (blocked.length) process.exitCode = 2;
}

run().catch(async error => {
    if (page && !page.isClosed()) {
        console.error('BROWSER FAILURE:', (await page.locator('body').innerText()).slice(-2500));
        await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {});
    }
    console.error(error.stack);
    process.exitCode = 1;
}).finally(async () => {
    if (browser) await browser.close();
    if (daemon && daemon.exitCode === null) {
        daemon.kill();
        await new Promise(resolve => { daemon.once('exit', resolve); setTimeout(resolve, 5000); });
    }
    if (engineLog) engineLog.end();
    if (preview && preview.exitCode === null) {
        preview.kill();
        await new Promise(resolve => { preview.once('exit', resolve); setTimeout(resolve, 5000); });
    }
    if (previewLog) previewLog.end();
    const originalFilesUnchanged = JSON.stringify(original) === JSON.stringify(fingerprints());
    if (!originalFilesUnchanged) process.exitCode = 1;
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ checks, blocked, batchTokens: process.env.CLUAIZ_BROWSER_BATCH_TOKENS || 'seed settings', originalFilesUnchanged, guardedFileCount: guardedFiles.length, exitCode: process.exitCode || 0 }, null, 2));
    console.log('Original guarded user files unchanged:', originalFilesUnchanged);
    console.log('Evidence:', output);
});

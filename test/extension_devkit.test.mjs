import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { EXTENSION_SCHEMA_VERSION, EXTENSION_HOST_API } from '@cluaiz/extension-sdk';
import { scaffold } from '../packages/extension-devkit/src/scaffold.mjs';
import { ownedPath, project, readJson, jsonBytes, digest } from '../packages/extension-devkit/src/project.mjs';
import { buildProject, verifyBuild, packProject } from '../packages/extension-devkit/src/build.mjs';

async function temporary(t) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cluaiz-devkit-test-'));
    t.after(async () => {
        const actual = await fs.realpath(root);
        assert.equal(path.dirname(actual), await fs.realpath(os.tmpdir()));
        assert.ok(path.basename(actual).startsWith('cluaiz-devkit-test-'));
        await fs.rm(actual, { recursive: true, force: true });
    });
    return root;
}
function metadata() {
    return { name: '@test/notes', version: '1.0.0', private: true, hub_type: 'extension',
        app: { schema_version: EXTENSION_SCHEMA_VERSION, hub_type: 'extension', id: 'test.notes', name: 'Notes', version: '1.0.0',
            host_api: { min: EXTENSION_HOST_API, max: EXTENSION_HOST_API }, runtime: { kind: 'webview', entry: 'dist/index.html' },
            activation: 'on-demand', capabilities: { required: [], optional: [] },
            contributes: { views: [{ id: 'main', title: 'Main', surface: 'workspace', layout: 'full' }] } } };
}
async function simpleProject(t) {
    const root = await temporary(t);
    await fs.writeFile(path.join(root, 'package.json'), jsonBytes(metadata()));
    await fs.writeFile(path.join(root, 'tsconfig.json'), jsonBytes({ compilerOptions: {
        strict: true, noEmit: true, target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler',
        types: [], skipLibCheck: true,
    }, include: ['main.ts'] }));
    await fs.writeFile(path.join(root, 'index.html'), '<html><head><meta charset="UTF-8"></head><body><script type="module" src="./main.ts"></script></body></html>');
    await fs.writeFile(path.join(root, 'main.ts'), 'document.body.textContent = import.meta.env.VITE_DEVKIT_PRIVATE_TEST || "";\n');
    // Declare only this test's import.meta shape, without depending on a parent project's types.
    await fs.appendFile(path.join(root, 'main.ts'), 'declare global { interface ImportMeta { env: { VITE_DEVKIT_PRIVATE_TEST?: string } } }\nexport {};\n');
    await fs.writeFile(path.join(root, '.env'), 'VITE_DEVKIT_PRIVATE_TEST=DO_NOT_PACKAGE_THIS\n');
    await fs.writeFile(path.join(root, 'vite.config.js'), 'throw new Error("Author config must not run");');
    return root;
}
// Reads the small regular USTAR entries produced by npm in this test, not an installer.
function archiveFiles(bytes) {
    const tar = gunzipSync(bytes);
    const files = new Map();
    for (let offset = 0; offset + 512 <= tar.length && tar[offset];) {
        const header = tar.subarray(offset, offset + 512);
        const name = header.subarray(0, 100).toString().replace(/\0.*$/s, '');
        const size = parseInt(header.subarray(124, 136).toString().replace(/\0.*$/s, '').trim(), 8) || 0;
        if (header[156] === 48 || header[156] === 0) files.set(name, tar.subarray(offset + 512, offset + 512 + size));
        offset += 512 + Math.ceil(size / 512) * 512;
    }
    return files;
}

test('scaffold validates before writing and refuses to overwrite an existing folder', async t => {
    const root = await temporary(t);
    const archive = path.join(root, 'fixture.tgz');
    await fs.writeFile(archive, 'path fixture; scaffold does not install this file');
    const target = path.join(root, 'new-project');
    await assert.rejects(scaffold(target, { id: 'invalid', sdk: archive, devkit: archive }), /publisher/);
    await assert.rejects(fs.stat(target), { code: 'ENOENT' });
    await scaffold(target, { id: 'test.notes', name: 'Notes <&>', sdk: archive, devkit: archive });
    const pkg = await readJson(path.join(target, 'package.json'));
    assert.equal(pkg.app.id, 'test.notes');
    assert.equal(pkg.app.name, 'Notes <&>');
    assert.match(pkg.dependencies['@cluaiz/extension-sdk'], /^file:/);
    const before = await fs.readFile(path.join(target, 'package.json'));
    await assert.rejects(scaffold(target, { id: 'test.other', sdk: archive, devkit: archive }), { code: 'EEXIST' });
    assert.deepEqual(await fs.readFile(path.join(target, 'package.json')), before);
});

test('generated paths reject traversal, absolute paths and output junctions', async t => {
    const root = await temporary(t);
    for (const value of ['../escape', '/absolute', 'C:/escape', 'dist/../escape', 'dist/%2e%2e/x', 'dist\\x']) {
        await assert.rejects(ownedPath(root, value, true));
    }
    const outside = await temporary(t);
    await fs.symlink(outside, path.join(root, 'dist'), process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(ownedPath(root, 'dist/index.html', true), /symlinks|junctions/);
    assert.deepEqual(await fs.readdir(outside), []);
});

test('metadata version and unsupported devkit profiles fail explicitly', async t => {
    const root = await simpleProject(t);
    const pkg = metadata();
    pkg.version = '2.0.0';
    await fs.writeFile(path.join(root, 'package.json'), jsonBytes(pkg));
    await assert.rejects(project(root), /version/);
    pkg.version = '1.0.0'; pkg.app.runtime.kind = 'native-worker';
    await fs.writeFile(path.join(root, 'package.json'), jsonBytes(pkg));
    await assert.rejects(project(root), /on-demand web UI/);
});

test('real build ignores author config/env; pack includes verified emitted files only', async t => {
    const root = await simpleProject(t);
    const receipt = await buildProject(root);
    assert.ok(receipt.files.some(file => file.path === 'dist/index.html'));
    const portable = await fs.readFile(path.join(root, 'dist/index.html'), 'utf8');
    assert.match(portable, /id="cluaiz-extension-manifest"/);
    assert.match(portable, /src="data:text\/javascript;base64,/);
    assert.doesNotMatch(portable, /src="\.\/assets\//);
    await fs.writeFile(path.join(root, 'dist/stale.txt'), 'stale output');
    await fs.mkdir(path.join(root, 'node_modules'));
    await fs.writeFile(path.join(root, 'node_modules/private.txt'), 'private dependency');
    const verified = await verifyBuild(root);
    assert.ok(verified.files.every(file => !file.content.toString().includes('DO_NOT_PACKAGE_THIS')));
    const artifact = await packProject(root);
    const bytes = await fs.readFile(artifact);
    const entries = archiveFiles(bytes);
    assert.ok(entries.has('package/inventory.json'));
    assert.ok(entries.has('package/dist/index.html'));
    assert.ok(![...entries.keys()].some(name => /node_modules|\.env|stale|main\.ts/.test(name)));
    const inventory = JSON.parse(entries.get('package/inventory.json'));
    for (const file of inventory.files) {
        const actual = entries.get(`package/${file.path}`);
        assert.ok(actual, file.path);
        assert.equal(actual.length, file.bytes);
        assert.equal(digest(actual), file.sha256);
    }
    await assert.rejects(packProject(root), { code: 'EEXIST' });
    assert.equal(digest(await fs.readFile(artifact)), digest(bytes));
    await fs.appendFile(path.join(root, receipt.files[0].path), 'changed');
    await assert.rejects(verifyBuild(root), /changed/);
});

test('portable build refuses a document without a metadata head and leaves no receipt', async t => {
    const root = await simpleProject(t);
    await fs.writeFile(path.join(root, 'index.html'), '<html><body><script type="module" src="./main.ts"></script></body></html>');
    await assert.rejects(buildProject(root), /needs a head/);
    await assert.rejects(fs.stat(path.join(root, '.cluaiz/build.json')), { code: 'ENOENT' });
});

test('TypeScript errors fail build instead of emitting a success receipt', async t => {
    const root = await simpleProject(t);
    await buildProject(root);
    await fs.writeFile(path.join(root, 'main.ts'), 'const value: string = 123;');
    await assert.rejects(buildProject(root), /not assignable/);
    await assert.rejects(fs.stat(path.join(root, '.cluaiz/build.json')), { code: 'ENOENT' });
    await assert.rejects(verifyBuild(root), { code: 'ENOENT' });
});

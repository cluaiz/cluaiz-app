import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { build as viteBuild } from 'vite';
import { project, checkTypes, ownedPath, writeOwned, readJson, digest, jsonBytes } from './project.mjs';
import { EXTENSION_DOCUMENT_LIMIT_BYTES } from '@cluaiz/extension-sdk';

const exec = promisify(execFile);
const RECEIPT = '.cluaiz/build.json';
function manifest({ pkg, app }) {
    return { name: pkg.name, version: app.version, private: true, hub_type: 'extension', app,
        files: ['dist', 'inventory.json'] };
}

/** One self-contained entry is used unchanged by opaque browser and native documents. */
function portableEntry(outputs, state) {
    const entry = state.app.runtime.entry.slice('dist/'.length);
    const shell = outputs.find(output => output.type === 'asset' && output.fileName === entry);
    if (!shell) throw new Error('Build did not emit the declared HTML entry.');
    let html = String(shell.source);
    for (const output of outputs) {
        if (output === shell) continue;
        const escaped = ('./' + output.fileName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const content = Buffer.from(output.type === 'chunk' ? output.code : output.source);
        const javascript = output.type === 'chunk';
        if (javascript && (output.imports.length || output.dynamicImports.length)) throw new Error('Portable entry contains external JavaScript imports.');
        if (!javascript && !output.fileName.endsWith('.css')) throw new Error('Portable entry has a non-inline asset; keep it within the document size limit.');
        const expression = new RegExp(javascript
            ? `<script\\b[^>]*\\bsrc=["']${escaped}["'][^>]*>\\s*</script>`
            : `<link\\b[^>]*\\bhref=["']${escaped}["'][^>]*>`, 'g');
        let replaced = false;
        html = html.replace(expression, tag => {
            replaced = true;
            const attribute = javascript ? 'src' : 'href';
            const mime = javascript ? 'text/javascript' : 'text/css';
            return tag.replace(new RegExp(`${attribute}=["'][^"']+["']`), `${attribute}="data:${mime};base64,${content.toString('base64')}"`);
        });
        if (!replaced) throw new Error('Portable entry did not reference an emitted asset.');
    }
    const metadata = JSON.stringify(manifest(state)).replaceAll('<', '\\u003c');
    if (!/<head\b[^>]*>/i.test(html)) throw new Error('Portable entry needs a head element.');
    html = html.replace(/<head\b[^>]*>/i, tag => `${tag}<script type="application/json" id="cluaiz-extension-manifest">${metadata}</script>`);
    const bytes = Buffer.from(html);
    if (bytes.length > EXTENSION_DOCUMENT_LIMIT_BYTES) throw new Error('Built extension exceeds the document size limit.');
    return bytes;
}
export async function buildProject(root) {
    const state = await project(root);
    // A failed rebuild must not leave a packable receipt for an older build.
    try { await fs.unlink(await ownedPath(state.root, RECEIPT)); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    checkTypes(state.root);
    await ownedPath(state.root, state.app.runtime.entry, true);
    const result = await viteBuild({ configFile: false, envFile: false, root: state.root,
        publicDir: false, base: './', esbuild: { jsx: 'automatic' },
        build: { write: false, emptyOutDir: false, target: 'es2022', modulePreload: false,
            cssCodeSplit: false, assetsInlineLimit: EXTENSION_DOCUMENT_LIMIT_BYTES,
            rollupOptions: { output: { inlineDynamicImports: true } } } });
    const outputs = (Array.isArray(result) ? result : [result]).flatMap(value => value.output);
    const bytes = portableEntry(outputs, state);
    await writeOwned(state.root, state.app.runtime.entry, bytes);
    const files = [{ path: state.app.runtime.entry, bytes: bytes.length, sha256: digest(bytes) }];
    const receipt = { schema_version: 1, manifest: manifest(state), files: files.sort((a, b) => a.path.localeCompare(b.path)) };
    await writeOwned(state.root, RECEIPT, jsonBytes(receipt));
    return receipt;
}

/** Uses only receipt-listed bytes; source, secrets, stale assets and node_modules are not copied. */
export async function verifyBuild(root) {
    const state = await project(root);
    const receipt = await readJson(await ownedPath(state.root, RECEIPT));
    if (receipt.schema_version !== 1 || JSON.stringify(receipt.manifest) !== JSON.stringify(manifest(state))
        || !Array.isArray(receipt.files) || !receipt.files.length) throw new Error('Build receipt is missing or outdated; run build again.');
    const paths = new Set();
    const files = [];
    for (const file of receipt.files) {
        if (typeof file.path !== 'string' || !file.path.startsWith('dist/') || paths.has(file.path)
            || !Number.isSafeInteger(file.bytes) || file.bytes < 0 || !/^[a-f0-9]{64}$/.test(file.sha256)) throw new Error('Invalid build inventory.');
        paths.add(file.path);
        const bytes = await fs.readFile(await ownedPath(state.root, file.path));
        if (bytes.length !== file.bytes || digest(bytes) !== file.sha256) throw new Error(`Built file changed: ${file.path}. Run build again.`);
        files.push({ ...file, content: bytes });
    }
    if (!paths.has(state.app.runtime.entry)) throw new Error('Inventory does not contain the declared entry.');
    return { state, receipt, files };
}
export async function packProject(root) {
    const { state, receipt, files } = await verifyBuild(root);
    // npm scripts supply this absolute path. Never create a shell command from author input.
    const npmCli = process.env.npm_execpath;
    if (!npmCli || !path.isAbsolute(npmCli)) throw new Error('Run pack through npm run pack so the npm CLI is available.');
    const stage = await fs.mkdtemp(path.join(os.tmpdir(), 'cluaiz-extension-pack-'));
    try {
        const pkgBytes = jsonBytes(receipt.manifest);
        await fs.writeFile(path.join(stage, 'package.json'), pkgBytes);
        for (const file of files) await writeOwned(stage, file.path, file.content);
        const inventory = { schema_version: 1, algorithm: 'sha256', id: state.app.id, version: state.app.version,
            files: [{ path: 'package.json', bytes: pkgBytes.length, sha256: digest(pkgBytes) }, ...receipt.files] };
        await fs.writeFile(path.join(stage, 'inventory.json'), jsonBytes(inventory));
        const { stdout } = await exec(process.execPath, [npmCli, 'pack', '--ignore-scripts', '--json', '--workspaces=false'],
            { cwd: stage, windowsHide: true });
        const info = JSON.parse(stdout);
        const filename = info?.[0]?.filename;
        if (info.length !== 1 || typeof filename !== 'string' || path.basename(filename) !== filename) throw new Error('npm returned an invalid artifact path.');
        const destination = await ownedPath(state.root, `artifacts/${filename}`, true);
        await fs.copyFile(path.join(stage, filename), destination, fs.constants.COPYFILE_EXCL);
        return destination;
    } finally {
        const realStage = await fs.realpath(stage);
        const realTemp = await fs.realpath(os.tmpdir());
        if (path.dirname(realStage) !== realTemp || !path.basename(realStage).startsWith('cluaiz-extension-pack-')) throw new Error('Refusing cleanup outside owned staging directory.');
        await fs.rm(realStage, { recursive: true, force: true });
    }
}

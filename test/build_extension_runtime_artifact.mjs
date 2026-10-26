import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { scaffold } from '../packages/extension-devkit/src/scaffold.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'node_modules/.cache/cluaiz-tests/extension-finish');
const archives = path.join(output, 'archives');
const npm = process.env.npm_execpath;
if (!npm || !path.isAbsolute(npm)) throw new Error('Run npm run test:extension-artifact so the actual npm CLI path is supplied.');
if (process.argv.slice(2).some(value => !['--online', '--live-chat', '--component-reference'].includes(value))) throw new Error('Unknown artifact option; default install is offline.');
const liveChat = process.argv.includes('--live-chat');
const componentReference = process.argv.includes('--component-reference');
if (liveChat && componentReference) throw new Error('Select only one author fixture.');
const prefix = componentReference ? 'component-reference' : liveChat ? 'live-chat' : 'runtime';
await fs.mkdir(archives, { recursive: true });
async function run(args, cwd, label) {
    // Resolve the independent project explicitly. Nested npm on this Windows
    // machine grows PATH past cmd.exe's limit (8112 chars before the second run).
    // Bound only this test child's tools; never mutate the user's environment.
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^npm_/i.test(key) && key !== 'INIT_CWD'));
    if (process.platform === 'win32') {
        for (const key of Object.keys(env)) if (key.toLowerCase() === 'path') delete env[key];
        env.Path = [path.dirname(process.execPath), path.join(process.env.SystemRoot, 'System32'), process.env.SystemRoot].join(path.delimiter);
    }
    const actual = spawnSync(process.execPath, [npm, '--prefix', cwd, ...args], { cwd, env, encoding: 'utf8', timeout: 120000, windowsHide: true });
    await fs.writeFile(path.join(output, label + '.txt'), actual.stdout + actual.stderr);
    if (actual.status !== 0) {
        const bins = await fs.readdir(path.join(cwd, 'node_modules/.bin')).catch(() => []);
        await fs.writeFile(path.join(output, label + '-environment.json'), JSON.stringify({ bins,
            package: JSON.parse(await fs.readFile(path.join(cwd, 'package.json'), 'utf8')) }, null, 2));
        throw new Error(`${label} failed (${actual.status}); inspect its retained log and environment.`);
    }
    return actual.stdout;
}
const sdk = JSON.parse(await run(['pack', '--workspace', '@cluaiz/extension-sdk', '--ignore-scripts', '--pack-destination', archives, '--json'], root, 'runtime-sdk-pack'))[0];
const devkit = JSON.parse(await run(['pack', '--workspace', '@cluaiz/extension-devkit', '--ignore-scripts', '--pack-destination', archives, '--json'], root, 'runtime-devkit-pack'))[0];
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'cluaiz-runtime-author-'));
const project = path.join(temporary, 'author');
try {
    await scaffold(project, { id: liveChat ? 'fixture.live-chat' : 'fixture.runtime', name: liveChat ? 'Extension live chat fixture' : 'Extension runtime fixture',
        sdk: path.join(archives, sdk.filename), devkit: path.join(archives, devkit.filename) });
    const appRequire = createRequire(path.join(root, 'app/package.json'));
    const pkg = JSON.parse(await fs.readFile(path.join(project, 'package.json'), 'utf8'));
    // Pin only this isolated acceptance project to the already installed versions.
    for (const name of ['react', 'react-dom']) pkg.dependencies[name] = appRequire(name + '/package.json').version;
    for (const name of ['@types/react', '@types/react-dom']) pkg.devDependencies[name] = appRequire(name + '/package.json').version;
    pkg.overrides = Object.fromEntries(['vite', 'typescript'].map(name => [name, appRequire(name + '/package.json').version]));
    pkg.app.capabilities = componentReference ? { required: [], optional: [] } : liveChat
        ? { required: ['storage.read', 'storage.write', 'models.list', 'chat.sessions', 'chat.send'], optional: [] }
        : { required: ['storage.read', 'storage.write'], optional: ['models.list', 'audio.speech', 'ai.stream'] };
    await fs.writeFile(path.join(project, 'package.json'), JSON.stringify(pkg, null, 2));
    if (componentReference) {
        const { build } = await import('esbuild');
        const entry = path.join(output, 'component-reference-data.mjs');
        await build({ entryPoints: [path.join(root, 'src/components/showcase/reference.ts')],
            outfile: entry, bundle: true, platform: 'node', format: 'esm' });
        const { SDK_REFERENCES } = await import(pathToFileURL(entry));
        await fs.mkdir(path.join(project, 'src/examples'));
        const names = Object.keys(SDK_REFERENCES);
        for (const [id, value] of Object.entries(SDK_REFERENCES)) {
            await fs.writeFile(path.join(project, `src/examples/${id}.tsx`), value.example);
        }
        await fs.writeFile(path.join(project, 'src/Workspace.tsx'), names.map((id, index) =>
            `import Example${index} from './examples/${id}';`).join('\n')
            + "\nimport type {GuestExtensionSDK} from '@cluaiz/extension-sdk/guest';\nexport function Workspace(_props: {sdk?: GuestExtensionSDK}){return <main><h1>SDK component examples</h1>"
            + names.map((id, index) => `<section><h2>${id}</h2><Example${index}/></section>`).join('') + '</main>;}');
    } else await fs.copyFile(path.join(root, `test/fixtures/extensions/${liveChat ? 'live-chat' : 'runtime'}-guest.tsx`), path.join(project, 'src/Workspace.tsx'));
    await run(['install', ...(process.argv.includes('--online') ? [] : ['--offline']), '--ignore-scripts', '--no-audit', '--no-fund'], project, 'runtime-author-install');
    for (const task of ['check', 'build', 'pack']) {
        await run(['run', task], project, 'runtime-author-' + task);
        console.log('Independent runtime artifact: ' + task + ' exited 0');
    }
    await fs.copyFile(path.join(project, 'dist/index.html'), path.join(output, prefix + '-document.html'));
    await fs.cp(path.join(project, 'src'), path.join(output, prefix + '-author-source'), { recursive: true });
    await fs.cp(path.join(project, 'artifacts'), path.join(output, prefix + '-author-artifacts'), { recursive: true });
    await fs.writeFile(path.join(output, prefix + '-artifact.json'), JSON.stringify({ sdkFiles: sdk.files.length,
        devkitFiles: devkit.files.length, sdk: sdk.filename, devkit: devkit.filename,
        source: componentReference ? 'SDK_REFERENCES examples' : `test/fixtures/extensions/${liveChat ? 'live-chat' : 'runtime'}-guest.tsx`, projectOutsideApp: true }, null, 2));
} finally {
    const actual = await fs.realpath(temporary);
    const parent = await fs.realpath(os.tmpdir());
    if (path.dirname(actual) !== parent || !path.basename(actual).startsWith('cluaiz-runtime-author-')) {
        throw new Error('Refusing runtime author cleanup outside the named temporary root');
    }
    await fs.rm(actual, { recursive: true, force: true });
}

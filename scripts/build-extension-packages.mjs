import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { build as bundle } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const appRequire = createRequire(path.join(root, 'app/package.json'));
const ts = appRequire('typescript');
const { build: buildVite } = await import(pathToFileURL(appRequire.resolve('vite')));
const { default: tailwind } = await import(pathToFileURL(appRequire.resolve('@tailwindcss/vite')));
const sdk = path.join(root, 'packages/extension-sdk');
const devkit = path.join(root, 'packages/extension-devkit');
const entries = ['index', 'ui', 'guest'].map(name => path.join(sdk, 'src', `${name}.ts`));
await fs.mkdir(path.join(sdk, 'dist'), { recursive: true });
await bundle({ entryPoints: entries, bundle: true, format: 'esm', platform: 'browser', jsx: 'automatic',
    outdir: path.join(sdk, 'dist'), external: ['react', 'react/*', 'react-dom', 'react-dom/*'], logLevel: 'warning' });

// Remove only this build's generated declaration tree; never preserve stale host declarations.
const types = path.join(sdk, 'dist/types');
try {
    const actual = await fs.realpath(types);
    const expected = path.join(await fs.realpath(sdk), 'dist/types');
    if (actual !== expected || (await fs.lstat(path.join(sdk, 'dist'))).isSymbolicLink()) {
        throw new Error('Refusing declaration cleanup outside SDK generated output.');
    }
    await fs.rm(actual, { recursive: true, force: true });
} catch (error) { if (error.code !== 'ENOENT') throw error; }

const program = ts.createProgram(entries, {
    target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler, jsx: ts.JsxEmit.ReactJSX,
    strict: true, skipLibCheck: true, declaration: true, emitDeclarationOnly: true,
    rootDir: root, outDir: path.join(sdk, 'dist/types'),
});
const previewTypes = ts.createProgram([path.join(devkit, 'src/preview.tsx')], {
    ...program.getCompilerOptions(), declaration: false, emitDeclarationOnly: false, noEmit: true,
});
const diagnostics = [...ts.getPreEmitDiagnostics(program), ...ts.getPreEmitDiagnostics(previewTypes)];
if (diagnostics.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: name => name, getCurrentDirectory: () => root, getNewLine: () => '\n',
}));
const emitted = program.emit();
if (emitted.emitSkipped) throw new Error('SDK declaration generation failed.');

const css = await buildVite({ configFile: false, root, publicDir: false, plugins: [tailwind()],
    build: { write: false, emptyOutDir: false, rollupOptions: { input: path.join(root, 'src/styles/extension.css') } } });
const sheets = (Array.isArray(css) ? css : [css]).flatMap(result => result.output)
    .filter(asset => asset.type === 'asset' && asset.fileName.endsWith('.css'));
if (sheets.length !== 1) throw new Error('Expected one compiled UI stylesheet.');
await fs.writeFile(path.join(sdk, 'dist/ui.css'), sheets[0].source);
await fs.mkdir(path.join(devkit, 'dist'), { recursive: true });
await bundle({ entryPoints: [path.join(devkit, 'src/preview.tsx')], bundle: true, format: 'esm',
    platform: 'browser', jsx: 'automatic', external: ['react', 'react/*', 'react-dom', 'react-dom/*'],
    outfile: path.join(devkit, 'dist/preview.js'), logLevel: 'warning' });
console.log('Built local SDK ESM/types/UI CSS and devkit preview. No packages published.');

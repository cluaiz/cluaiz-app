import fs from 'node:fs/promises';
import path from 'node:path';
import { EXTENSION_HOST_API, EXTENSION_SCHEMA_VERSION, validateExtensionContract } from '@cluaiz/extension-sdk';
import { jsonBytes } from './project.mjs';

export async function scaffold(target, options) {
    if (!options.id || !options.sdk || !options.devkit) throw new Error('create needs --id, --sdk <local.tgz> and --devkit <local.tgz>. Packages are not published.');
    const app = validateExtensionContract({ schema_version: EXTENSION_SCHEMA_VERSION, hub_type: 'extension',
        id: options.id, name: options.name || options.id, version: '0.1.0',
        host_api: { min: EXTENSION_HOST_API, max: EXTENSION_HOST_API },
        runtime: { kind: 'webview', entry: 'dist/index.html' }, activation: 'on-demand',
        capabilities: { required: [], optional: [] },
        contributes: { views: [{ id: 'main', title: options.name || options.id, surface: 'workspace', layout: 'full' }] } });
    const localPackage = async name => {
        const file = await fs.realpath(path.resolve(options[name]));
        if (!(await fs.stat(file)).isFile() || !file.endsWith('.tgz')) throw new Error(`--${name} must point to a local npm tarball.`);
        return 'file:' + file.replaceAll(path.sep, '/');
    };
    const sdk = await localPackage('sdk');
    const devkit = await localPackage('devkit');
    const [publisher, name] = app.id.split('.');
    const pkg = { name: `@${publisher}/${name}`, version: app.version, private: true, type: 'module', hub_type: 'extension', app,
        scripts: { dev: 'cluaiz-extension dev', check: 'cluaiz-extension check', build: 'cluaiz-extension build', pack: 'cluaiz-extension pack' },
        dependencies: { '@cluaiz/extension-sdk': sdk, react: '^19.0.0', 'react-dom': '^19.0.0' },
        devDependencies: { '@cluaiz/extension-devkit': devkit, '@types/react': '^19.0.0', '@types/react-dom': '^19.0.0' } };
    // Fail before any file writes if the author's target already exists.
    await fs.mkdir(target);
    await fs.mkdir(path.join(target, 'src'));
    await fs.writeFile(path.join(target, 'package.json'), jsonBytes(pkg));
    await fs.writeFile(path.join(target, 'tsconfig.json'), jsonBytes({ compilerOptions: {
        target: 'ES2022', lib: ['ES2022', 'DOM', 'DOM.Iterable'], module: 'ESNext', moduleResolution: 'Bundler',
        jsx: 'react-jsx', strict: true, skipLibCheck: true, noEmit: true, types: ['vite/client'],
    }, include: ['src'] }));
    await fs.writeFile(path.join(target, '.gitignore'), 'node_modules/\ndist/\n.cluaiz/\nartifacts/\n.env*\n');
    await fs.writeFile(path.join(target, 'index.html'), '<!doctype html>\n<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>\n');
    await fs.writeFile(path.join(target, 'src/main.tsx'), `import { createRoot } from 'react-dom/client';
import { bootstrapExtension, bindExtensionTheme, type ExtensionConnection } from '@cluaiz/extension-sdk/guest';
import '@cluaiz/extension-sdk/ui.css';
import { Workspace } from './Workspace';
const root = createRoot(document.getElementById('root')!);
// A reviewed host adapter may supply a connection. Standalone mode never invents one.
export async function mountWorkspace(connection?: ExtensionConnection) {
    let unbind = () => {};
    if (import.meta.env.DEV) {
        const { ExtensionPreview } = await import('@cluaiz/extension-devkit/preview');
        root.render(<ExtensionPreview connection={connection}><Workspace sdk={connection?.sdk} /></ExtensionPreview>);
    } else {
        if (connection) unbind = bindExtensionTheme(connection.sdk.theme, document.documentElement);
        root.render(<Workspace sdk={connection?.sdk} />);
    }
    return () => { unbind(); connection?.close(); root.unmount(); };
}
void bootstrapExtension().then(connection => mountWorkspace(connection ?? undefined)).catch(error => {
    root.render(<p role="alert">{String(error)}</p>);
});
`);
    await fs.writeFile(path.join(target, 'src/Workspace.tsx'), `import { useState } from 'react';
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from '@cluaiz/extension-sdk/ui';
import type { GuestExtensionSDK } from '@cluaiz/extension-sdk/guest';

export function Workspace({ sdk }: { sdk?: GuestExtensionSDK }) {
    const [draft, setDraft] = useState('');
    const [count, setCount] = useState(0);
    return <main style={{ padding: '1.5rem' }}><Card>
        <CardHeader><CardTitle>{${JSON.stringify(app.name)}}</CardTitle></CardHeader>
        <CardContent>
            <p>{sdk ? 'Host connection: ' + sdk.host.kind : 'UI only — no App services connected'}</p>
            <label>Draft<Input aria-label="Draft" value={draft} onChange={event => setDraft(event.target.value)} /></label>
            <Button style={{ marginTop: '1rem' }} onClick={() => setCount(value => value + 1)}>Count {count}</Button>
        </CardContent>
    </Card></main>;
}
`);
    await fs.writeFile(path.join(target, 'README.md'), '# ' + app.id + '\n\nInstall the selected local dependencies, then use `npm run dev`, `npm run check`, `npm run build` and `npm run pack`.\n\nStandalone development preview is UI-only. To use App services, open `/extensions/developer.preview/main` in the App development build, select your built `dist/index.html` and review its permissions. Run only your own unsigned developer output: publisher identity is not verified. The archive is not installable in the current bundled registry.\n');
}

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { renderToStaticMarkup } from 'react-dom/server';
import { build } from 'esbuild';
import { COMPONENT_GROUPS } from '../src/components/showcase/catalog';
import { SDK_REFERENCES, componentAvailability } from '../src/components/showcase/reference';
import { ComponentReference } from '../src/components/showcase/ComponentReference';
import { DeveloperGuide } from '../src/components/showcase/DeveloperGuide';
import { parseCurrentRoute } from '../src/core/router';
import * as publicUI from '@cluaiz/extension-sdk/ui';

test('gallery preserves all 30 unique entries with real owners and explicit SDK availability', async () => {
    const entries = COMPONENT_GROUPS.flatMap(group => group.items);
    assert.equal(entries.length, 30);
    assert.equal(new Set(entries.map(item => item.id)).size, entries.length);
    for (const entry of entries) {
        await fs.stat(entry.path);
        const available = componentAvailability(entry.id);
        const html = renderToStaticMarkup(<ComponentReference id={entry.id} copiedText={null} onCopy={() => {}} />);
        assert.ok(html.includes(available.label));
        const reference = SDK_REFERENCES[entry.id];
        if (reference) {
            assert.match(html, /Copy example/);
            for (const name of reference.exports) assert.ok(name in publicUI, `Missing public export ${name}`);
        } else assert.doesNotMatch(html, /Copy example/);
    }
    assert.equal(Object.keys(SDK_REFERENCES).length, 9);
    assert.equal(componentAvailability('contextchip').label, 'App-connected');
    assert.equal(componentAvailability('richhovercard').label, 'App-connected');
    assert.equal(componentAvailability('calendardropdown').label, 'Source reference');
    for (const file of await fs.readdir('src/components/showcase')) {
        if (/\.tsx?$/.test(file)) assert.ok((await fs.readFile('src/components/showcase/' + file, 'utf8')).split('\n').length < 800, file);
    }
});

test('direct, refreshed and hash reference routes ignore unrelated API query parameters', () => {
    const original = globalThis.window;
    try {
        for (const address of ['http://localhost:1420/components?endpoint=%2Fv1%2Fnotes&method=GET',
            'http://localhost:1420/#/components', 'http://localhost:1420/#/components?endpoint=%2Fv1%2Fnotes', 'http://localhost:1420/toolkit?section=components']) {
            const location = new URL(address);
            Object.assign(globalThis, { window: { location } });
            assert.equal(parseCurrentRoute().view, location.pathname === '/toolkit' ? 'toolkit' : 'components');
        }
    } finally { Object.assign(globalThis, { window: original }); }
});

test('SDK UI graph contains no App store, engine client or host API implementation', async () => {
    const result = await build({ entryPoints: ['src/extensions/ui.ts'], bundle: true, write: false,
        metafile: true, format: 'esm', platform: 'browser', jsx: 'automatic',
        external: ['react', 'react/*', 'react-dom', 'react-dom/*'] });
    const inputs = Object.keys(result.metafile!.inputs).map(value => value.replaceAll('\\', '/'));
    assert.ok(inputs.some(value => value.endsWith('/CustomDropdown.tsx')));
    assert.ok(inputs.every(value => !/^src\/(store|api|core|features)\//.test(value)));
    const output = result.outputFiles![0].text;
    assert.match(output, /from "react-dom"/);
    assert.doesNotMatch(output, /get_session_token|engine_native_start|cluaiz_api_token/);
    const css = await fs.readFile('packages/extension-sdk/dist/ui.css', 'utf8');
    for (const selector of ['.ui-btn', '.ui-input', '.ui-card', '.ui-badge', '.ui-tag']) assert.ok(css.includes(selector));
});

test('guide explains the independent project, actual commands and connected theme boundary', () => {
    const html = renderToStaticMarkup(<DeveloperGuide onCopy={() => {}} copiedText={null} />);
    for (const phrase of ['separate project', 'npm run check', 'npm run build', 'npm run pack',
        '--bg-secondary', '--border-color', 'standalone preview is UI-only', 'local tarballs']) assert.ok(html.includes(phrase));
    assert.doesNotMatch(html, /npm create|npm install -g/);
});

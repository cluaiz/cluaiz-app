import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptBundledManifest, validateExtensionContract } from '../src/extensions/contract';
import { EXTENSION_HOST, inspectExtensionContract } from '../src/extensions/compatibility';
import { resolveCatalogueContract } from '../src/extensions/catalogue';
import { WorkspaceExtensionRegistry } from '../src/extensions/registry';
import { packageEntry, validExtensionId, validLegacyId, validReleaseVersion, validViewId } from '../src/extensions/validation';

function contract(id = 'publisher.workspace', version = '1.2.3') {
    return { schema_version: 1, hub_type: 'extension', id, name: 'Workspace', version,
        host_api: { min: 1, max: 1 }, runtime: { kind: 'bundled' }, activation: 'on-demand',
        capabilities: { required: ['models.list'], optional: ['audio.speech'] },
        contributes: { views: [{ id: 'main', title: 'Main', surface: 'workspace', layout: 'with-chat' }] } };
}
function bundled(id = 'publisher.workspace') {
    return { hub_type: 'extension', id, name: 'Workspace', version: '1.2.3', host_api: 1,
        capabilities: ['models.list'], contributes: { views: [{ id: 'main', title: 'Main', slot: 'workspace', layout: 'with-chat' }] } };
}
function catalogue(id = 'old-workspace', canonicalId = 'publisher.workspace') {
    const app = { ...contract(canonicalId), runtime: { kind: 'webview', entry: 'ui/index.html' } };
    return { id, hub_type: 'extension', name: 'Catalogue display', latest_version: '9.0.0',
        author: { name: 'Untrusted publisher claim' },
        versions: { '1.2.3': { files: { entry: 'ui/index.html' }, app } } };
}
const selection = { version: '1.2.3', canonicalId: 'publisher.workspace' };

test('extension contract is a copied deeply immutable metadata value', () => {
    const input = { ...contract(), ignored_remote_loader: 'https://invalid.example/code.js' };
    const value = validateExtensionContract(input);
    input.id = 'changed.workspace';
    input.host_api.min = 9;
    input.capabilities.required[0] = 'system.execute';
    input.contributes.views[0].title = 'Changed';
    assert.equal(value.id, 'publisher.workspace');
    assert.equal(value.host_api.min, 1);
    assert.deepEqual(value.capabilities.required, ['models.list']);
    assert.equal(value.contributes.views[0].title, 'Main');
    assert.equal('ignored_remote_loader' in value, false);
    for (const part of [value, value.host_api, value.runtime, value.capabilities,
        value.capabilities.required, value.capabilities.optional, value.contributes,
        value.contributes.views, value.contributes.views[0]]) assert.ok(Object.isFrozen(part));
});

test('schema rejects invalid identity, release, range, runtime and contributions', () => {
    const invalid: unknown[] = [null, [], { ...contract(), schema_version: 2 },
        { ...contract(), hub_type: 'plugin' }, { ...contract(), id: 'short-name' },
        { ...contract(), version: '01.2.3' }, { ...contract(), version: '1.2.3-01' },
        { ...contract(), host_api: { min: 0, max: 1 } },
        { ...contract(), host_api: { min: 2, max: 1 } },
        { ...contract(), host_api: { min: 1, max: 1.5 } },
        { ...contract(), runtime: { kind: 'unknown' } },
        { ...contract(), runtime: { kind: 'bundled', entry: 'ui/index.html' } },
        { ...contract(), runtime: { kind: 'webview' } },
        { ...contract(), activation: 'always' },
        { ...contract(), id: 'publisher.workspace\n' },
        { ...contract(), contributes: { views: [contract().contributes.views[0], contract().contributes.views[0]] } },
        { ...contract(), contributes: { views: [{ id: 'main', title: 'Main', surface: 'unknown' }] } },
        { ...contract(), contributes: { views: [{ id: 'main', title: 'Main', surface: 'panel', layout: 'full' }] } },
        { ...contract(), capabilities: { required: ['models.list', 'models.list'], optional: [] } },
        { ...contract(), capabilities: { required: ['models.list'], optional: ['models.list'] } },
        { ...contract(), capabilities: { required: ['not a capability'], optional: [] } }];
    invalid.push({ ...contract(), capabilities: { required: ['models.list\n'], optional: [] } });
    for (const input of invalid) assert.throws(() => validateExtensionContract(input));
    assert.equal(validateExtensionContract({ ...contract(), version: '1.2.3-rc.1+build.4' }).version, '1.2.3-rc.1+build.4');
});

test('v0 adapter preserves existing workspace and explicitly narrows host API and provenance', () => {
    const value = adaptBundledManifest(bundled());
    assert.deepEqual(value.host_api, { min: 1, max: 1 });
    assert.deepEqual(value.runtime, { kind: 'bundled' });
    assert.equal(value.activation, 'on-demand');
    assert.deepEqual(value.capabilities, { required: ['models.list'], optional: [] });
    assert.deepEqual(value.contributes.views, [{ id: 'main', title: 'Main', surface: 'workspace', layout: 'with-chat' }]);
    assert.throws(() => adaptBundledManifest({ ...bundled(), host_api: 2 }));
});

test('compatibility reports optional availability separately without granting capabilities', () => {
    const input = { ...contract(), capabilities: { required: ['models.list'], optional: ['audio.speech', 'files.read'] } };
    const result = inspectExtensionContract(input);
    assert.equal(result.compatible, true);
    assert.deepEqual(result.availableOptional, ['audio.speech']);
    assert.deepEqual(result.unavailableOptional, ['files.read']);
    assert.deepEqual(result.missingRequired, []);
    const required = inspectExtensionContract({ ...input, capabilities: { required: ['files.read'], optional: [] } });
    assert.equal(required.compatible, false);
    assert.deepEqual(required.missingRequired, ['files.read']);
    assert.ok(required.reasons.includes('capability:files.read'));
    for (const part of [result, result.reasons, result.availableOptional, result.unavailableOptional,
        result.missingRequired, EXTENSION_HOST, EXTENSION_HOST.capabilities]) assert.ok(Object.isFrozen(part));
});

test('declared future profiles and surfaces do not become implemented host support', () => {
    const cases = [
        [{ ...contract(), runtime: { kind: 'webview', entry: 'ui/index.html' } }, 'runtime'],
        [{ ...contract(), runtime: { kind: 'native-worker', entry: 'native/worker.exe' } }, 'runtime'],
        [{ ...contract(), runtime: { kind: 'wasm', entry: 'worker.wasm' } }, 'runtime'],
        [{ ...contract(), activation: 'background' }, 'activation'],
        [{ ...contract(), host_api: { min: 2, max: 3 } }, 'host_api'],
        [{ ...contract(), contributes: { views: [] } }, 'workspace_required'],
        ...['panel', 'floating', 'native-window', 'settings'].map(surface => [
            { ...contract(), contributes: { views: [{ id: 'main', title: 'Main', surface }] } }, 'surface:main']),
    ] as const;
    for (const [input, reason] of cases) {
        const result = inspectExtensionContract(input);
        assert.equal(result.compatible, false);
        assert.ok(result.reasons.includes(reason));
    }
});

test('package entries reject traversal, remote URLs, windows paths and encoded ambiguity', () => {
    assert.equal(packageEntry('ui/assets/index.js'), 'ui/assets/index.js');
    for (const input of [null, 1, '', '/', '/ui/index.html', '../entry.js', 'ui/../entry.js',
        './entry.js', 'ui//entry.js', 'ui/', 'ui\\entry.js', 'C:/entry.js',
        'https://example.test/entry.js', 'file:///entry.js', '//host/entry.js',
        'ui/%2e%2e/entry.js', 'ui/%252fentry.js', 'entry.js?q=1', 'entry.js#x',
        'ui/ entry.js', 'ui/entry.js ', 'ui/\u0000entry.js', 'ui/\u007fentry.js']) {
        assert.throws(() => packageEntry(input), String(input));
    }
    for (const input of [null, undefined, {}, [], 1, '', 'publisher.workspace\n']) {
        assert.equal(validExtensionId(input), false);
    }
    for (const input of [null, undefined, {}, [], 1, '', 'main\n']) {
        assert.equal(validLegacyId(input), false);
        assert.equal(validViewId(input), false);
    }
    for (const input of [null, undefined, {}, [], 1, '', '1.2.3\n']) {
        assert.equal(validReleaseVersion(input), false);
    }
});

test('catalogue selects the exact release and preserves legacy identity with explicit mapping', () => {
    const input = catalogue();
    const result = resolveCatalogueContract(input, selection);
    assert.equal(result.catalogueId, 'old-workspace');
    assert.equal(result.legacyAlias, 'old-workspace');
    assert.equal(result.contract.id, 'publisher.workspace');
    assert.equal(result.contract.version, '1.2.3');
    assert.equal(result.contract.name, 'Workspace');
    assert.deepEqual(result.contract.runtime, { kind: 'webview', entry: 'ui/index.html' });
    input.versions['1.2.3'].app.runtime.entry = 'changed.html';
    assert.equal(result.contract.runtime.entry, 'ui/index.html');
    assert.ok(Object.isFrozen(result));
    const canonical = resolveCatalogueContract(catalogue('publisher.workspace'), selection);
    assert.equal('legacyAlias' in canonical, false);
});

test('catalogue rejects missing metadata, mismatched identity or entry and fake bundled provenance', () => {
    assert.throws(() => resolveCatalogueContract(catalogue(), { ...selection, version: '9.0.0' }), /unavailable/);
    assert.throws(() => resolveCatalogueContract(catalogue(), { ...selection, canonicalId: 'short-name' }), /explicit canonical/);
    assert.throws(() => resolveCatalogueContract(catalogue(), undefined as any), /explicit canonical/);
    for (const value of [null, 1, {}, [], '']) {
        assert.throws(() => resolveCatalogueContract(catalogue(), { ...selection, version: value } as any), /exact release/);
        assert.throws(() => resolveCatalogueContract(catalogue(), { ...selection, canonicalId: value } as any), /canonical/);
    }
    const missing = { ...catalogue(), versions: { '1.2.3': { files: { entry: 'ui/index.html' } } } };
    assert.throws(() => resolveCatalogueContract(missing, selection), /metadata is incomplete/);
    assert.throws(() => resolveCatalogueContract(catalogue('other.workspace'), selection), /canonical identity conflicts/);
    const wrongRelease = catalogue(); wrongRelease.versions['1.2.3'].app.version = '1.2.4';
    assert.throws(() => resolveCatalogueContract(wrongRelease, selection), /Runtime identity or release/);
    const wrongEntry = catalogue(); wrongEntry.versions['1.2.3'].files.entry = 'other.html';
    assert.throws(() => resolveCatalogueContract(wrongEntry, selection), /entry declarations conflict/);
    const bundledClaim = { ...catalogue(), versions: { '1.2.3': { files: { entry: 'ui/index.html' }, app: contract() } } };
    assert.throws(() => resolveCatalogueContract(bundledClaim, selection), /bundled executable provenance/);
    const inherited = { ...catalogue(), versions: Object.create(catalogue().versions) };
    assert.throws(() => resolveCatalogueContract(inherited, selection), /unavailable/);
});

test('host-owned aliases are explicit, unique and registered atomically before any loader runs', async () => {
    const registry = new WorkspaceExtensionRegistry();
    let loads = 0;
    const load = async () => { loads++; return { views: { main: () => null } }; };
    registry.registerBundled({ manifest: bundled(), grants: [], aliases: ['old-workspace'], load });
    assert.equal(registry.get('old-workspace'), registry.get('publisher.workspace'));
    assert.equal(registry.get('workspace'), undefined, 'do not infer a short alias');
    assert.equal(loads, 0);
    assert.throws(() => registry.registerBundled({ manifest: bundled('other.workspace'), grants: [], aliases: ['fresh', 'old-workspace'], load }));
    assert.equal(registry.get('other.workspace'), undefined);
    assert.equal(registry.get('fresh'), undefined, 'failed registration must not leave partial aliases');
    for (const aliases of [['same', 'same'], ['publisher.workspace'], ['../escape'], ['short-name\n'], 'short-name', {}, null, [null]]) {
        assert.throws(() => registry.registerBundled({ manifest: bundled('other.workspace'), grants: [], aliases: aliases as any, load }));
    }
    assert.equal(registry.list().length, 1);
    await registry.loadView('old-workspace', 'main');
    assert.equal(loads, 1);
});

test('catalogue inspection does not load, register, grant or override a bound host alias', () => {
    const registry = new WorkspaceExtensionRegistry();
    let loads = 0;
    registry.registerBundled({ manifest: bundled(), grants: [], aliases: ['old-workspace'],
        load: async () => { loads++; return { views: { main: () => null } }; } });
    const result = registry.inspectCatalogue(catalogue(), selection);
    assert.equal(result.compatibility.compatible, false, 'webview metadata is not runtime support');
    assert.deepEqual(registry.get('publisher.workspace')?.grants, []);
    registry.inspectCatalogue(catalogue('unbound'), selection);
    assert.equal(registry.get('unbound'), undefined);
    assert.equal(loads, 0);
    assert.equal(registry.list().length, 1);
    assert.throws(() => registry.inspectCatalogue(catalogue('old-workspace', 'other.workspace'),
        { ...selection, canonicalId: 'other.workspace' }), /registered host alias/);
    assert.throws(() => registry.registerDownloaded(result.contract), /not supported/);
    assert.equal(loads, 0);
});

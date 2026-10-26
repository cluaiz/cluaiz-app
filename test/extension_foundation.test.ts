import test from 'node:test';
import assert from 'node:assert/strict';
import { validateExtensionManifest, EXTENSION_CAPABILITIES } from '../src/extensions/manifest';
import { WorkspaceExtensionRegistry } from '../src/extensions/registry';
import { createExtensionSession, type ExtensionServices } from '../src/extensions/sdk';
import { ExtensionJobs, MAX_EXTENSION_ACTIVE_JOBS, MAX_EXTENSION_JOB_HISTORY } from '../src/extensions/jobs';
import { EXTENSION_STATE_LIMIT_BYTES, type StateStorage } from '../src/extensions/storage';

const manifest = (id = 'test.workspace', version = '1.0.0') => ({
    hub_type: 'extension', id, name: 'Test workspace', version, host_api: 1,
    capabilities: [...EXTENSION_CAPABILITIES],
    contributes: { views: [{ id: 'main', title: 'Main', slot: 'workspace' }] },
});
function memory() {
    const data = new Map<string, string>();
    const storage: StateStorage = {
        getItem: key => data.get(key) ?? null,
        setItem: (key, value) => { data.set(key, value); },
        removeItem: key => { data.delete(key); },
    };
    return { data, storage };
}
function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}
function services() {
    const calls: string[] = [];
    const adapter: ExtensionServices = {
        listModels: async () => { calls.push('models'); return { status: 'success', count: 0, installed: [] }; },
        generate: async () => { calls.push('generate'); return { id: 'test-response', object: 'chat.completion', created: 0, model: 'chosen', choices: [] }; },
        stream: async () => { calls.push('stream'); },
        speak: async () => { calls.push('speech'); return new Blob(['audio']); },
        transcribe: async () => { calls.push('transcribe'); return { text: 'transcript' }; },
    };
    return { calls, adapter };
}

test('manifest validation copies and deeply freezes the recognized contract', () => {
    const input = { ...manifest(), remote_script: 'https://invalid.example/code.js' };
    const validated = validateExtensionManifest(input);
    input.id = 'changed.owner';
    input.capabilities.length = 0;
    input.contributes.views[0].title = 'Changed';
    assert.equal(validated.id, 'test.workspace');
    assert.equal(validated.capabilities.length, EXTENSION_CAPABILITIES.length);
    assert.equal(validated.contributes.views[0].title, 'Main');
    assert.equal('remote_script' in validated, false);
    for (const value of [validated, validated.capabilities, validated.contributes,
        validated.contributes.views, validated.contributes.views[0]]) assert.ok(Object.isFrozen(value));
});

test('invalid identity, host version, capabilities and view declarations are rejected', () => {
    const invalid: unknown[] = [null, [], { ...manifest(), hub_type: 'plugin' },
        { ...manifest(), host_api: 2 }, { ...manifest(), version: 'latest' },
        ...['../escape', 'test..workspace', 'Test.workspace', 'test.work/space', 'test'].map(id => manifest(id)),
        { ...manifest(), capabilities: ['storage.read', 'storage.read'] },
        { ...manifest(), capabilities: ['system.execute'] },
        { ...manifest(), contributes: { views: [] } },
        { ...manifest(), contributes: { views: [manifest().contributes.views[0], manifest().contributes.views[0]] } },
        { ...manifest(), contributes: { views: [{ id: 'main', title: 'Main', slot: 'native' }] } }];
    for (const value of invalid) assert.throws(() => validateExtensionManifest(value));
});

test('workspace layouts preserve full and with-chat while omitted layout stays default', () => {
    for (const layout of [undefined, 'full', 'with-chat']) {
        const source = manifest();
        const candidate = { ...source, contributes: {
            views: [{ ...source.contributes.views[0], ...(layout ? { layout } : {}) }],
        } };
        const view = validateExtensionManifest(candidate).contributes.views[0];
        assert.equal(view.layout, layout);
        assert.equal(Object.prototype.hasOwnProperty.call(view, 'layout'), layout !== undefined);
    }
    for (const layout of ['sidebar', '', null, 1, {}]) {
        const source = manifest();
        assert.throws(() => validateExtensionManifest({ ...source, contributes: {
            views: [{ ...source.contributes.views[0], layout }],
        } }), /layout/);
    }
});

test('release versions accept SemVer metadata and reject malformed or padded versions', () => {
    for (const release of ['1.0.0-alpha.1+build.001', '0.0.0']) {
        assert.equal(validateExtensionManifest(manifest('test.workspace', release)).version, release);
    }
    for (const release of ['01.0.0', '1.0.0-01', '1.0.0+empty-dot.', '1.0.0\n']) {
        assert.throws(() => validateExtensionManifest(manifest('test.workspace', release)), /version/);
    }
});

test('bundled discovery is lazy and validates requested views before executing a loader', async () => {
    const registry = new WorkspaceExtensionRegistry();
    let loads = 0;
    const View = () => null;
    registry.registerBundled({ manifest: manifest(), grants: ['models.list'],
        load: async () => { loads++; return { views: { main: View } }; } });
    assert.deepEqual(registry.list().map(entry => entry.id), ['test.workspace']);
    assert.equal(loads, 0);
    await assert.rejects(registry.loadView('test.workspace', 'undeclared'), /unavailable/);
    await assert.rejects(registry.loadView('missing.owner', 'main'), /unavailable/);
    assert.equal(loads, 0);
    const loaded = await registry.loadView('test.workspace', 'main');
    assert.equal(loaded.View, View);
    assert.equal(loads, 1);
    assert.throws(() => registry.registerBundled({ manifest: manifest(), grants: [], load: async () => ({ views: {} }) }), /Duplicate/);
    assert.throws(() => registry.registerBundled({ manifest: { ...manifest('test.other'), capabilities: [] },
        grants: ['models.list'], load: async () => ({ views: {} }) }), /not requested/);
    assert.throws(() => registry.registerBundled({ manifest: { ...manifest('test.other'), host_api: 99 },
        grants: [], load: async () => ({ views: {} }) }), /incompatible/);
});

test('downloaded packages fail closed without executing supplied code', () => {
    const registry = new WorkspaceExtensionRegistry();
    let executed = false;
    assert.throws(() => registry.registerDownloaded({ ...manifest(),
        load: () => { executed = true; }, activate: () => { executed = true; } }), /isolated runtime/);
    assert.equal(executed, false);
    assert.deepEqual(registry.list(), []);
});

test('a declared view must be provided as an own property, not inherited from Object', async () => {
    const registry = new WorkspaceExtensionRegistry();
    registry.registerBundled({ manifest: { ...manifest(), contributes: {
        views: [{ id: 'constructor', title: 'Constructor', slot: 'workspace' }],
    } }, grants: [], load: async () => ({ views: {} }) });
    await assert.rejects(registry.loadView('test.workspace', 'constructor'), /did not provide/);
});

test('state belongs to owner across versions and cannot escape via adversarial keys', () => {
    const { storage } = memory();
    const { adapter } = services();
    const first = createExtensionSession(manifest(), EXTENSION_CAPABILITIES, adapter, storage);
    const upgraded = createExtensionSession(manifest('test.workspace', '2.0.0'), EXTENSION_CAPABILITIES, adapter, storage);
    const other = createExtensionSession(manifest('other.workspace'), EXTENSION_CAPABILITIES, adapter, storage);
    first.sdk.storage.set('../other.workspace:state', { value: 7 });
    assert.deepEqual(upgraded.sdk.storage.get('../other.workspace:state'), { value: 7 });
    assert.equal(other.sdk.storage.get('../other.workspace:state'), null);
    other.sdk.storage.set('../other.workspace:state', 'other');
    other.sdk.storage.remove('../other.workspace:state');
    assert.deepEqual(first.sdk.storage.get('../other.workspace:state'), { value: 7 });
    assert.throws(() => first.sdk.storage.set('', 'invalid'), /key/);
    assert.throws(() => first.sdk.storage.get('bad\u0000key'), /key/);
    first.dispose(); upgraded.dispose(); other.dispose();
});

test('capabilities gate every adapter before execution, including undeclared host grants', () => {
    const { calls, adapter } = services();
    let storageCalls = 0;
    const storage: StateStorage = {
        getItem: () => { storageCalls++; return null; },
        setItem: () => { storageCalls++; }, removeItem: () => { storageCalls++; },
    };
    const denied = createExtensionSession(manifest(), [], adapter, storage);
    const undeclared = createExtensionSession({ ...manifest(), capabilities: [] }, EXTENSION_CAPABILITIES, adapter, storage);
    for (const { sdk } of [denied, undeclared]) {
        for (const action of [() => sdk.storage.get('key'), () => sdk.storage.set('key', 'value'),
            () => sdk.storage.remove('key'), () => sdk.models.list(),
            () => sdk.ai.generate({ model: 'chosen', input: 'input' }),
            () => sdk.ai.stream({ model: 'chosen', input: 'input' }, () => {}),
            () => sdk.chat.create(), () => sdk.chat.open('unknown'), () => sdk.chat.read({ id: 'unknown' }),
            () => sdk.chat.send({ id: 'unknown' }, { model: 'chosen', input: 'input' }, () => {}),
            () => sdk.audio.speech({ model: 'chosen', input: 'input' }),
            () => sdk.audio.transcribe({ file: 'data:audio/wav;base64,AA==' })]) {
            assert.throws(action, /not granted/);
        }
        assert.equal(sdk.jobs.list().length, 0);
    }
    assert.equal(storageCalls, 0);
    assert.deepEqual(calls, []);
    denied.dispose(); undeclared.dispose();
});

test('allowed model, generation and audio jobs use host services', async () => {
    const { calls, adapter } = services();
    const session = createExtensionSession(manifest(), EXTENSION_CAPABILITIES, adapter, memory().storage);
    await Promise.all([session.sdk.models.list().result,
        session.sdk.ai.generate({ model: 'chosen', input: 'input' }).result,
        session.sdk.audio.speech({ model: 'chosen', input: 'input' }).result,
        session.sdk.audio.transcribe({ file: 'data:audio/wav;base64,AA==' }).result]);
    assert.deepEqual(calls, ['models', 'generate', 'speech', 'transcribe']);
    assert.ok(session.sdk.jobs.list().every(job => job.status === 'completed'));
    session.dispose();
});

test('storage errors, corrupt data and size limits are reported instead of succeeding', () => {
    const { data, storage } = memory();
    const session = createExtensionSession(manifest(), EXTENSION_CAPABILITIES, services().adapter, storage);
    session.sdk.storage.set('key', 'good');
    assert.throws(() => session.sdk.storage.set('key', 'x'.repeat(EXTENSION_STATE_LIMIT_BYTES)), /size/);
    assert.equal(session.sdk.storage.get('key'), 'good');
    data.set([...data.keys()][0], '{broken');
    assert.throws(() => session.sdk.storage.get('key'), /JSON/);
    const broken = createExtensionSession(manifest('test.broken'), EXTENSION_CAPABILITIES, services().adapter, {
        getItem: () => { throw new Error('storage unavailable'); },
        setItem: () => { throw new Error('quota exceeded'); },
        removeItem: () => { throw new Error('storage unavailable'); },
    });
    assert.throws(() => broken.sdk.storage.set('key', 'value'), /quota exceeded/);
    assert.throws(() => broken.sdk.storage.get('key'), /storage unavailable/);
    assert.throws(() => broken.sdk.storage.remove('key'), /storage unavailable/);
    session.dispose(); broken.dispose();
});

test('job failures remain visible and an observer cannot corrupt completion', async () => {
    const jobs = new ExtensionJobs('test.owner');
    let notifications = 0;
    jobs.subscribe(() => { throw new Error('bad observer'); });
    const unsubscribe = jobs.subscribe(() => { notifications++; });
    const failed = jobs.run('generate', async () => { throw new Error('service failed'); });
    await assert.rejects(failed.result, /service failed/);
    assert.deepEqual(jobs.list()[0], { id: failed.id, operation: 'generate', status: 'failed', error: 'service failed' });
    assert.equal(await jobs.run('models', async () => 4).result, 4);
    assert.ok(notifications >= 4);
    unsubscribe();
    const saved = notifications;
    await jobs.run('models', async () => 5).result;
    assert.equal(notifications, saved);
    jobs.dispose();
});

test('active requests and retained history stay bounded without evicting running work', async () => {
    const jobs = new ExtensionJobs('test.owner');
    const pending = Array.from({ length: MAX_EXTENSION_ACTIVE_JOBS }, () => deferred<number>());
    const running = pending.map(item => jobs.run('generate', () => item.promise));
    assert.throws(() => jobs.run('overflow', async () => 0), /concurrent/);
    pending[0].resolve(0);
    await running[0].result;
    for (let index = 0; index < MAX_EXTENSION_JOB_HISTORY + 8; index++) await jobs.run('models', async () => index).result;
    assert.equal(jobs.list().length, MAX_EXTENSION_JOB_HISTORY);
    for (const active of running.slice(1)) assert.equal(jobs.list().find(job => job.id === active.id)?.status, 'running');
    const snapshots = jobs.list();
    snapshots[0].status = 'failed';
    assert.notEqual(jobs.list()[0].status, 'failed');
    pending.slice(1).forEach(item => item.resolve(1));
    await Promise.all(running.slice(1).map(job => job.result));
    jobs.dispose();
});

test('cancellation rejects promptly even when a started adapter never settles', { timeout: 1000 }, async () => {
    const jobs = new ExtensionJobs('test.owner');
    const started = deferred<AbortSignal>();
    const job = jobs.run('generate', signal => {
        started.resolve(signal);
        return new Promise<string>(() => {});
    });
    const signal = await started.promise;
    job.cancel();
    assert.equal(signal.aborted, true);
    await assert.rejects(job.result, { name: 'AbortError' });
    assert.equal(jobs.list()[0].status, 'cancelled');
    jobs.dispose();
});

test('cancel before service start prevents execution and cancellation ignores late completion', { timeout: 1000 }, async () => {
    const jobs = new ExtensionJobs('test.owner');
    let calls = 0;
    const early = jobs.run('generate', async () => { calls++; return 'unexpected'; });
    early.cancel();
    await assert.rejects(early.result, { name: 'AbortError' });
    assert.equal(calls, 0);
    const pending = deferred<string>();
    const started = deferred<AbortSignal>();
    const late = jobs.run('generate', incoming => { started.resolve(incoming); return pending.promise; });
    const signal = await started.promise;
    late.cancel();
    assert.equal(signal.aborted, true);
    await assert.rejects(late.result, { name: 'AbortError' });
    pending.resolve('stale');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(jobs.list().find(job => job.id === late.id)?.status, 'cancelled');
    assert.equal(jobs.cancel(late.id), false);
    assert.equal(jobs.cancel('other.owner:1'), false);
    jobs.dispose();
});

test('disposal aborts owned work, prevents new calls and cannot cancel another owner', { timeout: 1000 }, async () => {
    const pending = deferred<never>();
    const started = deferred<AbortSignal>();
    const firstServices = services().adapter;
    firstServices.generate = async (_request, incoming) => { started.resolve(incoming); return pending.promise; };
    const first = createExtensionSession(manifest(), EXTENSION_CAPABILITIES, firstServices, memory().storage);
    const other = createExtensionSession(manifest('other.workspace'), EXTENSION_CAPABILITIES, services().adapter, memory().storage);
    const work = first.sdk.ai.generate({ model: 'chosen', input: 'input' });
    const signal = await started.promise;
    assert.equal(other.sdk.jobs.cancel(work.id), false);
    first.dispose(); first.dispose();
    assert.equal(signal.aborted, true);
    await assert.rejects(work.result, { name: 'AbortError' });
    pending.reject(new Error('late service error'));
    await new Promise(resolve => setImmediate(resolve));
    assert.throws(() => first.sdk.models.list(), /disposed/);
    assert.throws(() => first.sdk.storage.get('key'), /disposed/);
    assert.throws(() => first.sdk.jobs.subscribe(() => {}), /disposed/);
    assert.equal(first.sdk.jobs.cancel(work.id), false);
    assert.equal((await other.sdk.models.list().result).installed.length, 0);
    other.dispose();
});

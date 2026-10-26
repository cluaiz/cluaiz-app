import test from 'node:test';
import assert from 'node:assert/strict';
import { createExtensionSession, type ExtensionServices } from '../src/extensions/sdk';
import { EXTENSION_CAPABILITIES } from '../src/extensions/manifest';
import { EXTENSION_HOST } from '../src/extensions/compatibility';
import type { StateStorage } from '../src/extensions/storage';
import type { InstalledModelsResponse } from '../src/api/engine/models/models.types';

const manifest = (version = '1.0.0', id = 'test.workspace') => ({
    hub_type: 'extension', id, name: 'Identity test workspace', version, host_api: 1,
    capabilities: [...EXTENSION_CAPABILITIES],
    contributes: { views: [{ id: 'main', title: 'Main', slot: 'workspace' }] },
});
function stateStorage(): StateStorage {
    const values = new Map<string, string>();
    return {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => { values.set(key, value); },
        removeItem: key => { values.delete(key); },
    };
}
const availableModels = (): InstalledModelsResponse => ({ status: 'success', count: 0, installed: [] });
const services = (): ExtensionServices => ({
    listModels: async () => availableModels(),
    generate: async request => ({ id: 'identity-test', object: 'chat.completion', created: 0,
        model: request.model, choices: [] }),
    stream: async () => {},
    speak: async () => new Blob(),
    transcribe: async () => ({ text: 'Test transcript' }),
});

test('same-package sessions have distinct host identities and cannot cancel each other jobs', { timeout: 1000 }, async () => {
    let release!: (response: InstalledModelsResponse) => void;
    const pending = new Promise<InstalledModelsResponse>(resolve => { release = resolve; });
    let started!: () => void;
    const allStarted = new Promise<void>(resolve => { started = resolve; });
    const signals: AbortSignal[] = [];
    const adapter = services();
    adapter.listModels = signal => {
        signals.push(signal);
        if (signals.length === 2) started();
        return pending;
    };
    const storage = stateStorage();
    const first = createExtensionSession(manifest(), EXTENSION_CAPABILITIES, adapter, storage);
    const second = createExtensionSession(manifest(), EXTENSION_CAPABILITIES, adapter, storage);
    try {
        assert.notEqual(first.sdk.identity.instanceId, second.sdk.identity.instanceId);
        assert.match(first.sdk.identity.instanceId, /^[0-9a-f]{32}$/);
        const a = first.sdk.models.list();
        const b = second.sdk.models.list();
        await allStarted;
        assert.notEqual(a.id, b.id);
        assert.ok(a.id.includes(first.sdk.identity.instanceId));
        assert.ok(b.id.includes(second.sdk.identity.instanceId));
        assert.equal(second.sdk.jobs.cancel(a.id), false);
        assert.equal(first.sdk.jobs.cancel(b.id), false);
        assert.ok(signals.every(signal => !signal.aborted));
        assert.equal(second.sdk.jobs.list()[0].status, 'running');
        a.cancel();
        await assert.rejects(a.result, { name: 'AbortError' });
        assert.equal(signals[0].aborted, true);
        assert.equal(signals[1].aborted, false);
        assert.equal(second.sdk.jobs.list()[0].status, 'running');
        release(availableModels());
        assert.equal((await b.result).status, 'success');
    } finally {
        first.dispose(); second.dispose();
    }
});

test('manifest-supplied instance identity is ignored and package storage survives new instances and versions', () => {
    const storage = stateStorage();
    const input = { ...manifest(), instanceId: 'forged-instance',
        identity: { id: 'other.owner', instanceId: 'forged-nested-instance' } };
    const first = createExtensionSession(input, EXTENSION_CAPABILITIES, services(), storage);
    const reopened = createExtensionSession(manifest(), EXTENSION_CAPABILITIES, services(), storage);
    const upgraded = createExtensionSession(manifest('2.0.0'), EXTENSION_CAPABILITIES, services(), storage);
    const other = createExtensionSession(manifest('1.0.0', 'other.workspace'), EXTENSION_CAPABILITIES, services(), storage);
    try {
        assert.equal(first.sdk.identity.id, 'test.workspace');
        assert.notEqual(first.sdk.identity.instanceId, input.instanceId);
        assert.notEqual(first.sdk.identity.instanceId, input.identity.instanceId);
        assert.equal(new Set([first, reopened, upgraded].map(session => session.sdk.identity.instanceId)).size, 3);
        first.sdk.storage.set('document', { saved: 'shared package state' });
        assert.deepEqual(reopened.sdk.storage.get('document'), { saved: 'shared package state' });
        assert.deepEqual(upgraded.sdk.storage.get('document'), { saved: 'shared package state' });
        assert.equal(other.sdk.storage.get('document'), null);
        reopened.sdk.storage.set('document', 'updated');
        assert.equal(upgraded.sdk.storage.get('document'), 'updated');
        first.dispose();
        assert.equal(reopened.sdk.storage.get('document'), 'updated');
    } finally {
        for (const session of [first, reopened, upgraded, other]) session.dispose();
    }
});

test('host discovery, session identity and granted snapshots are immutable and advertise only running support', () => {
    const grants = [...EXTENSION_CAPABILITIES];
    const session = createExtensionSession(manifest(), grants, services(), stateStorage());
    try {
        grants.length = 0;
        const { sdk } = session;
        assert.equal(sdk.host, EXTENSION_HOST);
        assert.deepEqual(sdk.host.runtimes, ['bundled']);
        assert.deepEqual(sdk.host.surfaces, ['workspace']);
        assert.deepEqual(sdk.host.layouts, ['full', 'with-chat']);
        assert.deepEqual(sdk.host.activation, ['on-demand']);
        assert.equal(sdk.host.hostApi, 1);
        assert.deepEqual(sdk.host.capabilities, [
            'storage.read', 'storage.write', 'models.list', 'ai.generate', 'ai.stream', 'audio.speech', 'audio.transcribe',
            'chat.sessions', 'chat.send',
        ]);
        assert.deepEqual(sdk.grantedCapabilities, sdk.host.capabilities);
        for (const frozen of [sdk, sdk.identity, sdk.grantedCapabilities, sdk.host, ...Object.values(sdk.host)]) {
            if (frozen && typeof frozen === 'object') assert.ok(Object.isFrozen(frozen));
        }
        const saved = sdk.identity.instanceId;
        assert.equal(Reflect.set(sdk.identity, 'instanceId', 'spoofed'), false);
        assert.equal(Reflect.set(sdk.host, 'hostApi', 99), false);
        assert.equal(Reflect.set(sdk.grantedCapabilities, '0', 'os.execute'), false);
        assert.equal(sdk.identity.instanceId, saved);
        assert.equal(sdk.grantedCapabilities[0], 'storage.read');
    } finally { session.dispose(); }
});

test('effective session grants remain the declared and granted intersection', async () => {
    let storageCalls = 0;
    let serviceCalls = 0;
    const storage: StateStorage = {
        getItem: () => { storageCalls++; return null; },
        setItem: () => { storageCalls++; },
        removeItem: () => { storageCalls++; },
    };
    const adapter = services();
    adapter.listModels = async () => { serviceCalls++; return availableModels(); };
    const session = createExtensionSession({ ...manifest(), capabilities: ['storage.read', 'models.list'] },
        ['models.list', 'storage.write'], adapter, storage);
    try {
        assert.deepEqual(session.sdk.grantedCapabilities, ['models.list']);
        assert.equal(session.sdk.host.capabilities.length, EXTENSION_CAPABILITIES.length);
        assert.throws(() => session.sdk.storage.get('key'), /not granted/);
        assert.throws(() => session.sdk.storage.set('key', 'value'), /not granted/);
        assert.throws(() => session.sdk.storage.remove('key'), /not granted/);
        assert.throws(() => session.sdk.ai.generate({ model: 'selected', input: 'text' }), /not granted/);
        await session.sdk.models.list().result;
        assert.equal(storageCalls, 0);
        assert.equal(serviceCalls, 1);
    } finally { session.dispose(); }
});

test('missing secure randomness fails clearly without creating a weak instance ID', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    assert.ok(!descriptor || descriptor.configurable, 'Test requires a replaceable global crypto descriptor.');
    try {
        Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
        assert.throws(() => createExtensionSession(manifest(), EXTENSION_CAPABILITIES, services(), stateStorage()),
            /Secure random source is unavailable/);
    } finally {
        if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor);
        else Reflect.deleteProperty(globalThis, 'crypto');
    }
    const session = createExtensionSession(manifest(), [], services(), stateStorage());
    assert.match(session.sdk.identity.instanceId, /^[0-9a-f]{32}$/);
    session.dispose();
});

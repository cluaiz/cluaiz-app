import test from 'node:test';
import assert from 'node:assert/strict';
import { MessageChannel } from 'node:worker_threads';
import { nativeWire } from '../src/extensions/surfaces/nativeWire';
import { bootstrapExtension, EXTENSION_PORT_MESSAGE, EXTENSION_SURFACE_NAME } from '../src/extensions/guest/bootstrap';
import { attachExtensionHost } from '../src/extensions/guest/host';
import { messagePortTransport } from '../src/extensions/guest/transport';
import { createExtensionSession, type ExtensionServices } from '../src/extensions/sdk';

test('native adapter roundtrips bounded Blob bytes and refuses oversized/deep messages', async () => {
    const codec = nativeWire(globalThis as unknown as Window & typeof globalThis,
        { bytes: 256, depth: 4, nodes: 30, pending: 8, version: 1, portMessage: EXTENSION_PORT_MESSAGE });
    const original = new Blob([Uint8Array.of(1, 2, 3, 255)], { type: 'audio/wav' });
    const raw = await codec.encode({ v: 1, payload: original });
    const value = await codec.decode(raw) as { payload: Blob };
    assert.equal(value.payload.type, 'audio/wav');
    assert.deepEqual(new Uint8Array(await value.payload.arrayBuffer()), Uint8Array.of(1, 2, 3, 255));
    const ordinary = { $cluaizBlob: 'AQID', mime: 'text/plain' };
    assert.deepEqual(await codec.decode(await codec.encode(ordinary)), ordinary);
    await assert.rejects(codec.encode({ large: new Blob([new Uint8Array(257)]) }), /large/);
    await assert.rejects(codec.decode('x'.repeat(513)), /large/);
    await assert.rejects(codec.encode({ a: { b: { c: { d: { e: 1 } } } } }), /limit/);
});

test('surface bootstrap ignores another sender and connects only its actual parent port', async t => {
    const parent = {};
    const view = Object.assign(new EventTarget(), { parent, name: EXTENSION_SURFACE_NAME });
    const old = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Object.defineProperty(globalThis, 'window', { configurable: true, value: view });
    t.after(() => { if (old) Object.defineProperty(globalThis, 'window', old); else delete (globalThis as { window?: unknown }).window; });
    const unavailable = async (): Promise<never> => { throw new Error('Test service unavailable'); };
    const services: ExtensionServices = { listModels: unavailable, generate: unavailable, stream: unavailable, speak: unavailable, transcribe: unavailable };
    const values = new Map<string, string>();
    const session = createExtensionSession({ id: 'surface.bootstrap', name: 'Bootstrap test', version: '1.0.0', hub_type: 'extension',
        host_api: 1, capabilities: ['storage.read', 'storage.write'], contributes: { views: [{ id: 'main', title: 'Main', slot: 'workspace' }] } },
    ['storage.read', 'storage.write'], services, { getItem: key => values.get(key) ?? null,
        setItem: (key, value) => { values.set(key, value); }, removeItem: key => { values.delete(key); } });
    const channel = new MessageChannel();
    const host = attachExtensionHost({ session, kind: 'web', supportedCapabilities: ['storage.read', 'storage.write'],
        transport: messagePortTransport(channel.port1 as unknown as MessagePort) });
    t.after(() => { host.close(); channel.port2.close(); });
    const connection = bootstrapExtension();
    const send = (source: unknown) => {
        const event = Object.assign(new Event('message'), { source, data: { type: EXTENSION_PORT_MESSAGE }, ports: [channel.port2] });
        view.dispatchEvent(event);
    };
    send({});
    await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(values.size, 0);
    send(parent);
    const opened = await connection;
    assert.ok(opened);
    await opened.sdk.storage.set('draft', 'Owned parent connection');
    assert.equal(await opened.sdk.storage.get('draft'), 'Owned parent connection');
    opened.close();
    assert.throws(() => opened.sdk.storage.get('draft'), /closed/i);
});

test('ordinary embedded preview stays standalone without an App surface marker', async t => {
    const old = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { parent: {}, name: '' } });
    t.after(() => { if (old) Object.defineProperty(globalThis, 'window', old); else delete (globalThis as { window?: unknown }).window; });
    assert.equal(await bootstrapExtension(), null);
});

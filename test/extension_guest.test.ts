import test from 'node:test';
import assert from 'node:assert/strict';
import { createExtensionSession, type ExtensionServices } from '../src/extensions/sdk';
import { EXTENSION_CAPABILITIES, type ExtensionCapability } from '../src/extensions/manifest';
import type { ExtensionStreamListener } from '../src/extensions/client';
import type { StateStorage } from '../src/extensions/storage';
import { attachExtensionHost } from '../src/extensions/guest/host';
import { connectExtension } from '../src/extensions/guest/client';
import { messagePortTransport, type GuestTransport } from '../src/extensions/guest/transport';
import { GUEST_LIMITS, guestMessage, wireCopy } from '../src/extensions/guest/protocol';
import { validateGuestTheme, type GuestThemeSource } from '../src/extensions/guest/theme';

// These are controlled service boundaries, not model inference or platform isolation evidence.
function deferred<T = void>() {
    let resolve!: (value: T) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}
const request = { model: 'selected-by-test', input: 'service contract input' };
function storage(): StateStorage {
    const data = new Map<string, string>();
    return { getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); }, removeItem: key => { data.delete(key); } };
}
function providers(): ExtensionServices {
    return {
        listModels: async () => ({ status: 'success', count: 0, installed: [] }),
        generate: async value => ({ id: 'unit-result', object: 'chat.completion', created: 0, model: value.model, choices: [] }),
        stream: async (_value, emit) => { emit({ type: 'text', text: 'contract delta' }); },
        speak: async () => new Blob(['unit audio bytes'], { type: 'audio/wav' }),
        transcribe: async () => ({ text: 'unit transcription boundary' }),
        chat: () => {
            const handles = new WeakSet<object>();
            const issue = () => { const handle = Object.freeze({ id: crypto.randomUUID() }); handles.add(handle); return handle; };
            return {
                create: async () => issue(), open: async () => issue(),
                read: async handle => {
                    assert.ok(handles.has(handle), 'bridge must retain the original host handle object');
                    return { id: handle.id, title: 'unit chat', messages: [] };
                },
                send: async (handle, _request, emit) => { assert.ok(handles.has(handle)); emit({ type: 'text', text: 'unit chat delta' }); },
                dispose() {},
            };
        },
    };
}
function session(services: ExtensionServices, grants: readonly ExtensionCapability[], state = storage()) {
    return createExtensionSession({ hub_type: 'extension', id: 'test.guest', name: 'Guest', version: '1.0.0',
        host_api: 1, capabilities: [...EXTENSION_CAPABILITIES],
        contributes: { views: [{ id: 'main', title: 'Main', slot: 'workspace' }] } }, grants, services, state);
}
async function fixture(t: test.TestContext, options: { services?: ExtensionServices; grants?: readonly ExtensionCapability[];
    supported?: readonly ExtensionCapability[]; kind?: 'web' | 'desktop'; state?: StateStorage; theme?: GuestThemeSource } = {}) {
    const channel = new MessageChannel();
    const clientPort = messagePortTransport(channel.port2);
    const hostPort = messagePortTransport(channel.port1);
    const sent: unknown[] = [];
    const host = attachExtensionHost({ transport: hostPort, session: session(options.services ?? providers(),
        options.grants ?? EXTENSION_CAPABILITIES, options.state), kind: options.kind ?? 'web',
        supportedCapabilities: options.supported ?? EXTENSION_CAPABILITIES, theme: options.theme });
    t.after(() => { host.close(); clientPort.close(); });
    const transport: GuestTransport = { ...clientPort, send(value) { sent.push(structuredClone(value)); clientPort.send(value); } };
    const connection = await connectExtension(transport);
    t.after(() => connection.close());
    return { host, connection, transport, sent };
}
function code(expected: string) { return (error: unknown) => (error as { code?: string })?.code === expected; }
function peer(port: MessagePort) {
    const values: unknown[] = [];
    let waiter: ((value: unknown) => void) | undefined;
    port.addEventListener('message', event => {
        if (waiter) { const resolve = waiter; waiter = undefined; resolve(event.data); } else values.push(event.data);
    });
    port.start();
    return { next: (): Promise<any> => values.length ? Promise.resolve(values.shift()) : new Promise(resolve => { waiter = resolve; }),
        send: (value: unknown) => port.postMessage(value) };
}
function rawHost(t: test.TestContext, options: { services?: ExtensionServices; grants?: readonly ExtensionCapability[] } = {}) {
    const channel = new MessageChannel();
    const host = attachExtensionHost({ transport: messagePortTransport(channel.port1),
        session: session(options.services ?? providers(), options.grants ?? EXTENSION_CAPABILITIES),
        kind: 'web', supportedCapabilities: EXTENSION_CAPABILITIES });
    t.after(() => { host.close(); channel.port2.close(); });
    return { host, peer: peer(channel.port2) };
}

test('one guest API uses real ports with both host descriptors and acknowledged storage', async t => {
    for (const kind of ['web', 'desktop'] as const) {
        const { connection } = await fixture(t, { kind });
        const sdk = connection.sdk;
        assert.equal(sdk.host.kind, kind);
        assert.ok(Object.isFrozen(sdk.host.identity));
        assert.ok(Object.isFrozen(sdk.grantedCapabilities));
        const saving = sdk.storage.set('draft', { value: 'retained' });
        assert.ok(saving instanceof Promise);
        await saving;
        assert.equal((await sdk.storage.get('draft') as { value: string }).value, 'retained');
        await sdk.storage.remove('draft');
        assert.equal(await sdk.storage.get('draft'), null);
        assert.equal((await sdk.models.list().result).count, 0);
        assert.equal((await sdk.ai.generate(request).result).model, request.model);
        assert.equal(await (await sdk.audio.speech({ input: 'unit' }).result).text(), 'unit audio bytes');
    }
});
test('grants and supported services differ; neither refused operation reaches a provider', async t => {
    let calls = 0;
    const services = { ...providers(), listModels: async () => { calls++; return providers().listModels(new AbortController().signal); } };
    const denied = await fixture(t, { services, grants: [] });
    await assert.rejects(denied.connection.sdk.models.list().result, code('DENIED'));
    const unavailable = await fixture(t, { services, supported: [] });
    await assert.rejects(unavailable.connection.sdk.models.list().result, code('UNAVAILABLE'));
    assert.equal(calls, 0);
});
test('a host storage quota failure is rejected rather than acknowledged as a save', async t => {
    const state = storage();
    state.setItem = () => { throw new Error('quota boundary'); };
    const { connection } = await fixture(t, { state });
    await assert.rejects(connection.sdk.storage.set('draft', 'not saved'));
    assert.equal(await connection.sdk.storage.get('draft'), null);
});
test('service errors do not send host exception text or credential-like details', async t => {
    const { connection } = await fixture(t, { services: { ...providers(), generate: async () => { throw new Error('private-host-secret'); } } });
    await assert.rejects(connection.sdk.ai.generate(request).result, error => {
        assert.equal((error as { code: string }).code, 'SERVICE_FAILED');
        assert.doesNotMatch(String(error), /private-host-secret/); return true;
    });
});
test('real-port streams deliver deltas and completion; listener failure cancels the provider', async t => {
    const { connection } = await fixture(t);
    const events: string[] = [];
    await connection.sdk.ai.stream(request, event => events.push(event.text)).result;
    assert.deepEqual(events, ['contract delta']);
    const started = deferred();
    const finished = deferred();
    let abort!: AbortSignal;
    const failing = await fixture(t, { services: { ...providers(), stream: async (_request, emit, signal) => {
        abort = signal; started.resolve(); emit({ type: 'text', text: 'first' }); await finished.promise;
    } } });
    const failed = failing.connection.sdk.ai.stream(request, () => { throw new Error('listener failed'); });
    await started.promise;
    await assert.rejects(failed.result, /listener failed/);
    // An ordered request on the same port proves the preceding cancel was processed.
    await failing.connection.sdk.models.list().result;
    assert.equal(abort.aborted, true);
    finished.resolve();
});
test('cancel ignores late events/results and cannot cancel another connection', async t => {
    const started = deferred();
    const finished = deferred();
    let emit!: ExtensionStreamListener;
    let abort!: AbortSignal;
    const a = await fixture(t, { services: { ...providers(), stream: async (_request, listener, signal) => {
        emit = listener; abort = signal; started.resolve(); await finished.promise;
    } } });
    const b = await fixture(t);
    const events: string[] = [];
    const job = a.connection.sdk.ai.stream(request, event => events.push(event.text));
    await started.promise;
    assert.equal(b.connection.sdk.jobs.cancel(job.id), false);
    job.cancel();
    await assert.rejects(job.result, { name: 'AbortError' });
    await a.connection.sdk.models.list().result;
    assert.equal(abort.aborted, true);
    emit({ type: 'text', text: 'late' }); finished.resolve();
    await b.connection.sdk.models.list().result;
    assert.deepEqual(events, []);
});
test('client request admission is bounded and host close aborts its work only', async t => {
    const started = deferred();
    const finished = deferred();
    const signals: AbortSignal[] = [];
    const a = await fixture(t, { services: { ...providers(), listModels: async signal => {
        signals.push(signal); if (signals.length === GUEST_LIMITS.activeRequests) started.resolve();
        await finished.promise; return { status: 'success', count: 0, installed: [] };
    } } });
    const b = await fixture(t);
    const jobs = Array.from({ length: GUEST_LIMITS.activeRequests }, () => a.connection.sdk.models.list());
    const settled = Promise.allSettled(jobs.map(job => job.result));
    assert.throws(() => a.connection.sdk.models.list(), /limit/);
    await started.promise;
    a.host.close();
    assert.ok((await settled).every(result => result.status === 'rejected'));
    assert.ok(signals.every(signal => signal.aborted));
    assert.equal((await b.connection.sdk.models.list().result).count, 0);
    finished.resolve();
});
test('original host chat handles survive serialization; copied and cross-client public handles fail', async t => {
    const a = await fixture(t);
    const b = await fixture(t);
    const handle = await a.connection.sdk.chat.create({ title: 'owned' }).result;
    assert.equal((await a.connection.sdk.chat.read(handle).result).id, handle.id);
    assert.ok(Object.isFrozen(handle));
    assert.throws(() => a.connection.sdk.chat.read({ id: handle.id }), code('DENIED'));
    assert.throws(() => b.connection.sdk.chat.read(handle), code('DENIED'));
    const text: string[] = [];
    await a.connection.sdk.chat.send(handle, request, event => text.push(event.text)).result;
    assert.deepEqual(text, ['unit chat delta']);
});
test('host refuses a wire token from another instance even when the guest bypasses its facade', async t => {
    const a = rawHost(t); const b = rawHost(t);
    a.peer.send(guestMessage('hello')); b.peer.send(guestMessage('hello'));
    await a.peer.next(); await b.peer.next();
    a.peer.send(guestMessage('request', { id: 1, method: 'chat.create', args: [null] }));
    const handle = (await a.peer.next()).value;
    b.peer.send(guestMessage('request', { id: 1, method: 'chat.read', args: [handle.token] }));
    const refused = await b.peer.next();
    assert.equal(refused.type, 'error'); assert.equal(refused.code, 'DENIED');
});
test('host handle table is bounded without replacing or exposing old handles', async t => {
    const { connection } = await fixture(t);
    const first = await connection.sdk.chat.create().result;
    for (let index = 1; index < GUEST_LIMITS.handles; index++) await connection.sdk.chat.create().result;
    await assert.rejects(connection.sdk.chat.create().result, code('UNAVAILABLE'));
    assert.equal((await connection.sdk.chat.read(first).result).id, first.id);
});
test('transcription permits bounded inline audio and refuses paths and URLs before service calls', async t => {
    let calls = 0;
    const { connection } = await fixture(t, { services: { ...providers(), transcribe: async () => { calls++; return { text: 'unit' }; } } });
    for (const file of ['C:/private.wav', '/etc/private', 'https://invalid.example/audio', 'data:text/plain;base64,QQ==']) {
        await assert.rejects(connection.sdk.audio.transcribe({ file }).result, code('DENIED'));
    }
    assert.equal(calls, 0);
    assert.equal((await connection.sdk.audio.transcribe({ file: 'data:audio/wav;base64,QQ==' }).result).text, 'unit');
    assert.equal(calls, 1);
});
test('unknown methods and unexpected argument keys are rejected without invoking services', async t => {
    const raw = rawHost(t); raw.peer.send(guestMessage('hello')); await raw.peer.next();
    raw.peer.send(guestMessage('request', { id: 1, method: 'get_session_token', args: [] }));
    assert.equal((await raw.peer.next()).code, 'UNAVAILABLE');
    raw.peer.send(guestMessage('request', { id: 2, method: 'ai.generate', args: [{ ...request, headers: { Authorization: 'forged' } }] }));
    assert.equal((await raw.peer.next()).code, 'INVALID_REQUEST');
});
test('requests before hello, incompatible versions and replayed IDs close the endpoint', async t => {
    for (const message of [guestMessage('request', { id: 1, method: 'models.list', args: [] }), { v: 99, type: 'hello' }]) {
        const raw = rawHost(t); raw.peer.send(message);
        assert.equal((await raw.peer.next()).type, 'close');
    }
    const raw = rawHost(t); raw.peer.send(guestMessage('hello')); await raw.peer.next();
    const message = guestMessage('request', { id: 1, method: 'models.list', args: [] });
    raw.peer.send(message); await raw.peer.next(); raw.peer.send(message);
    assert.equal((await raw.peer.next()).type, 'close');
});
test('wire limits reject excessive depth, cycles, unsafe keys and oversized strings/Blobs', () => {
    const cycle: unknown[] = []; cycle.push(cycle);
    let nested: unknown = null;
    for (let index = 0; index <= GUEST_LIMITS.depth; index++) nested = [nested];
    for (const value of [cycle, nested, new Date(), { callback() {} }, JSON.parse('{"__proto__":{}}'),
        'x'.repeat(GUEST_LIMITS.messageBytes + 1), new Blob([new Uint8Array(GUEST_LIMITS.messageBytes)])]) {
        assert.throws(() => wireCopy(value), code('PROTOCOL'));
    }
});
test('theme messages are copied, bounded and stop after closing the connection', async t => {
    let current = validateGuestTheme({ variables: { '--accent-color': '#123456' }, classes: ['theme-dark'] });
    const listeners = new Set<() => void>();
    const { host, connection } = await fixture(t, { theme: { current: () => current,
        subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; } } });
    const seen = deferred();
    let changes = 0;
    connection.sdk.theme.subscribe(value => { changes++; assert.equal(value.variables['--accent-color'], '#abcdef'); seen.resolve(); });
    assert.equal(connection.sdk.theme.current()!.variables['--accent-color'], '#123456');
    assert.ok(Object.isFrozen(connection.sdk.theme.current()!.variables));
    current = validateGuestTheme({ variables: { '--accent-color': '#abcdef' }, classes: ['theme-light'] });
    for (const listener of listeners) listener();
    await seen.promise; assert.equal(changes, 1);
    host.close(); assert.equal(listeners.size, 0);
    assert.throws(() => validateGuestTheme({ variables: { color: 'red' }, classes: ['theme-light'] }));
    assert.throws(() => validateGuestTheme({ variables: {}, classes: ['arbitrary-host-class'] }));
});
test('a silent endpoint times out and an aborted connection does not remain pending', async t => {
    const channel = new MessageChannel();
    t.after(() => { channel.port1.close(); channel.port2.close(); });
    await assert.rejects(connectExtension(messagePortTransport(channel.port1), { handshakeMs: 15 }), code('UNAVAILABLE'));
    const aborted = new AbortController(); aborted.abort();
    const other = new MessageChannel();
    t.after(() => { other.port1.close(); other.port2.close(); });
    await assert.rejects(connectExtension(messagePortTransport(other.port1), { signal: aborted.signal }), code('CLOSED'));
});

test('an unacknowledged stream burst fails explicitly instead of queueing without a bound', async t => {
    const { connection } = await fixture(t, { services: { ...providers(), stream: async (_request, emit) => {
        for (let index = 0; index <= GUEST_LIMITS.streamEvents; index++) emit({ type: 'text', text: String(index) });
    } } });
    const events: string[] = [];
    await assert.rejects(connection.sdk.ai.stream(request, event => events.push(event.text)).result, code('UNAVAILABLE'));
    assert.equal(events.length, GUEST_LIMITS.streamEvents);
    assert.equal((await connection.sdk.models.list().result).count, 0);
});
test('host raw ingress also bounds concurrent work when a guest bypasses client admission', async t => {
    const held = deferred();
    const raw = rawHost(t, { services: { ...providers(), listModels: async () => {
        await held.promise; return { status: 'success', count: 0, installed: [] };
    } } });
    raw.peer.send(guestMessage('hello')); await raw.peer.next();
    for (let id = 1; id <= GUEST_LIMITS.activeRequests + 1; id++) {
        raw.peer.send(guestMessage('request', { id, method: 'models.list', args: [] }));
    }
    assert.equal((await raw.peer.next()).type, 'close'); held.resolve();
});
test('optional undefined properties use JSON semantics, while arbitrary getters never execute', async t => {
    const { connection } = await fixture(t);
    assert.equal((await connection.sdk.ai.generate({ ...request, maxTokens: undefined }).result).model, request.model);
    let accessed = false;
    const value = Object.defineProperty({}, 'hidden', { enumerable: true, get() { accessed = true; return 'value'; } });
    assert.throws(() => wireCopy(value), code('PROTOCOL'));
    assert.equal(accessed, false);
});
test('oversized host audio is rejected instead of delivering unbounded binary output', async t => {
    const { connection } = await fixture(t, { services: { ...providers(), speak: async () =>
        new Blob([new Uint8Array(GUEST_LIMITS.messageBytes)]) } });
    await assert.rejects(connection.sdk.audio.speech({ input: 'unit' }).result);
    assert.throws(() => connection.sdk.models.list(), code('CLOSED'));
});
test('client refuses forged host discovery and does not expose a fake connected SDK', async t => {
    const channel = new MessageChannel(); const raw = peer(channel.port2);
    t.after(() => { channel.port1.close(); channel.port2.close(); });
    const connecting = connectExtension(messagePortTransport(channel.port1));
    await raw.next();
    raw.send(guestMessage('ready', { host: { kind: 'web', identity: { id: 'bad', instanceId: 'spoofed' },
        supportedCapabilities: [], grantedCapabilities: [] }, theme: null }));
    await assert.rejects(connecting, code('PROTOCOL'));
});
test('one host session cannot be attached to two endpoints', t => {
    const first = new MessageChannel(); const second = new MessageChannel();
    const owned = session(providers(), EXTENSION_CAPABILITIES);
    const host = attachExtensionHost({ transport: messagePortTransport(first.port1), session: owned,
        kind: 'web', supportedCapabilities: EXTENSION_CAPABILITIES });
    t.after(() => { host.close(); first.port2.close(); second.port1.close(); second.port2.close(); });
    assert.throws(() => attachExtensionHost({ transport: messagePortTransport(second.port1),
        session: owned, kind: 'web', supportedCapabilities: EXTENSION_CAPABILITIES }), code('INVALID_REQUEST'));
});

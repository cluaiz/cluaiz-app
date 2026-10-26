import test from 'node:test';
import assert from 'node:assert/strict';
import { createExtensionSession, type ExtensionServices, type ExtensionStreamEvent,
    type ExtensionStreamListener } from '../src/extensions/sdk';
import { EXTENSION_CAPABILITIES, type ExtensionCapability } from '../src/extensions/manifest';
import { EXTENSION_HOST, inspectExtensionContract } from '../src/extensions/compatibility';
import { adaptBundledManifest } from '../src/extensions/contract';
import { extensionServices } from '../src/extensions/services';
import { chatApi } from '../src/api/engine/chat/chat.api';
import { useConnectionStore } from '../src/store/engine/useConnectionStore';

const request = { model: 'selected-model', input: 'Current document', maxTokens: 32 };
const manifest = (capabilities: readonly string[] = EXTENSION_CAPABILITIES) => ({
    hub_type: 'extension', id: 'test.stream', name: 'Stream test', version: '1.0.0', host_api: 1,
    capabilities, contributes: { views: [{ id: 'main', title: 'Main', slot: 'workspace' }] },
});
function session(services = extensionServices, requested?: readonly string[], granted: readonly ExtensionCapability[] = EXTENSION_CAPABILITIES) {
    const values = new Map<string, string>();
    return createExtensionSession(manifest(requested), granted, services, {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => { values.set(key, value); },
        removeItem: key => { values.delete(key); },
    });
}
function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: Error) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}
function pendingStream() {
    const started = deferred<void>();
    const settled = deferred<void>();
    let emit!: ExtensionStreamListener;
    let signal!: AbortSignal;
    const services: ExtensionServices = { ...extensionServices, stream: (_request, listener, abort) => {
        emit = listener; signal = abort; started.resolve(); return settled.promise;
    } };
    return { services, started: started.promise, settled,
        emit: (event: ExtensionStreamEvent) => emit(event), signal: () => signal };
}

test('stream is discovered but requires its own declared and host-granted capability', () => {
    assert.ok(EXTENSION_HOST.capabilities.includes('ai.stream'));
    assert.equal(inspectExtensionContract(adaptBundledManifest(manifest(['ai.stream']))).compatible, true);
    let calls = 0;
    const services: ExtensionServices = { ...extensionServices, stream: async () => { calls++; } };
    const denied = session(services, ['ai.stream'], []);
    const undeclared = session(services, ['ai.generate']);
    for (const current of [denied, undeclared]) {
        assert.throws(() => current.sdk.ai.stream(request, () => {}), /not granted/);
        assert.equal(current.sdk.jobs.list().length, 0);
        current.dispose();
    }
    assert.equal(calls, 0);
});

test('a missing stream listener is rejected before registering work', () => {
    const current = session();
    try {
        assert.throws(() => current.sdk.ai.stream(request, undefined as never), /listener/);
        assert.equal(current.sdk.jobs.list().length, 0);
    } finally { current.dispose(); }
});

test('service reuses the existing chat stream adapter, payload and request signal', async t => {
    const signal = new AbortController().signal;
    const events: ExtensionStreamEvent[] = [];
    const adapter = t.mock.method(chatApi, 'streamCompletion', async (_payload, options) => {
        options?.onReasoning?.('Consider'); options?.onToken?.('Answer');
    });
    await extensionServices.stream(request, event => events.push(event), signal);
    assert.deepEqual(adapter.mock.calls[0].arguments[0], {
        model: request.model, messages: [{ role: 'user', content: request.input }], max_tokens: 32,
        temporary_chat: 'strict', tools: [], tool_choice: 'none',
    });
    assert.equal(adapter.mock.calls[0].arguments[1]?.signal, signal);
    assert.deepEqual(events, [{ type: 'reasoning', text: 'Consider' }, { type: 'text', text: 'Answer' }]);
});

test('invalid streaming input fails before the existing adapter is invoked', async t => {
    const adapter = t.mock.method(chatApi, 'streamCompletion', async () => {});
    for (const invalid of [null, { ...request, model: '' }, { ...request, input: ' ' },
        { ...request, maxTokens: 0 }, { ...request, maxTokens: Infinity }, { ...request, maxTokens: 1.5 }]) {
        await assert.rejects(extensionServices.stream(invalid as never, () => {}, new AbortController().signal), /model/);
    }
    assert.equal(adapter.mock.callCount(), 0);
});

test('SDK consumes split SSE through actual service/parser and completes without collecting a second full reply', async t => {
    const previous = useConnectionStore.getState();
    useConnectionStore.setState({ protocol: 'http' });
    t.after(() => useConnectionStore.setState(previous));
    const body = 'data: {"choices":[{"delta":{"reasoning_content":"Check"}}]}\n\n'
        + 'data: {"choices":[{"delta":{"content":"नमस्ते"}}]}\n\n'
        + 'data: [DONE]\n\n';
    const bytes = new TextEncoder().encode(body);
    let sourceCancelled = false;
    let payload: Record<string, unknown> | undefined;
    const fetch = t.mock.method(globalThis, 'fetch', async (_url, options) => {
        payload = JSON.parse(String(options?.body));
        return new Response(new ReadableStream<Uint8Array>({ start(controller) {
            for (let offset = 0; offset < bytes.length; offset += 7) controller.enqueue(bytes.slice(offset, offset + 7));
        }, cancel() { sourceCancelled = true; } }));
    });
    const current = session();
    const events: ExtensionStreamEvent[] = [];
    try {
        const job = current.sdk.ai.stream(request, event => { assert.ok(Object.isFrozen(event)); events.push(event); });
        assert.equal(await job.result, undefined);
        assert.deepEqual(events, [{ type: 'reasoning', text: 'Check' }, { type: 'text', text: 'नमस्ते' }]);
        assert.equal(payload?.stream, true);
        assert.equal(payload?.temporary_chat, 'strict');
        assert.equal(fetch.mock.callCount(), 1);
        assert.equal(sourceCancelled, true);
        assert.equal(current.sdk.jobs.list()[0].status, 'completed');
    } finally { current.dispose(); }
});

test('cancelling before dispatch never invokes the stream service', async () => {
    let calls = 0;
    const current = session({ ...extensionServices, stream: async () => { calls++; } });
    try {
        const job = current.sdk.ai.stream(request, () => {});
        job.cancel();
        await assert.rejects(job.result, { name: 'AbortError' });
        assert.equal(calls, 0);
    } finally { current.dispose(); }
});

for (const action of ['cancel', 'dispose'] as const) {
    test(`${action} rejects promptly and suppresses a provider's late events and late completion`, { timeout: 2000 }, async () => {
        const provider = pendingStream();
        const current = session(provider.services);
        const events: ExtensionStreamEvent[] = [];
        try {
            const job = current.sdk.ai.stream(request, event => events.push(event));
            await provider.started;
            provider.emit({ type: 'text', text: 'Before' });
            if (action === 'cancel') job.cancel(); else current.dispose();
            await assert.rejects(job.result, { name: 'AbortError' });
            assert.equal(provider.signal().aborted, true);
            provider.emit({ type: 'text', text: 'Late' });
            provider.settled.resolve();
            await new Promise(resolve => setImmediate(resolve));
            assert.deepEqual(events, [{ type: 'text', text: 'Before' }]);
            assert.equal(current.sdk.jobs.list()[0].status, 'cancelled');
            if (action === 'dispose') assert.throws(() => current.sdk.ai.stream(request, () => {}), /disposed/);
        } finally { provider.settled.resolve(); current.dispose(); }
    });
}

test('completion closes the event sink and a later provider callback cannot append data', async () => {
    const provider = pendingStream();
    const current = session(provider.services);
    const events: ExtensionStreamEvent[] = [];
    try {
        const job = current.sdk.ai.stream(request, event => events.push(event));
        await provider.started;
        provider.emit({ type: 'text', text: 'Complete' });
        provider.settled.resolve();
        await job.result;
        provider.emit({ type: 'text', text: 'Too late' });
        assert.deepEqual(events, [{ type: 'text', text: 'Complete' }]);
        assert.equal(current.sdk.jobs.list()[0].status, 'completed');
    } finally { provider.settled.resolve(); current.dispose(); }
});

test('same-package instances cannot cancel each other streams', { timeout: 2000 }, async () => {
    const providerA = pendingStream(), providerB = pendingStream();
    const first = session(providerA.services), second = session(providerB.services);
    const events: ExtensionStreamEvent[] = [];
    try {
        const a = first.sdk.ai.stream(request, () => assert.fail('cancelled A must not receive data'));
        const b = second.sdk.ai.stream(request, event => events.push(event));
        await Promise.all([providerA.started, providerB.started]);
        assert.notEqual(a.id, b.id);
        assert.equal(second.sdk.jobs.cancel(a.id), false);
        a.cancel();
        await assert.rejects(a.result, { name: 'AbortError' });
        assert.equal(providerB.signal().aborted, false);
        providerA.emit({ type: 'text', text: 'A late' });
        providerB.emit({ type: 'text', text: 'B reply' });
        providerA.settled.reject(new Error('Late provider failure'));
        providerB.settled.resolve();
        await b.result;
        await new Promise(resolve => setImmediate(resolve));
        assert.deepEqual(events, [{ type: 'text', text: 'B reply' }]);
        assert.equal(second.sdk.jobs.list()[0].status, 'completed');
    } finally {
        providerA.settled.resolve(); providerB.settled.resolve(); first.dispose(); second.dispose();
    }
});

for (const [name, frames, expected] of [
    ['Engine error frame', 'data: {"error":{"message":"Model unavailable"}}\n\ndata: [DONE]\n\n', /Model unavailable/],
    ['truncated stream', 'data: {"choices":[{"delta":{"content":"Partial"}}]}\n\n', /before \[DONE\]/],
] as const) {
    test(`${name} rejects the streaming job instead of marking it complete`, async t => {
        const previous = useConnectionStore.getState();
        useConnectionStore.setState({ protocol: 'http' });
        t.after(() => useConnectionStore.setState(previous));
        t.mock.method(globalThis, 'fetch', async () => new Response(frames));
        const current = session();
        try {
            const job = current.sdk.ai.stream(request, () => {});
            await assert.rejects(job.result, expected);
            assert.equal(current.sdk.jobs.list()[0].status, 'failed');
        } finally { current.dispose(); }
    });
}

test('listener failure rejects the job through the existing parser', async t => {
    const previous = useConnectionStore.getState();
    useConnectionStore.setState({ protocol: 'http' });
    t.after(() => useConnectionStore.setState(previous));
    t.mock.method(globalThis, 'fetch', async () => new Response(
        'data: {"choices":[{"delta":{"content":"Answer"}}]}\n\ndata: [DONE]\n\n'));
    const current = session();
    try {
        const job = current.sdk.ai.stream(request, () => { throw new Error('View listener failed'); });
        await assert.rejects(job.result, /View listener failed/);
        assert.equal(current.sdk.jobs.list()[0].status, 'failed');
    } finally { current.dispose(); }
});

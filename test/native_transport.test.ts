import test from 'node:test';
import assert from 'node:assert/strict';
import { createNativeFetch, MAX_NATIVE_CHUNK_BYTES, MAX_NATIVE_REQUEST_BYTES, type NativeInvoke } from '../src/api/client/nativeFetch';
import { createEngineFetch } from '../src/api/client/transport';
import { ipc } from '../src/api/client/ipc';
import { executeApiRequest } from '../src/features/api/services/apiTransport';

const base = 'http://127.0.0.1:8000';
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
const encode = (text: string) => Array.from(new TextEncoder().encode(text));
function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}
function bridge(options: { status?: number; headers?: [string, string][]; chunks?: Array<{ data: number[]; done: boolean }>;
    handler?: (command: string, args: Record<string, unknown>) => unknown } = {}) {
    const calls: Array<{ command: string; args: Record<string, unknown> }> = [];
    const chunks = [...(options.chunks || [{ data: [], done: true }])];
    const invoke: NativeInvoke = async <T>(command: string, args: Record<string, unknown>): Promise<T> => {
        calls.push({ command, args });
        if (options.handler) return await options.handler(command, args) as T;
        if (command === 'engine_native_start') return 'native-owned-id' as T;
        if (command === 'engine_native_head') return { status: options.status || 200,
            headers: options.headers || [['content-type', 'application/json']] } as T;
        if (command === 'engine_native_read') return chunks.shift() as T;
        if (command === 'engine_native_cancel') return true as T;
        throw new Error('Unexpected command');
    };
    return { calls, invoke, fetch: createNativeFetch(invoke, base),
        count: (command: string) => calls.filter(call => call.command === command).length };
}

test('native request and JSON response preserve method, query, headers and status without forwarding host authority', async () => {
    const native = bridge({ status: 429, headers: [['content-type', 'application/json'], ['retry-after', '10']],
        chunks: [{ data: encode('{"error":"busy"}'), done: true }] });
    const response = await native.fetch(`${base}/v1/operation?mode=selected`, { method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: 'Bearer no-guest-token',
            Host: 'evil.example', 'Content-Length': '999' }, body: '{"input":"text"}' });
    assert.equal(response.status, 429);
    assert.equal(response.ok, false);
    assert.equal(response.headers.get('retry-after'), '10');
    assert.deepEqual(await response.json(), { error: 'busy' });
    const request = native.calls[0].args.request as any;
    assert.equal(request.method, 'POST');
    assert.equal(request.path, '/v1/operation?mode=selected');
    assert.equal(new TextDecoder().decode(Uint8Array.from(request.body)), '{"input":"text"}');
    assert.deepEqual(request.headers, [['accept', 'application/json'], ['content-type', 'application/json']]);
    await tick();
    assert.equal(native.count('engine_native_cancel'), 1);
});

test('response reads follow consumer demand, preserve binary and finish once', async () => {
    const native = bridge({ headers: [['content-type', 'audio/wav']], chunks: [
        { data: [0, 255, 128], done: false }, { data: [10, 20], done: true }] });
    const response = await native.fetch('/v1/audio/speech');
    await tick();
    assert.equal(native.count('engine_native_read'), 0, 'do not eagerly drain native stream');
    const reader = response.body!.getReader();
    assert.deepEqual((await reader.read()).value, new Uint8Array([0, 255, 128]));
    await tick();
    assert.equal(native.count('engine_native_read'), 1, 'do not prefetch next chunk');
    assert.deepEqual((await reader.read()).value, new Uint8Array([10, 20]));
    assert.equal((await reader.read()).done, true);
    await tick();
    assert.equal(native.count('engine_native_cancel'), 1);
});

test('fragmented UTF-8 SSE remains a standard streaming Response', async () => {
    const bytes = encode('data: {"text":"नमस्ते"}\n\ndata: [DONE]\n\n');
    const native = bridge({ headers: [['content-type', 'text/event-stream']], chunks: [
        { data: bytes.slice(0, 18), done: false }, { data: bytes.slice(18), done: true }] });
    const response = await native.fetch('/v1/chat/completions', { method: 'POST', body: '{}' });
    assert.equal(response.headers.get('content-type'), 'text/event-stream');
    assert.equal(await response.text(), 'data: {"text":"नमस्ते"}\n\ndata: [DONE]\n\n');
});

test('body serialization supports Blob, ArrayBuffer, FormData and Request inputs', async () => {
    for (const body of [new Blob([new Uint8Array([0, 200, 255])], { type: 'audio/wav' }), new Uint8Array([0, 200, 255]).buffer]) {
        const native = bridge({ status: 204 });
        const response = await native.fetch('/v1/upload', { method: 'POST', body });
        assert.equal(response.body, null);
        assert.deepEqual((native.calls[0].args.request as any).body, [0, 200, 255]);
        assert.equal(native.count('engine_native_read'), 0);
    }
    const form = new FormData();
    form.append('language', 'hi');
    form.append('file', new Blob(['audio'], { type: 'audio/wav' }), 'recording.wav');
    const native = bridge({ status: 204 });
    await native.fetch(new Request(`${base}/v1/upload`, { method: 'POST', body: form }));
    const request = native.calls[0].args.request as any;
    const contentType = new Headers(request.headers).get('content-type')!;
    assert.match(contentType, /^multipart\/form-data; boundary=/);
    const decoded = await new Response(Uint8Array.from(request.body), { headers: { 'content-type': contentType } }).formData();
    assert.equal(decoded.get('language'), 'hi');
    assert.equal(await (decoded.get('file') as File).text(), 'audio');
});

test('foreign origins, credentials, fragments and ambiguous native paths fail before invocation', async () => {
    const native = bridge();
    for (const url of ['https://foreign.example/v1/models', 'http://127.0.0.1:9999/v1/models',
        'http://user:password@127.0.0.1:8000/v1/models', '//foreign.example/path',
        '/v1/models#fragment', '/v1\\models', 'v1/models', 'file:///etc/passwd']) {
        await assert.rejects(native.fetch(url), TypeError);
    }
    assert.equal(native.calls.length, 0);
});

test('already-aborted signal does not start a native request', async () => {
    const native = bridge();
    const controller = new AbortController(); controller.abort();
    await assert.rejects(native.fetch('/v1/models', { signal: controller.signal }), { name: 'AbortError' });
    assert.equal(native.calls.length, 0);
});

test('abort while start is pending rejects promptly and cancels when the native-owned ID arrives', { timeout: 2000 }, async () => {
    const start = deferred<string>(); const entered = deferred<void>();
    const native = bridge({ handler: command => {
        if (command === 'engine_native_start') { entered.resolve(); return start.promise; }
        if (command === 'engine_native_cancel') return true;
        throw new Error('must not request head after abort');
    } });
    const controller = new AbortController();
    const response = native.fetch('/v1/models', { signal: controller.signal });
    await entered.promise;
    controller.abort();
    await assert.rejects(response, { name: 'AbortError' });
    assert.equal(native.count('engine_native_cancel'), 0);
    start.resolve('late-id'); await tick();
    assert.equal(native.count('engine_native_cancel'), 1);
    assert.deepEqual(native.calls.at(-1)?.args, { id: 'late-id' });
});

test('abort while head is pending observes late rejection and releases the native ID once', { timeout: 2000 }, async () => {
    const head = deferred<unknown>(); const entered = deferred<void>();
    const native = bridge({ handler: command => {
        if (command === 'engine_native_start') return 'id';
        if (command === 'engine_native_head') { entered.resolve(); return head.promise; }
        if (command === 'engine_native_cancel') return true;
        throw new Error('unexpected read');
    } });
    const controller = new AbortController();
    const response = native.fetch('/v1/models', { signal: controller.signal });
    await entered.promise; controller.abort();
    await assert.rejects(response, { name: 'AbortError' });
    head.reject(new Error('late head failure')); await tick();
    assert.equal(native.count('engine_native_cancel'), 1);
});

test('abort during pending body read rejects reader promptly and ignores late bytes', { timeout: 2000 }, async () => {
    const read = deferred<unknown>(); const entered = deferred<void>();
    const native = bridge({ handler: command => {
        if (command === 'engine_native_start') return 'id';
        if (command === 'engine_native_head') return { status: 200, headers: [] };
        if (command === 'engine_native_read') { entered.resolve(); return read.promise; }
        if (command === 'engine_native_cancel') return true;
    } });
    const controller = new AbortController();
    const response = await native.fetch('/v1/stream', { signal: controller.signal });
    const reader = response.body!.getReader(); const pending = reader.read();
    await entered.promise; controller.abort();
    await assert.rejects(pending, { name: 'AbortError' });
    read.resolve({ data: [1, 2, 3], done: true }); await tick();
    await assert.rejects(reader.read(), { name: 'AbortError' });
    assert.equal(native.count('engine_native_cancel'), 1);
});

test('consumer cancellation releases idle native streams and abort remains idempotent', async () => {
    const controller = new AbortController(); const native = bridge();
    const response = await native.fetch('/v1/stream', { signal: controller.signal });
    await response.body!.cancel(); controller.abort(); await tick();
    assert.equal(native.count('engine_native_read'), 0);
    assert.equal(native.count('engine_native_cancel'), 1);
});

test('malformed or oversized chunks and native errors fail without delivering bytes', async () => {
    assert.equal(MAX_NATIVE_REQUEST_BYTES, 128 * 1024 * 1024);
    for (const data of [Array(MAX_NATIVE_CHUNK_BYTES + 1).fill(1), [-1], [256], [1.5], []]) {
        const native = bridge({ chunks: [{ data, done: false }] });
        const response = await native.fetch('/v1/stream');
        await assert.rejects(response.arrayBuffer(), /Invalid native Engine response chunk/);
        await tick(); assert.equal(native.count('engine_native_cancel'), 1);
    }
    const failure = new Error('IPC unavailable');
    const native = bridge({ handler: () => { throw failure; } });
    await assert.rejects(native.fetch('/v1/models'), error => error === failure);
});

test('transport selection is explicit and native failures never fall back to HTTP', async () => {
    let protocol: 'ffi' | 'http' = 'http'; let desktop = false; let network = 0; let native = 0;
    const selected = createEngineFetch({ getProtocol: () => protocol, isTauri: () => desktop,
        getBaseUrl: () => base, httpFetch: async () => { network++; return new Response('http'); },
        nativeInvoke: async () => { native++; throw new Error('native unavailable'); } });
    assert.equal(await (await selected('/v1/models')).text(), 'http');
    protocol = 'ffi';
    await assert.rejects(selected('/v1/models'), /requires the desktop App/);
    assert.equal(native, 0); assert.equal(network, 1);
    desktop = true;
    await assert.rejects(selected('/v1/models'), /native unavailable/);
    assert.equal(native, 1); assert.equal(network, 1);
});

test('Developer Hub native mode returns actual status/body and refuses browser simulation', async t => {
    const native = bridge({ status: 429, chunks: [{ data: encode('{"error":"busy"}'), done: true }] });
    t.mock.method(ipc, 'invoke', native.invoke);
    const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
    try {
        Object.defineProperty(globalThis, 'window', { configurable: true, value: { __TAURI_INTERNALS__: {} } });
        const result = await executeApiRequest({ url: base + '/v1/models', method: 'GET', protocol: 'c-pointer', headers: {}, body: '' });
        assert.equal(result.metrics.status, 429);
        assert.deepEqual(JSON.parse(result.body), { error: 'busy' });
        const starts = native.count('engine_native_start');
        Object.defineProperty(globalThis, 'window', { configurable: true, value: undefined });
        const refused = await executeApiRequest({ url: base + '/v1/models', method: 'GET', protocol: 'c-pointer', headers: {}, body: '' });
        assert.equal(refused.metrics.status, 0);
        assert.match(refused.body, /requires the desktop App/);
        assert.equal(native.count('engine_native_start'), starts);
    } finally {
        if (windowDescriptor) Object.defineProperty(globalThis, 'window', windowDescriptor);
        else Reflect.deleteProperty(globalThis, 'window');
    }
});

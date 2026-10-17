import { test } from 'node:test';
import assert from 'node:assert/strict';
import { streamSse } from '../src/api/client/sse';

test('progress and structured errors are events, completion is notified once', async t => {
    t.mock.method(globalThis, 'fetch', async () => new Response(
        'event: cluaiz.progress\ndata: {"processing":{"stage":"decoding","state":"running"}}\n\n' +
        'data: {"error":{"message":"document extraction failed","type":"invalid_request_error"}}\n\n' +
        'data: [DONE]\n\n'));
    const events: unknown[] = [];
    const tokens: string[] = [];
    let done = 0;
    await streamSse('http://localhost/fixture', {}, { onEvent: event => events.push(event),
        onToken: token => tokens.push(token), onDone: () => done++ });
    assert.equal(events.length, 2);
    assert.equal(done, 1);
    assert.deepEqual(tokens, []);
});

test('premature EOF reports the error before completion', async t => {
    t.mock.method(globalThis, 'fetch', async () => new Response('data: {"choices":[]}\n\n'));
    const order: string[] = [];
    await assert.rejects(streamSse('http://localhost/fixture', {}, {
        onError: error => { order.push('error'); assert.match(error.message, /before \[DONE\]/); },
        onDone: () => order.push('done')
    }));
    assert.deepEqual(order, ['error', 'done']);
});

test('HTTP413 exposes the engine message and is not treated as a successful stream', async t => {
    t.mock.method(globalThis, 'fetch', async () => new Response(
        JSON.stringify({ error: { type: 'request_too_large', message: 'Configured upload limit exceeded' } }), { status: 413 }));
    await assert.rejects(streamSse('http://localhost/fixture', {}, {}), /Configured upload limit exceeded/);
});

test('a cancelled connection stops normally without showing an engine failure', async t => {
    t.mock.method(globalThis, 'fetch', async () => { throw new DOMException('Cancelled', 'AbortError'); });
    let done = 0;
    await streamSse('http://localhost/fixture', {}, {
        onError: () => assert.fail('User cancellation is not a failed request'), onDone: () => done++
    });
    assert.equal(done, 1);
});

test('consumer exceptions do not become raw JSON answer tokens', async t => {
    t.mock.method(globalThis, 'fetch', async () => new Response('data: {"choices":[]}\n\ndata: [DONE]\n\n'));
    const tokens: string[] = [];
    await assert.rejects(streamSse('http://localhost/fixture', {}, {
        onEvent: () => { throw new Error('consumer failed'); }, onToken: token => tokens.push(token)
    }), /consumer failed/);
    assert.deepEqual(tokens, []);
});

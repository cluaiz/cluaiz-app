import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryApi } from '../src/api/engine/memory/memory.api';
import { useMemoryStore } from '../src/api/engine/memory/memory.store';

test('ingest retains partial content and omissions without reporting complete success', async t => {
    const partial = { status: 'partial', total_sources: 1, processed_sources: [{
        source: 'document.pdf', status: 'partial', chunks_count: 1, chunks: ['Known text'],
        parts: [{ page: 2, method: 'pdf_text', omissions: ['missing_page'], warnings: ['OCR unavailable'] }],
    }] };
    const mock = t.mock.method(globalThis, 'fetch', async () => Response.json(partial));
    const result = await useMemoryStore.getState().ingestContent({ source: 'document.pdf' });
    assert.deepEqual(result, partial);
    assert.equal(useMemoryStore.getState().status, 'partial');
    assert.match(useMemoryStore.getState().error || '', /missing_page/);
    mock.mock.mockImplementation(async () => Response.json({ error: { message: 'Denied document access' } }, { status: 403 }));
    assert.equal(await useMemoryStore.getState().ingestContent({ source: 'outside.pdf' }), null);
    assert.equal(useMemoryStore.getState().status, 'error');
    assert.equal(useMemoryStore.getState().lastIngestResult, null);
    assert.match(useMemoryStore.getState().error || '', /Denied document access/);
});

test('embedding adapter preserves image/text parts, float encoding and retention; failures clear old vectors', async t => {
    const payload = { model: 'selected-image-package', input: [
        { type: 'image' as const, source: 'data:image/png;base64,AAAA' },
        { type: 'text' as const, text: 'query' },
    ], encoding_format: 'float' as const, keep_alive: 0 };
    const mock = t.mock.method(globalThis, 'fetch', async (url, options) => {
        assert.match(String(url), /\/v1\/embeddings$/);
        assert.deepEqual(JSON.parse(String(options?.body)), payload);
        return Response.json({ object: 'list', data: [], model: payload.model, usage: { prompt_tokens: 0, total_tokens: 0 } });
    });
    await memoryApi.generateEmbeddings(payload);
    useMemoryStore.setState({ lastEmbeddings: [{ object: 'embedding', embedding: [1], index: 0 }] });
    mock.mock.mockImplementation(async () => Response.json({ error: { message: 'Input exceeds limit' } }, { status: 413 }));
    assert.deepEqual(await useMemoryStore.getState().generateEmbeddings({ input: 'text' }), []);
    assert.equal(useMemoryStore.getState().status, 'error');
    assert.deepEqual(useMemoryStore.getState().lastEmbeddings, []);
});

// The Explorer's ingest (optional model) and embedding (text vs image parts) model choices are tested in
// test/api_explorer.test.cjs, which follows the current /v1/ingest contract.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildCatalog, readPage, examplesFromBody, syncApiDocs } from '../scripts/sync-api-docs.mjs';

test('CEP methods and dedicated HTTP pages produce unique documented requests', async () => {
    const catalog = await buildCatalog();
    const endpoints = catalog.flatMap(group => group.endpoints);
    const discovery = JSON.parse(await readFile(new URL('../../cluaiz/docs/api/cep/openrpc.json', import.meta.url), 'utf8'));
    assert.equal(endpoints.length, discovery.methods.length + 8);
    assert.equal(endpoints.filter(endpoint => endpoint.transport_path).length, discovery.methods.length);
    assert.equal(new Set(endpoints.map(endpoint => `${endpoint.method} ${endpoint.path}`)).size, endpoints.length);
    assert.equal(new Set(catalog.map(group => group.category)).size, 5);
    const described = (params, path) => {
        for (const param of params) {
            assert.ok(param.desc?.trim(), `${path}.${param.name} needs a description`);
            if (param.fields) described(param.fields, `${path}.${param.name}`);
        }
    };
    for (const endpoint of endpoints) {
        assert.ok(endpoint.docs_content.trim().startsWith('#'));
        assert.ok(Array.isArray(endpoint.params));
        described(endpoint.params, endpoint.path);
        for (const example of endpoint.payload_examples) {
            const request = JSON.parse(example.payload);
            if (endpoint.transport_path) {
                assert.equal(request.method, endpoint.path);
                assert.equal(request.jsonrpc, '2.0');
                assert.ok(request.params);
            }
        }
    }
});

test('ingest PDF/DOCX/image and embedding input choices come from Markdown fences', async () => {
    const endpoints = (await buildCatalog()).flatMap(group => group.endpoints);
    const ingest = endpoints.find(endpoint => endpoint.path === '/v1/ingest');
    assert.equal(ingest.payload_examples.length, 16);
    assert.equal(ingest.transport_path, undefined);
    assert.ok(!endpoints.some(endpoint => endpoint.path === 'ingest.run'));
    assert.ok(ingest.payload_examples.every(example => {
        const payload = JSON.parse(example.payload);
        return 'source' in payload && !('jsonrpc' in payload) && !('params' in payload);
    }));
    const catalog = await buildCatalog();
    for (const [group, path] of [['Chat','/v1/chat/completions'],['TTS','/v1/audio/speech'],
        ['STT','/v1/audio/transcriptions'],['Embeddings','/v1/embeddings'],['Ingest','/v1/ingest']]) {
        const endpoint = catalog.find(item => item.group === group)?.endpoints.find(item => item.path === path);
        assert.ok(endpoint, group);
        assert.ok(endpoint.examples.some(example => example.language === 'python'), `${group} Python`);
        assert.ok(endpoint.examples.some(example => ['js','javascript','typescript'].includes(example.language)), `${group} JavaScript`);
    }
    assert.ok(!catalog.some(group => group.group === 'OpenAI'));

    for (const type of ['PDF', 'DOCX', 'Receipt/image', 'Mixed native batch', 'Image to selected ONNX']) {
        assert.ok(ingest.payload_examples.some(example => example.title.includes(type)), type);
    }
    const embeddings = endpoints.find(endpoint => endpoint.path === '/v1/embeddings');
    assert.equal(embeddings.payload_examples.length, 5);
    assert.ok(embeddings.payload_examples.some(example => Array.isArray(JSON.parse(example.payload).input)));
    const models = endpoints.find(endpoint => endpoint.path === '/v1/models');
    assert.equal(models.method, 'GET');
    assert.equal(models.request_payload, undefined);
});

test('malformed, duplicate or mismatched metadata is rejected, not silently published', () => {
    const header = '---\nmethod: "test.read"\ntransport: "POST /v1/cep"\ncategory: "system"\nsummary: "Read"\nparams: []\n';
    assert.throws(() => readPage(header + 'method: "other"\n---\n# Read\n', 'duplicate.md'), /unique|Map keys/i);
    assert.throws(() => readPage(header + 'request_payload: \'{"jsonrpc":"2.0","method":"wrong","params":{}}\'\n---\n# Read\n', 'wrong.md'), /does not match/);
    assert.throws(() => readPage(header + 'request_payload: "invalid json"\n---\n# Read\n', 'invalid.md'));
    assert.equal(readPage('# An overview\n', 'overview.md'), null);
});

test('every CEP method reaches the App with a detailed reference, diagram and both client languages', async () => {
    const catalog = await buildCatalog();
    for (const endpoint of catalog.flatMap(group => group.endpoints).filter(endpoint => endpoint.transport_path)) {
        const body = endpoint.docs_content;
        for (const heading of ['How it works','Parameters, defaults and value effects','Request examples',
            'Response and field meanings','Errors and recovery','Limits, state and related operations','Implementation reference']) {
            assert.ok(body.includes('## '+heading), `${endpoint.path}: ${heading}`);
        }
        assert.match(body, /```mermaid\r?\n/, endpoint.path+' diagram');
        assert.ok(endpoint.examples.some(example => example.language==='python'), endpoint.path+' Python');
        assert.ok(endpoint.examples.some(example => example.language==='javascript'), endpoint.path+' JavaScript');
        assert.ok(endpoint.payload_examples.every(example => !JSON.parse(example.payload).params.__unknown_option),
            endpoint.path+' deliberately invalid requests must not become valid input choices');
    }
});

test('response objects and foreign CEP calls never become selectable requests', () => {
    const page = { isCep: true, header: { method:'test.read', params:[{name:'path',req:true}] },
        request:{jsonrpc:'2.0',id:1,method:'test.read',params:{path:'default'}},
        body:'## Another input\n```json\n{"path":"file"}\n```\n## Response\n```json\n{"status":"ok"}\n```\n```json\n{"jsonrpc":"2.0","id":2,"method":"tasks.result","params":{}}\n```' };
    const examples = examplesFromBody(page);
    assert.equal(examples.length, 2);
    assert.equal(JSON.parse(examples[1].payload).params.path, 'file');
});

test('check mode detects stale generated output and does not rewrite it', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cluaiz-api-docs-'));
    const output = join(directory, 'catalog.json');
    try {
        await syncApiDocs({output});
        await syncApiDocs({output,check:true});
        await writeFile(output, 'stale\n');
        await assert.rejects(syncApiDocs({output,check:true}), /stale/);
        assert.equal(await readFile(output,'utf8'), 'stale\n');
    } finally {
        await unlink(output).catch(() => {});
        await rmdir(directory);
    }
});

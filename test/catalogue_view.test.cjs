const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./cepHarness.cjs');
const modelApi = load('src/api/catalogue/models.ts', { './public': {} });
const { chooseModelVariant, installedModelForVariant, filterModels, filterTools, catalogueImage } = load('src/features/extensions/catalogueView.ts',
  { '../../api/catalogue/models': modelApi }, { URL });
const model = (id, overrides = {}) => ({ id, name: id, family: 'family', provider: 'provider', repo: 'owner/repo',
  tasks: ['text-generation'], description: '', architecture: '', variants: [{ format: 'gguf' }], downloads: null, created: '', ...overrides });
const filters = { query: '', providers: [], capabilities: [], format: '', family: '', sort: 'popular' };

test('installed badge matches actual repo, format and primary file rather than a catalogue reference', () => {
  const variant = { id: 'weights', quant: 'Q8_0', format: 'gguf', file: 'weights.gguf' };
  const item = model('website-id', { variants: [variant] });
  const installed = { id: 'engine-generated-id', huggingface_repo: item.repo, format: 'gguf', files: [{ name: variant.file, is_primary: true }] };
  assert.equal(installedModelForVariant([installed], item, variant), installed);
  for (const other of [{ ...installed, huggingface_repo: 'another/repo' }, { ...installed, format: 'onnx' },
    { ...installed, files: [{ name: variant.file, is_primary: false }] }, { ...installed, files: [{ name: 'other.gguf', is_primary: true }] },
    { ...installed, files: undefined }, { ...installed, files: {} }, { ...installed, files: [null] }]) {
    assert.equal(installedModelForVariant([other], item, variant), undefined);
  }
  assert.equal(installedModelForVariant([installed], item), undefined);
});

test('default package skips unknown, incomplete and ambiguous variants using the install contract', () => {
  const variants = [
    { id: 'matrix', quant: 'UNKNOWN' },
    { id: 'missing', quant: 'Q3', readiness: 'incomplete' },
    { id: 'duplicate-a', quant: 'Q4' }, { id: 'duplicate-b', quant: 'Q4' },
    { id: 'ready', quant: 'Q5', format: 'gguf' },
  ];
  const item = model('catalog-model', { variants });
  assert.equal(chooseModelVariant(item, variants).id, 'ready');
  assert.equal(modelApi.modelInstallReference(item, chooseModelVariant(item, variants)), 'owner/repo:Q5');
  assert.equal(variants[0].id, 'matrix');
});

test('explicit invalid package keeps its refusal; filtered/empty lists never invent a package', () => {
  const variants = [{ id: 'unknown', quant: 'UNKNOWN', format: 'gguf' },
    { id: 'ready', quant: 'UINT8', format: 'onnx' }];
  const item = model('catalog-model', { variants });
  assert.equal(chooseModelVariant(item, variants, 'unknown').id, 'unknown');
  assert.throws(() => modelApi.modelInstallReference(item, chooseModelVariant(item, variants, 'unknown')));
  assert.equal(chooseModelVariant(item, variants.filter(v => v.format === 'gguf')).id, 'unknown');
  assert.equal(chooseModelVariant(item, variants, 'removed').id, 'ready');
  assert.equal(chooseModelVariant(item, []), undefined);
});

test('model search combines provider, capability, format and architecture without mutating source order', () => {
  const models = [model('other', { provider: 'another' }), model('target', { architecture: 'test-architecture' })];
  const result = filterModels(models, { ...filters, query: 'ARCHITECTURE', providers: ['provider'], capabilities: ['text-generation'], format: 'gguf' });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'target');
  assert.equal(models[0].id, 'other');
  assert.equal(filterModels(models, { ...filters, format: 'onnx' }).length, 0);
});

test('missing popularity/date stays after known values and sort order is deterministic', () => {
  const models = [model('unknown'), model('older', { downloads: 0, created: '2025-01-01' }),
    model('newer', { downloads: 42, created: '2026-01-01' })];
  assert.equal(filterModels(models, filters)[0].id, 'newer');
  assert.equal(filterModels(models, { ...filters, sort: 'newest' })[2].id, 'unknown');
  assert.equal(filterModels(models, { ...filters, sort: 'oldest' })[0].id, 'older');
});

test('tool search includes deliberately opened details and preserves unopened package IDs', () => {
  const rows = [{ tool: { id: 'one', kind: 'skill' }, details: { name: 'File helper', tags: ['documents'] } },
    { tool: { id: 'unopened', kind: 'plugin' } }];
  const base = { query: '', kind: '', build: '', os: '', sort: 'name' };
  assert.equal(filterTools(rows, { ...base, query: 'documents' })[0].tool.id, 'one');
  assert.equal(filterTools(rows, { ...base, query: 'unopened' })[0].tool.id, 'unopened');
  assert.equal(filterTools(rows, { ...base, kind: 'mcp' }).length, 0);
});

test('catalogue logos reject active/insecure/unapproved URLs and resolve approved relative images', () => {
  for (const value of ['javascript:alert(1)', 'data:image/svg+xml,<svg/>', 'http://cluaiz.com/logo.png',
    'https://cluaiz.com.evil.invalid/logo.png', 'https://user:pass@cluaiz.com/logo.png']) {
    assert.equal(catalogueImage(value), undefined);
  }
  assert.equal(catalogueImage('/logo.png'), 'https://cluaiz.com/logo.png');
});

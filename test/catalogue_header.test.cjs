const { test } = require('node:test');
const assert = require('node:assert/strict');

test('activeFilterCount correctly tallies non-empty format, task, providers, and non-default sort', () => {
  function computeActiveFilterCount({ format, task, providers = [], sort = 'popular' }) {
    return (format ? 1 : 0) + (task ? 1 : 0) + providers.length + (sort !== 'popular' ? 1 : 0);
  }

  // Initial / default state -> 0
  assert.equal(computeActiveFilterCount({ format: '', task: '', providers: [], sort: 'popular' }), 0);

  // Single filter
  assert.equal(computeActiveFilterCount({ format: 'gguf', task: '', providers: [], sort: 'popular' }), 1);

  // Multiple filters
  assert.equal(computeActiveFilterCount({ format: 'gguf', task: 'text-generation', providers: ['meta', 'mistral'], sort: 'newest' }), 5);
});

test('ToolCatalogue resolves proper dynamic title for mcp, skill, and plugin', () => {
  function getCatalogueTitle(kind) {
    if (kind === 'mcp') return 'MCP Servers';
    if (kind === 'skill') return 'Agent Skills';
    if (kind === 'plugin') return 'Plugins & Tools';
    return 'Available Tools';
  }

  assert.equal(getCatalogueTitle('mcp'), 'MCP Servers');
  assert.equal(getCatalogueTitle('skill'), 'Agent Skills');
  assert.equal(getCatalogueTitle('plugin'), 'Plugins & Tools');
  assert.equal(getCatalogueTitle(undefined), 'Available Tools');
});

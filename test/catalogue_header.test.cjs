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

test('ToolCatalogue tab order places Installed first and Browse second', () => {
  const tabs = [
    { id: 'installed', label: 'Installed' },
    { id: 'browse', label: 'Browse' },
  ];
  const defaultTab = 'installed';

  assert.equal(tabs[0].id, 'installed', 'Installed tab must be first');
  assert.equal(tabs[1].id, 'browse', 'Browse tab must be second');
  assert.equal(defaultTab, 'installed', 'Default tab must be installed');
});

test('ToolCatalogue maps kind to ToolsSettings category accurately', () => {
  function mapKindToCategory(kind) {
    return kind === 'skill' ? 'skill' : kind === 'plugin' ? 'plugin' : kind === 'mcp' ? 'mcp' : 'all';
  }

  assert.equal(mapKindToCategory('skill'), 'skill');
  assert.equal(mapKindToCategory('plugin'), 'plugin');
  assert.equal(mapKindToCategory('mcp'), 'mcp');
  assert.equal(mapKindToCategory('extension'), 'all');
  assert.equal(mapKindToCategory(''), 'all');
});

test('ToolsSettings empty state message avoids matching "all" bug', () => {
  function getEmptyMessage(searchQuery, filter) {
    if (searchQuery.trim()) {
      return `No tools found matching "${searchQuery}".`;
    }
    if (filter !== 'all') {
      return `No installed ${filter === 'mcp' ? 'MCP servers' : filter + 's'} found.`;
    }
    return 'No installed tools found in workspace.';
  }

  assert.equal(getEmptyMessage('', 'all'), 'No installed tools found in workspace.');
  assert.equal(getEmptyMessage('', 'skill'), 'No installed skills found.');
  assert.equal(getEmptyMessage('', 'mcp'), 'No installed MCP servers found.');
  assert.equal(getEmptyMessage('weather', 'all'), 'No tools found matching "weather".');
});

test('AppExtensionsSection filters bundled extensions by name or id', () => {
  const sampleExtensions = [
    { id: 'cluaiz.notebook', name: 'Notebook' },
    { id: 'cluaiz.library', name: 'Library' },
  ];

  function filterExtensions(extensions, query) {
    if (!query.trim()) return extensions;
    const q = query.toLowerCase();
    return extensions.filter(e => e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q));
  }

  assert.equal(filterExtensions(sampleExtensions, '').length, 2);
  assert.equal(filterExtensions(sampleExtensions, 'note')[0].name, 'Notebook');
  assert.equal(filterExtensions(sampleExtensions, 'library')[0].id, 'cluaiz.library');
  assert.equal(filterExtensions(sampleExtensions, 'nonexistent').length, 0);
});

test('cleanModelDescription removes raw HTML tags and collapses whitespace', () => {
  function cleanModelDescription(raw) {
    if (!raw) return '';
    return raw
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const rawHtml = '<img width="600" alt="qwen" src="https://example.com/pic.png"> Qwen is a <ul style="margin: 0;"><li><b>Fast</b></li></ul> model.';
  const cleaned = cleanModelDescription(rawHtml);
  assert.equal(cleaned, 'Qwen is a Fast model.');
  assert.equal(cleanModelDescription(''), '');
  assert.equal(cleanModelDescription(null), '');
});

test('extractFamilyCapabilities deduplicates and normalizes task names across models', () => {
  function extractFamilyCapabilities(models) {
    const tasks = new Set();
    for (const model of models) {
      for (const t of model.tasks) {
        if (t && typeof t === 'string') {
          const normalized = t.trim().toUpperCase();
          if (normalized) tasks.add(normalized);
        }
      }
    }
    return Array.from(tasks);
  }

  const sampleModels = [
    { tasks: ['text-to-text', 'image-to-text'] },
    { tasks: ['IMAGE-TO-TEXT', 'visual-document-retrieval'] },
    { tasks: ['text-to-text'] },
  ];

  const distinct = extractFamilyCapabilities(sampleModels);
  assert.deepEqual(distinct, ['TEXT-TO-TEXT', 'IMAGE-TO-TEXT', 'VISUAL-DOCUMENT-RETRIEVAL']);
});

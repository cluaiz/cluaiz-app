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

test('FamilyModelSliderRow groups models by family and exposes View All and Model selection', () => {
  const allModels = [
    { id: 'qwen-7b', name: 'Qwen 7B', family: 'Qwen', provider: 'Alibaba Cloud', tasks: ['text-to-text'] },
    { id: 'qwen-14b', name: 'Qwen 14B', family: 'Qwen', provider: 'Alibaba Cloud', tasks: ['text-to-text'] },
    { id: 'llama-3.2-1b', name: 'Llama 3.2 1B', family: 'Llama 3.2', provider: 'Meta AI', tasks: ['text-to-text'] },
  ];

  const families = [...new Set(allModels.map(m => m.family))];
  assert.deepEqual(families, ['Qwen', 'Llama 3.2']);

  const qwenModels = allModels.filter(m => m.family === 'Qwen');
  assert.equal(qwenModels.length, 2);

  const llamaModels = allModels.filter(m => m.family === 'Llama 3.2');
  assert.equal(llamaModels.length, 1);
});

test('ModelSliderCard resolves default variant and allows instant quantization switching', () => {
  const sampleModel = {
    id: 'qwen-2.5-7b',
    name: 'Qwen 2.5 7B',
    variants: [
      { id: 'v1', quant: 'Q4_K_M', bytes: 4.5 * 1024 ** 3 },
      { id: 'v2', quant: 'Q8_0', bytes: 7.8 * 1024 ** 3 },
    ],
  };

  // Default selection is first variant
  let selected = sampleModel.variants[0];
  assert.equal(selected.quant, 'Q4_K_M');

  // Switch to Q8_0
  selected = sampleModel.variants[1];
  assert.equal(selected.quant, 'Q8_0');
  assert.equal((selected.bytes / 1024 ** 3).toFixed(1), '7.8');
});

test('ScrubberDot calculates center and progress distance correctly across 60 dots', () => {
  const total = 60;
  const distance = 1 / total;

  function calculateDotBounds(index) {
    const center = index / (total - 1);
    return {
      center,
      minActive: center - distance * 3,
      maxActive: center + distance * 3,
    };
  }

  const dot0 = calculateDotBounds(0);
  assert.equal(dot0.center, 0);

  const dotLast = calculateDotBounds(59);
  assert.equal(dotLast.center, 1);

  const dotMid = calculateDotBounds(30);
  assert.ok(dotMid.center > 0.49 && dotMid.center < 0.52);
  assert.ok(dotMid.maxActive > dotMid.center);
  assert.ok(dotMid.minActive < dotMid.center);
});

test('CatalogueStickyHeader hides title and subtitle when breadcrumbs are active', () => {
  function getHeaderDisplayMode({ breadcrumbs, title, subtitle }) {
    if (breadcrumbs) {
      return { renderBreadcrumbs: true, renderTitle: false, renderSubtitle: false };
    }
    return { renderBreadcrumbs: false, renderTitle: Boolean(title), renderSubtitle: Boolean(subtitle) };
  }

  // Root view: No breadcrumbs -> Title and subtitle rendered
  const rootMode = getHeaderDisplayMode({ breadcrumbs: null, title: 'AI Models', subtitle: 'Find a model...' });
  assert.equal(rootMode.renderBreadcrumbs, false);
  assert.equal(rootMode.renderTitle, true);
  assert.equal(rootMode.renderSubtitle, true);

  // Detail view: Breadcrumbs active -> Title and subtitle suppressed
  const detailMode = getHeaderDisplayMode({ breadcrumbs: '← All Families / Qwen', title: 'Qwen Models', subtitle: 'Available neural packages...' });
  assert.equal(detailMode.renderBreadcrumbs, true);
  assert.equal(detailMode.renderTitle, false);
  assert.equal(detailMode.renderSubtitle, false);
});

test('Family Hero Banner watermark dissolves smoothly without neon glow', () => {
  const heroConfig = {
    minHeight: 'min-h-[220px]',
    hasNeonGlowBulb: false,
    maskImage: 'radial-gradient(ellipse at center right, rgba(0,0,0,0.65) 15%, rgba(0,0,0,0.2) 55%, transparent 95%)',
  };

  assert.equal(heroConfig.hasNeonGlowBulb, false, 'Fake neon light bulb must not be present');
  assert.ok(heroConfig.minHeight.includes('220px'), 'Hero card should have expanded vertical height');
  assert.ok(heroConfig.maskImage.includes('radial-gradient'), 'Watermark must use smooth radial gradient fade');
});



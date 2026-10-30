const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./cepHarness.cjs');

const { toolkitSection, TOOLKIT_SECTIONS, toolkitSectionUrl } = load(
  'src/features/extensions/toolkitNavigation.ts',
  {},
  { URLSearchParams, URL },
);

test('toolkitSection defaults to models when section parameter is absent or unknown', () => {
  assert.equal(toolkitSection(''), 'models');
  assert.equal(toolkitSection('?'), 'models');
  assert.equal(toolkitSection('?section='), 'models');
  assert.equal(toolkitSection('?section=unknown_value'), 'models');
  assert.equal(toolkitSection('?other=1'), 'models');
});

test('toolkitSection accurately parses specific category routes for 1-click drill down', () => {
  assert.equal(toolkitSection('?section=models'), 'models');
  assert.equal(toolkitSection('?section=mcp'), 'mcp');
  assert.equal(toolkitSection('?section=skills'), 'skills');
  assert.equal(toolkitSection('?section=plugins'), 'plugins');
  assert.equal(toolkitSection('?section=extensions'), 'extensions');
  assert.equal(toolkitSection('?section=components'), 'components');
});

test('TOOLKIT_SECTIONS defines all 6 dedicated categories without landing hub', () => {
  const ids = Array.from(TOOLKIT_SECTIONS).map(s => s.id);
  assert.equal(ids.join(','), 'models,mcp,skills,plugins,extensions,components');
});

test('toolkitSectionUrl formats specific category URLs cleanly', () => {
  assert.equal(toolkitSectionUrl('models'), '/toolkit?section=models');
  assert.equal(toolkitSectionUrl('mcp'), '/toolkit?section=mcp');
  assert.equal(toolkitSectionUrl('skills'), '/toolkit?section=skills');
  assert.equal(toolkitSectionUrl('plugins'), '/toolkit?section=plugins');
  assert.equal(toolkitSectionUrl('extensions'), '/toolkit?section=extensions');
  assert.equal(toolkitSectionUrl('components'), '/toolkit?section=components');
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./cepHarness.cjs');

const { toolkitSection, TOOLKIT_SECTIONS, toolkitSectionUrl } = load(
  'src/features/extensions/toolkitNavigation.ts',
  {},
  { URLSearchParams, URL },
);

test('toolkitSection defaults to landing Hub when section parameter is absent or unknown', () => {
  assert.equal(toolkitSection(''), 'landing');
  assert.equal(toolkitSection('?'), 'landing');
  assert.equal(toolkitSection('?section='), 'landing');
  assert.equal(toolkitSection('?section=unknown_value'), 'landing');
  assert.equal(toolkitSection('?other=1'), 'landing');
});

test('toolkitSection accurately parses specific category routes for 1-click drill down', () => {
  assert.equal(toolkitSection('?section=models'), 'models');
  assert.equal(toolkitSection('?section=tools'), 'tools');
  assert.equal(toolkitSection('?section=extensions'), 'extensions');
  assert.equal(toolkitSection('?section=components'), 'components');
  assert.equal(toolkitSection('?section=landing'), 'landing');
});

test('TOOLKIT_SECTIONS defines all 5 core unified hub categories', () => {
  const ids = Array.from(TOOLKIT_SECTIONS).map(s => s.id);
  assert.equal(ids.join(','), 'landing,models,tools,extensions,components');
});

test('toolkitSectionUrl formats hub root and specific category URLs cleanly', () => {
  assert.equal(toolkitSectionUrl('landing'), '/toolkit');
  assert.equal(toolkitSectionUrl('models'), '/toolkit?section=models');
  assert.equal(toolkitSectionUrl('tools'), '/toolkit?section=tools');
  assert.equal(toolkitSectionUrl('extensions'), '/toolkit?section=extensions');
  assert.equal(toolkitSectionUrl('components'), '/toolkit?section=components');
});

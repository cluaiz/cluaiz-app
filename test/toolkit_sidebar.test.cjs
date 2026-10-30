const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./cepHarness.cjs');

const { toolkitSection, TOOLKIT_SECTIONS, toolkitSectionUrl } = load(
  'src/features/extensions/toolkitNavigation.ts',
  {},
  { URLSearchParams, URL },
);

test('toolkitSection accurately resolves landing hub and deep categories without tabs', () => {
  assert.equal(toolkitSection(''), 'landing');
  assert.equal(toolkitSection('?section=models'), 'models');
  assert.equal(toolkitSection('?section=tools'), 'tools');
  assert.equal(toolkitSection('?section=extensions'), 'extensions');
  assert.equal(toolkitSection('?section=components'), 'components');
});

test('toolkitSectionUrl produces clean routes for sidebar 1-click drill down', () => {
  assert.equal(toolkitSectionUrl('landing'), '/toolkit');
  assert.equal(toolkitSectionUrl('models'), '/toolkit?section=models');
  assert.equal(toolkitSectionUrl('tools'), '/toolkit?section=tools');
  assert.equal(toolkitSectionUrl('extensions'), '/toolkit?section=extensions');
  assert.equal(toolkitSectionUrl('components'), '/toolkit?section=components');
});

test('TOOLKIT_SECTIONS has 5 core sections covering models, tools, extensions, and components', () => {
  const sections = Array.from(TOOLKIT_SECTIONS);
  assert.equal(sections.length, 5);
  assert.equal(sections[0].id, 'landing');
  assert.equal(sections[1].id, 'models');
  assert.equal(sections[2].id, 'tools');
  assert.equal(sections[3].id, 'extensions');
  assert.equal(sections[4].id, 'components');
});

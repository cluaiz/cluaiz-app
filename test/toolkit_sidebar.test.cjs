const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./cepHarness.cjs');

const { toolkitSection, TOOLKIT_SECTIONS, toolkitSectionUrl } = load(
  'src/features/extensions/toolkitNavigation.ts',
  {},
  { URLSearchParams, URL },
);

test('toolkitSection accurately resolves deep categories and defaults to models without hub', () => {
  assert.equal(toolkitSection(''), 'models');
  assert.equal(toolkitSection('?section=models'), 'models');
  assert.equal(toolkitSection('?section=mcp'), 'mcp');
  assert.equal(toolkitSection('?section=skills'), 'skills');
  assert.equal(toolkitSection('?section=plugins'), 'plugins');
  assert.equal(toolkitSection('?section=extensions'), 'extensions');
  assert.equal(toolkitSection('?section=components'), 'components');
});

test('toolkitSectionUrl produces clean routes for sidebar 1-click drill down', () => {
  assert.equal(toolkitSectionUrl('models'), '/toolkit?section=models');
  assert.equal(toolkitSectionUrl('mcp'), '/toolkit?section=mcp');
  assert.equal(toolkitSectionUrl('skills'), '/toolkit?section=skills');
  assert.equal(toolkitSectionUrl('plugins'), '/toolkit?section=plugins');
  assert.equal(toolkitSectionUrl('extensions'), '/toolkit?section=extensions');
  assert.equal(toolkitSectionUrl('components'), '/toolkit?section=components');
});

test('TOOLKIT_SECTIONS has 6 dedicated sections without landing hub', () => {
  const sections = Array.from(TOOLKIT_SECTIONS);
  assert.equal(sections.length, 6);
  assert.equal(sections[0].id, 'models');
  assert.equal(sections[1].id, 'mcp');
  assert.equal(sections[2].id, 'skills');
  assert.equal(sections[3].id, 'plugins');
  assert.equal(sections[4].id, 'extensions');
  assert.equal(sections[5].id, 'components');
});

test('dock search tooltip accurately reflects activeView and retains text on hover', () => {
  function getSearchTooltip(activeView) {
    if (activeView === 'apis') return 'Search Endpoints';
    if (activeView === 'toolkit') return 'Search Toolkit';
    return 'Search & Chats';
  }

  assert.equal(getSearchTooltip('chat'), 'Search & Chats');
  assert.equal(getSearchTooltip('apis'), 'Search Endpoints');
  assert.equal(getSearchTooltip('toolkit'), 'Search Toolkit');
});

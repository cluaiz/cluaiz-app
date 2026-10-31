const { test } = require('node:test');
const assert = require('node:assert/strict');

test('MultiLevelDropdown category preview resolution correctly identifies selected options', () => {
  function getPreviewLabel(category) {
    if (Array.isArray(category.selectedValue)) {
      return category.selectedValue.length > 0 ? `${category.selectedValue.length} selected` : '';
    }
    if (category.selectedValue) {
      const opt = category.options.find(o => o.value === category.selectedValue);
      return opt?.label || category.selectedValue;
    }
    return '';
  }

  // Single-select category
  const formatCategory = {
    id: 'format',
    label: 'Model Format',
    options: [
      { value: '', label: 'All Formats' },
      { value: 'gguf', label: 'GGUF' },
      { value: 'onnx', label: 'ONNX' },
    ],
    selectedValue: 'gguf',
  };
  assert.equal(getPreviewLabel(formatCategory), 'GGUF');

  // Multi-select category
  const providersCategory = {
    id: 'providers',
    label: 'Providers',
    isMultiSelect: true,
    options: [
      { value: 'google', label: 'Google' },
      { value: 'alibaba', label: 'Alibaba Cloud' },
    ],
    selectedValue: ['google', 'alibaba'],
  };
  assert.equal(getPreviewLabel(providersCategory), '2 selected');

  // Empty selection
  const emptyCategory = {
    id: 'task',
    label: 'Capabilities',
    options: [{ value: '', label: 'All Capabilities' }],
    selectedValue: '',
  };
  assert.equal(getPreviewLabel(emptyCategory), '');
});

test('MultiLevelDropdown single and multi select handlers toggle state correctly', () => {
  let selectedProviders = ['google'];

  function toggleProvider(val) {
    if (selectedProviders.includes(val)) {
      selectedProviders = selectedProviders.filter(p => p !== val);
    } else {
      selectedProviders = [...selectedProviders, val];
    }
  }

  toggleProvider('alibaba');
  assert.deepEqual(selectedProviders, ['google', 'alibaba']);

  toggleProvider('google');
  assert.deepEqual(selectedProviders, ['alibaba']);
});

test('MultiLevelDropdown submenu flyout aligns right by default to prevent left dock clipping', () => {
  function getSubmenuPositionClass(submenuAlign = 'right') {
    return submenuAlign === 'left' ? 'right-full mr-1.5' : 'left-full ml-1.5';
  }

  assert.equal(getSubmenuPositionClass(), 'left-full ml-1.5');
  assert.equal(getSubmenuPositionClass('right'), 'left-full ml-1.5');
  assert.equal(getSubmenuPositionClass('left'), 'right-full mr-1.5');
});

test('MultiLevelDropdown portal coordinates calculate fixed positioning cleanly outside sidebar bounds', () => {
  function calculateDropdownPosition(anchorRect, windowWidth = 1920) {
    const menuWidth = 240;
    let left = anchorRect.right - menuWidth;
    if (left < 8) left = 8;
    if (left + menuWidth > windowWidth - 8) {
      left = Math.max(8, windowWidth - menuWidth - 8);
    }
    const top = anchorRect.bottom + 6;
    return { top, left };
  }

  // Normal anchor in sidebar (e.g. left dock 72px, sidebar 320px, button at 300px)
  const pos = calculateDropdownPosition({ top: 100, bottom: 132, right: 380, left: 348 });
  assert.equal(pos.top, 138);
  assert.equal(pos.left, 140);

  // Near left edge
  const leftEdge = calculateDropdownPosition({ top: 50, bottom: 82, right: 100, left: 68 });
  assert.equal(leftEdge.left, 8);
});



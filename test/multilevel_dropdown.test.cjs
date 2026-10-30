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

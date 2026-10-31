const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./cepHarness.cjs');
const api = load('src/api/catalogue/models.ts', { './public': {} });
const view = load('src/features/extensions/catalogueView.ts', { '../../api/catalogue/models': api }, { URL });
const jsx = (type, props) => ({ type, props });
const shared = {
  react: { useState: initial => [initial, () => {}] },
  'react/jsx-runtime': { jsx, jsxs: jsx },
  'lucide-react': { Check: 'Check', CheckCircle2: 'Installed', Copy: 'Copy', Download: 'Download' },
  '../../api/catalogue/models': api,
  '../../components/ui/Button': { Button: 'SharedButton' },
  '../../components/ui/Badge': { Badge: 'SharedBadge' },
  '../../components/ui/Card': { Card: 'SharedCard', CardContent: 'CardContent', CardHeader: 'CardHeader', CardTitle: 'CardTitle' },
  './catalogueView': view,
};
const { ModelPackagePanel } = load('src/features/extensions/ModelPackagePanel.tsx', shared);
const { ModelSliderCard } = load('src/features/extensions/ModelSliderCard.tsx', {
  ...shared, './CatalogueUI': { CatalogueLogo: 'Logo' },
});
const variants = [
  { id: 'small', quant: 'Q4_K_M', format: 'gguf', bytes: 1024 ** 3, file: 'small.gguf', readiness: 'ready' },
  { id: 'large', quant: 'Q8_0', format: 'gguf', bytes: 2 * 1024 ** 3, file: 'large.gguf', readiness: 'ready' },
];
const model = { id: 'catalogue-model', name: 'Example', repo: 'owner/repo', family: 'Family', tasks: [], variants };
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
const text = tree => Array.isArray(tree) ? tree.map(text).join('')
  : tree && typeof tree === 'object' ? text(tree.props?.children) : String(tree ?? '');
function panel(overrides = {}) {
  const requests = [], selections = [];
  const props = { model, installed: [], source: 'catalogue', canStart: true, inventoryReady: true, hardware: null,
    onSelectVariant: id => selections.push(id), onInstall: async (...args) => { requests.push(args); }, ...overrides };
  const tree = ModelPackagePanel(props);
  return { tree, items: nodes(tree), requests, selections };
}

test('one selected package drives command, size and the exact existing install callback', async () => {
  const p = panel({ selectedVariantId: 'large' });
  const choices = p.items.filter(item => item.props?.['aria-pressed'] !== undefined);
  assert.equal(choices.length, 2);
  assert.deepEqual(choices.map(item => item.props['aria-pressed']), [false, true]);
  assert.ok(choices.every(item => item.type === 'SharedButton'));
  assert.match(text(p.tree), /cluaiz run catalogue-model:Q8_0/);
  const download = p.items.find(item => item.type === 'SharedButton' && text(item).includes('Download package'));
  assert.match(text(download), /2.00 GiB/);
  await download.props.onClick();
  assert.equal(p.requests[0][0], model);
  assert.equal(p.requests[0][1], variants[1]);
  choices[0].props.onClick();
  assert.deepEqual(p.selections, ['small']);
});

test('ambiguous packages show the existing refusal and cannot dispatch an invented file target', () => {
  const duplicate = { ...variants[0], id: 'other-file', file: 'other.gguf' };
  const p = panel({ model: { ...model, variants: [...variants, duplicate] }, selectedVariantId: 'small' });
  assert.ok(p.items.some(item => item.props?.role === 'alert' && /Multiple packages/.test(text(item))));
  const download = p.items.find(item => item.type === 'SharedButton' && text(item).includes('Download package'));
  assert.equal(download.props.disabled, true);
  assert.doesNotMatch(text(p.tree), /cluaiz run/);
});

test('offline inventory and an already tracked task disable duplicate starts', () => {
  for (const overrides of [{ inventoryReady: false }, { canStart: false }]) {
    const p = panel(overrides);
    const download = p.items.find(item => item.type === 'SharedButton' && text(item).includes('Download package'));
    assert.equal(download.props.disabled, true);
    assert.equal(p.requests.length, 0);
  }
});

test('model cards contain package summaries and no second independent quantization picker', () => {
  const tree = ModelSliderCard({ model, installed: [], isBusy: false, onSelectModel() {} });
  assert.equal(tree.type, 'SharedCard');
  assert.match(text(tree), /2 packages/);
  assert.doesNotMatch(text(tree), /Q4_K_M|Q8_0/);
  assert.equal(nodes(tree).filter(item => item.props?.['aria-pressed'] !== undefined).length, 1);
});

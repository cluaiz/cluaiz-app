const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./cepHarness.cjs');
const api = load('src/api/catalogue/models.ts', { './public': {} });
const view = load('src/features/extensions/catalogueView.ts', { '../../api/catalogue/models': api }, { URL });
const jsx = (type, props) => ({ type, props });
let running = null, paused = {};
const shared = {
  react: { useState: initial => [initial, () => {}], useCallback: fn => fn },
  'react/jsx-runtime': { jsx, jsxs: jsx },
  'lucide-react': { Check: 'Check', CheckCircle2: 'Installed', Copy: 'Copy', Download: 'Download', FileText: 'FileText', Loader2: 'Loader', Trash2: 'Trash', Pause: 'Pause', Play: 'Play', X: 'X' },
  '../../components/HoldButton/HoldButton': { HoldButton: 'HoldButton' },
  '../../components/HoldButton/dangerHold': { DANGER_HOLD: {} },
  './modelDownloadStore': { useModelDownloadStore: select => select({ download: running, paused }), useRepoDownload: () => null },
  '../../components/ui/dropdown': { CustomDropdown: 'Quantization' },
  '../../components/ui/MarkdownRenderer': { MarkdownRenderer: 'Markdown', parseMarkdownWithFrontmatter: text => ({ cleanBody: text }) },
  './useCatalogue': { useCatalogue: () => ({ busy: false, reply: { data: '' } }) },
  '../../api/catalogue/models': api,
  '../../components/ui/Button': { Button: 'SharedButton' },
  '../../components/ui/Badge': { Badge: 'SharedBadge' },
  '../../components/ui/Card': { Card: 'SharedCard', CardContent: 'CardContent', CardHeader: 'CardHeader', CardTitle: 'CardTitle' },
  './catalogueView': view,
  './CatalogueUI': { CatalogueLogo: 'Logo', SpecList: 'SpecList' },
};
const { ModelPackagePanel } = load('src/features/extensions/ModelPackagePanel.tsx', shared);
const { ModelSliderCard } = load('src/features/extensions/ModelSliderCard.tsx', {
  ...shared,
});
const variants = [
  { id: 'small', quant: 'Q4_K_M', format: 'gguf', bytes: 1024 ** 3, file: 'Example-Q4_K_M.gguf', readiness: 'ready' },
  { id: 'large', quant: 'Q8_0', format: 'gguf', bytes: 2 * 1024 ** 3, file: 'Example-Q8_0.gguf', readiness: 'ready' },
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
  const props = { model, installed: [], onUninstall: async () => {}, canStart: true, inventoryReady: true, hardware: null,
    onSelectVariant: id => selections.push(id), onInstall: async (...args) => { requests.push(args); }, ...overrides };
  const tree = ModelPackagePanel(props);
  return { tree, items: nodes(tree), requests, selections };
}

const quantization = items => items.find(item => item.type === 'Quantization');

test('one selected package drives command, size and the exact existing install callback', async () => {
  const p = panel({ selectedVariantId: 'large' });
  const picker = quantization(p.items);
  assert.deepEqual(picker.props.options.map(option => option.label), ['Q4_K_M', 'Q8_0'], 'quantizations only, no file names');
  assert.equal(picker.props.value, 'large');
  assert.match(text(p.tree), /2.00 GiB/);
  assert.match(text(p.tree), /cluaiz run owner\/repo:Q8_0/);
  const download = p.items.find(item => item.type === 'SharedButton' && text(item).includes('Download package'));
  await download.props.onClick();
  assert.equal(p.requests[0][0], model);
  assert.equal(p.requests[0][1], variants[1]);
  picker.props.onChange('small');
  assert.deepEqual(p.selections, ['small']);
});

test('ambiguous packages show the existing refusal and cannot dispatch an invented file target', () => {
  const duplicate = { ...variants[0], id: 'same-file' };
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
  const card = ModelSliderCard({ model, installed: [], isBusy: false, onSelectModel() {} });
  const tree = card.type(card.props);
  assert.equal(tree.type, 'SharedCard');
  assert.match(text(tree), /2 packages/);
  assert.doesNotMatch(text(tree), /Q4_K_M|Q8_0/);
  assert.equal(nodes(tree).filter(item => item.props?.['aria-pressed'] !== undefined).length, 1);
});

test('the package being downloaded shows its progress in the button, and other downloads wait', () => {
  running = { target: 'owner/repo:Q8_0', percent: 63 };
  const p = panel({ selectedVariantId: 'large' });
  const busy = p.items.find(item => typeof item.type === 'function' && item.props.percent === 63);
  assert.match(text(busy.type(busy.props)), /Downloading · 63%/);
  assert.ok(!p.items.some(item => item.type === 'SharedButton' && text(item).includes('Download package')));
  const other = panel({ selectedVariantId: 'small' });
  assert.equal(other.items.find(item => item.type === 'SharedButton' && text(item).includes('Download package')).props.disabled, true);
  running = null;
});

test('an installed package offers hold to uninstall instead of Download', async () => {
  const entry = { id: 'engine-id', huggingface_repo: 'owner/repo', format: 'gguf', files: [{ name: 'Example-Q8_0.gguf', is_primary: true }] };
  const removed = [];
  const p = panel({ selectedVariantId: 'large', installed: [entry], onUninstall: async item => { removed.push(item.id); } });
  assert.ok(!p.items.some(item => item.type === 'SharedButton' && text(item).includes('Download package')));
  p.items.find(item => item.type === 'HoldButton').props.onHold();
  assert.deepEqual(removed, ['engine-id']);
});

test('repeated selected quant tags count as one quantization and preserve distinct package paths',()=>{
 const first={...variants[0],file:'folder-a/model-Q4_K_M.gguf'};
 const duplicate={...first,id:'other-folder',file:'folder-b/model-Q4_K_M.gguf'};
 const p=panel({model:{...model,variants:[first,duplicate,variants[1]]},selectedVariantId:first.id});
 assert.match(text(p.tree),/2 quantizations · 3 packages/);
 const options=quantization(p.items).props.options;
 assert.match(options[0].description,/folder-a\/model-Q4_K_M.gguf/);
 assert.match(options[1].description,/folder-b\/model-Q4_K_M.gguf/);
});

test('a paused package offers Resume at its percent: a click continues the same reference, a hold deletes what arrived', async () => {
  paused = { 'owner/repo:Q8_0': 42 };
  const discarded = [];
  const p = panel({ selectedVariantId: 'large', onDiscard: reference => discarded.push(reference) });
  const resume = p.items.find(item => typeof item.type === 'function' && item.props.percent === 42);
  const hold = nodes(resume.type(resume.props)).find(item => item.type === 'HoldButton');
  assert.match(text(hold), /Resume · 42%/);
  hold.props.onTap();
  assert.equal(p.requests[0][1].id, 'large');
  hold.props.onHold();
  assert.deepEqual(discarded, ['owner/repo:Q8_0']);
  paused = {};
});

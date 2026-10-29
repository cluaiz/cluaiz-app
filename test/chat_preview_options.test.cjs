const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./cepHarness.cjs');
const request = load('src/features/chat/utils/chatRequest.ts', {});

test('explicit preview reads live composer tools/settings and releases its reader on unmount', () => {
  const effects = [], target = { current: null };
  let skills = ['first-tool', 'Think Deep'];
  const input = { current: { getSerializedContent: () => ({ skills }) } };
  const { useChatPreviewOptions } = load('src/features/chat/hooks/useChatPreviewOptions.ts', {
    react: { useEffect: effect => effects.push(effect) },
    '../utils/chatRequest': request,
  });
  useChatPreviewOptions(target, input, 'selected-model', 'off', 512);
  const cleanup = effects.pop()();
  const sent = request.chatComposerOptions('selected-model', 'off', 512, skills);
  assert.deepEqual(target.current(), sent);
  skills = ['another-tool'];
  assert.equal(target.current().tools[0].id, 'another-tool');
  cleanup();
  assert.equal(target.current, null);
});

function previewPanel(privateChat = false) {
  const sent = [];
  const jsx = (type, props) => ({ type, props });
  const react = {
    useState: value => [value === 'reports' ? 'preview' : value, () => {}],
    useEffect: () => {}, useId: () => 'preview-test', useRef: () => ({ current: null }),
  };
  const imports = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'lucide-react': { Activity: 'Activity', Cpu: 'Cpu', Play: 'Play', RefreshCw: 'RefreshCw', X: 'X' },
    '../../../components/ui/Dialog': { Dialog: 'Dialog', DialogContent: 'DialogContent', DialogHeader: 'DialogHeader', DialogTitle: 'DialogTitle' },
    '../../../components/ui/Button': { Button: 'Button' },
    '../../../components/ui/Input': { Input: 'Input' },
    '../../../components/ui/Badge': { Badge: 'Badge' },
    '../../../components/ui/AlertBanner': { AlertBanner: 'AlertBanner' },
    '../../../components/ui/dropdown/CustomDropdown': { CustomDropdown: 'CustomDropdown', FLOATING_MENU_ATTR: 'data-floating' },
    '../utils/chatRequest': request,
    '../hooks/useContextDetails': { useContextDetails: () => ({ connection: 'controlled', reportIds: [], runPreview: r => sent.push(r) }) },
  };
  const { ContextDetailsPanel } = load('src/features/chat/components/ContextDetailsPanel.tsx', imports);
  const tree = ContextDetailsPanel({ open: true, onClose: () => {}, chatId: 'chat-a', privateChat,
    messages: [{ sender: 'user', text: 'existing conversation' }],
    getRequestOptions: () => request.chatComposerOptions('selected-model', 'off', 512, ['actual-tool']),
  });
  function find(node) {
    if (Array.isArray(node)) return node.map(find).find(Boolean);
    if (!node || typeof node !== 'object') return;
    if (node.props?.['data-testid'] === 'ctx-run-preview-btn') return node;
    return find(node.props?.children);
  }
  return { sent, button: find(tree) };
}

test('actual Preview button uses saved-chat adaptive policy and current composer settings', () => {
  const { sent, button } = previewPanel();
  assert.ok(button);
  button.props.onClick();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].history_mode, 'adaptive');
  assert.equal(sent[0].model, 'selected-model');
  assert.equal(sent[0].think_mode, 'off');
  assert.equal(sent[0].reasoning_effort, 512);
  assert.equal(sent[0].tools[0].id, 'actual-tool');
  assert.equal(sent[0].messages[0].content, 'existing conversation');
});

test('private chats offer no Preview button and retain the temporary send policy', () => {
  const { sent, button } = previewPanel(true);
  assert.equal(button, undefined);
  assert.equal(sent.length, 0);
  const policy = request.chatHistoryOptions(undefined, true);
  assert.equal(policy.temporary_chat, 'lite');
  assert.equal(policy.history_mode, undefined);
});

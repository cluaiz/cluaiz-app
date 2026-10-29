const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./cepHarness.cjs');

// Exercise the actual hook's state transitions; adapter calls remain controlled.
function setup() {
  const slots = [];
  let cursor = 0;
  const pending = [];
  const react = {
    useRef(value) { const i = cursor++; return slots[i] ?? (slots[i] = { current: value }); },
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }];
    },
    useCallback: fn => fn,
    useEffect: () => {},
  };
  const request = (kind, signal) => new Promise((resolve, reject) => {
    pending.push({ kind, resolve, signal });
    signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  });
  const { useConversationMemory, matchCardsForQuery } = load('src/features/chat/hooks/useConversationMemory.ts', {
    react,
    '../../../api/engine/chat': { chatHistoryApi: {
      search: (_, signal) => request('search', signal),
      getItem: (_, __, signal) => request('item', signal),
    } },
    '../../../api/client/errors': { errorMessage: e => e.message },
    '../../../store/engine/useConnectionStore': {
      useConnectionStore: select => select({ protocol: 'http', getBaseUrl: () => 'http://controlled.invalid' }),
    },
  });
  return {
    pending, matchCardsForQuery,
    render(options = {}) { cursor = 0; return useConversationMemory({ open: true, chatId: 'chat-a', ...options }); },
  };
}

test('opening a source cancels search without leaving Searching or Refresh disabled', async () => {
  const h = setup(), view = h.render();
  const search = view.runSearch({ query: 'term' });
  assert.equal(h.render().searching, true);
  const item = view.inspectItem('m:0');
  assert.equal(h.pending[0].signal.aborted, true);
  h.pending[1].resolve({ ref: 'm:0', text: 'original source' });
  await Promise.all([search, item]);
  const after = h.render();
  assert.equal(after.searching, false);
  assert.equal(after.itemLoading, false);
  assert.equal(after.searchError, null);
  assert.equal(after.activeItem.text, 'original source');
});

test('new search cancels source loading without leaving View message disabled', async () => {
  const h = setup(), view = h.render();
  const item = view.inspectItem('m:0');
  assert.equal(h.render().itemLoading, true);
  const search = view.runSearch({ query: 'new term' });
  assert.equal(h.pending[0].signal.aborted, true);
  h.pending[1].resolve({ chat_id: 'chat-a', query: 'new term', scope: 'chat', results: [], text: null });
  await Promise.all([item, search]);
  const after = h.render();
  assert.equal(after.itemLoading, false);
  assert.equal(after.searching, false);
  assert.equal(after.activeItem, null);
  assert.equal(after.searchResult.query, 'new term');
});

test('a late search response cannot appear in another chat or private chat', async () => {
  for (const options of [{ chatId: 'chat-b' }, { privateChat: true }]) {
    const h = setup();
    const search = h.render().runSearch({ query: 'private term' });
    h.render(options);
    h.pending[0].resolve({ scope: 'chat', results: [], query: 'private term' });
    await search;
    assert.equal(h.render(options).searchResult, null);
  }
});

test('local keyword ranking is distinguished from unchanged Engine BM25 hits', () => {
  const h = setup();
  const card = { pos: 2, keywords: ['term'], importance: 0.2 };
  const engineHit = { ref: 'm:1', score: 4.5, why: ['term'], card: { ...card, pos: 1 } };
  const hits = h.matchCardsForQuery([card], 'term', [engineHit]);
  assert.equal(hits[0], engineHit);
  assert.equal(hits[0].scoreKind, undefined);
  assert.equal(hits[1].scoreKind, 'keyword');
  assert.equal(hits[1].ref, 'm:2');
});

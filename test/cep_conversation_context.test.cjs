const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load, harness } = require('./cepHarness.cjs');

const reply = (body, result) => ({ jsonrpc: '2.0', id: body.id, result });

function setup(handler) {
  const h = harness((url, body, options) => {
    assert.equal(url, '/v1/cep');
    return handler(body, options);
  });
  const historyMod = load('src/api/engine/chat/history.ts', {
    '../../client/cep': h,
    '../../client/errors': h.errors,
  });
  const contextMod = load('src/api/engine/chat/context.api.ts', {
    '../../client/cep': h,
    '../../client/errors': h.errors,
  });
  return { ...h, ...historyMod, ...contextMod };
}

const sampleCard = (patch = {}) => ({
  id: 'm:0',
  pos: 0,
  role: 'user',
  ts: '2026-10-28T06:00:00Z',
  tokens: 42,
  trivial: false,
  keywords: ['rust', 'kv'],
  entities: { files: ['src/main.rs'], urls: [], numbers: [], quoted: [] },
  tools: ['fs.read'],
  files: ['src/main.rs'],
  signals: ['question'],
  importance: 0.75,
  enrichment: { title: 'KV Cache Setup', motive: 'Check memory', summary: 'Asked about KV cache', keywords: ['kv'], by: 'rules' },
  ...patch,
});

const sampleEvent = (patch = {}) => ({
  v: 1,
  id: 'e1',
  chat: 'chat-a',
  seq: 1,
  ts: '2026-10-28T06:00:00Z',
  kind: 'message',
  role: 'user',
  ...patch,
});

test('memory.events and memory.index validate schemas, pagination and signal forwarding', async () => {
  const signal = new AbortController().signal;
  const h = setup((body, options) => {
    assert.equal(options.signal, signal);
    if (body.method === 'memory.events') {
      assert.deepEqual({ ...body.params }, { chat_id: 'chat-a', from_seq: 2, limit: 10 });
      return reply(body, {
        chat_id: 'chat-a',
        total: 3,
        skipped_lines: 0,
        next_from_seq: null,
        events: [sampleEvent({ seq: 2 }), sampleEvent({ seq: 3, kind: 'tool_result' })],
      });
    }
    if (body.method === 'memory.index') {
      assert.deepEqual({ ...body.params }, { chat_id: 'chat-a' });
      return reply(body, {
        chat_id: 'chat-a',
        cards: [sampleCard()],
        episodes: [{
          id: 'ep:0',
          first_pos: 0,
          last_pos: 1,
          start: '2026-10-28T06:00:00Z',
          end: '2026-10-28T06:01:00Z',
          messages: 2,
          title: 'KV cache investigation',
          keywords: ['kv'],
          files: ['src/main.rs'],
          tools: ['fs.read'],
          key_moments: [0],
          summary: { title: 'KV setup', summary: 'Checked KV cache', by: 'rules' },
        }],
        tasks: [{
          id: 't:0',
          title: 'Inspect KV cache',
          stage: 'active',
          from_pos: 0,
          to_pos: 1,
          files: ['src/main.rs'],
          tools: ['fs.read'],
          checkpoint: 'Verified status',
          source: 'rules',
        }],
        graph: {
          nodes: [{ id: 'm:0', kind: 'message' }],
          edges: [{ from: 'm:0', to: 'ep:0', kind: 'in_episode' }],
        },
      });
    }
    assert.fail('Unexpected method ' + body.method);
  });

  const events = await h.chatHistoryApi.getEvents({ chat_id: 'chat-a', from_seq: 2, limit: 10 }, signal);
  assert.equal(events.events.length, 2);
  assert.equal(events.next_from_seq, null);

  const index = await h.chatHistoryApi.getIndex('chat-a', signal);
  assert.equal(index.cards[0].pos, 0);
  assert.equal(index.episodes[0].id, 'ep:0');
  assert.equal(index.tasks[0].title, 'Inspect KV cache');
  assert.equal(index.graph.nodes.length, 1);

  for (const badParams of [{ chat_id: '' }, { chat_id: 'chat-a', from_seq: 0 }, { chat_id: 'chat-a', limit: 5001 }]) {
    await assert.rejects(h.chatHistoryApi.getEvents(badParams), { statusText: /INVALID_(CHAT_ID|HISTORY_INPUT)/ });
  }
  const wrongSeq = setup(body => reply(body, {
    chat_id: 'chat-a',
    total: 1,
    skipped_lines: 0,
    next_from_seq: null,
    events: [sampleEvent({ seq: 1 })],
  }));
  await assert.rejects(wrongSeq.chatHistoryApi.getEvents({ chat_id: 'chat-a', from_seq: 2 }), { statusText: 'INVALID_HISTORY_RESPONSE' });
});

test('memory.search handles both chat-scoped card hits and cross-chat text results, and memory.item verifies m:<pos>', async () => {
  const h = setup(body => {
    if (body.method === 'memory.search') {
      if (body.params.scope === 'workspace') {
        return reply(body, {
          chat_id: 'chat-a',
          query: 'kv cache',
          scope: 'workspace',
          text: '[chat-b m:4] KV cache details',
        });
      }
      return reply(body, {
        chat_id: 'chat-a',
        query: 'kv cache',
        results: [{ ref: 'm:0', score: 2.5, why: ['kv', 'cache'], card: sampleCard({ pos: 0 }) }],
      });
    }
    if (body.method === 'memory.item') {
      return reply(body, {
        chat_id: 'chat-a',
        ref: 'm:0',
        card: sampleCard({ pos: 0 }),
        text: 'Full raw message text at position 0',
      });
    }
    assert.fail('Unexpected method ' + body.method);
  });

  const chatHits = await h.chatHistoryApi.search({ chat_id: 'chat-a', query: '  kv cache  ' });
  assert.equal(chatHits.scope, 'chat');
  assert.equal(chatHits.results.length, 1);
  assert.equal(chatHits.results[0].ref, 'm:0');
  assert.equal(chatHits.text, null);

  const workspaceText = await h.chatHistoryApi.search({ chat_id: 'chat-a', query: 'kv cache', scope: 'workspace' });
  assert.equal(workspaceText.scope, 'workspace');
  assert.equal(workspaceText.results.length, 0);
  assert.match(workspaceText.text, /chat-b m:4/);

  const item = await h.chatHistoryApi.getItem('chat-a', 'm:0');
  assert.equal(item.text, 'Full raw message text at position 0');

  await assert.rejects(h.chatHistoryApi.getItem('chat-a', 'msg-uuid-1'), { statusText: 'INVALID_HISTORY_INPUT' });
  const mismatchedPos = setup(body => reply(body, {
    chat_id: 'chat-a',
    ref: 'm:0',
    card: sampleCard({ pos: 2 }),
    text: 'Wrong pos',
  }));
  await assert.rejects(mismatchedPos.chatHistoryApi.getItem('chat-a', 'm:0'), { statusText: 'INVALID_HISTORY_RESPONSE' });
});

test('memory.export, memory.grants and memory.revoke_grants validate exact wire shapes and prevent duplicate grants', async () => {
  const h = setup(body => {
    if (body.method === 'memory.export') {
      return reply(body, {
        format: 'cluaiz-chat-export',
        version: 1,
        chat_id: 'chat-a',
        events: [sampleEvent()],
        cards: [sampleCard()],
      });
    }
    if (body.method === 'memory.grants') {
      return reply(body, {
        chat_id: 'chat-a',
        grants: [{ tool: 'fs.write', minutes_left: 25 }],
      });
    }
    if (body.method === 'memory.revoke_grants') {
      return reply(body, {
        chat_id: 'chat-a',
        removed: body.params.tool ? 1 : 2,
      });
    }
    assert.fail('Unexpected method ' + body.method);
  });

  const exported = await h.chatHistoryApi.exportChat('chat-a');
  assert.equal(exported.format, 'cluaiz-chat-export');
  assert.equal(exported.version, 1);
  assert.equal(exported.events.length, 1);

  const grants = await h.chatHistoryApi.getGrants('chat-a');
  assert.equal(grants.grants[0].tool, 'fs.write');
  assert.equal(grants.grants[0].minutes_left, 25);

  const revokedSingle = await h.chatHistoryApi.revokeGrants('chat-a', '  fs.write  ');
  assert.equal(revokedSingle.removed, 1);
  const revokedAll = await h.chatHistoryApi.revokeGrants('chat-a');
  assert.equal(revokedAll.removed, 2);

  const dupGrants = setup(body => reply(body, {
    chat_id: 'chat-a',
    grants: [{ tool: 'fs.write', minutes_left: 10 }, { tool: 'fs.write', minutes_left: 5 }],
  }));
  await assert.rejects(dupGrants.chatHistoryApi.getGrants('chat-a'), { statusText: 'INVALID_HISTORY_RESPONSE' });
});

test('context.preview, context.reports, context.report and context.jobs validate plan, tools, timing and queue payloads', async () => {
  const planSample = {
    history_mode: 'adaptive',
    n_ctx: 8192,
    reserve: { answer: 1024, thinking: 512, margin: 256 },
    protected_tokens: 320,
    available_tokens: 6400,
    used_tokens: 410,
    messages_over_budget: 0,
    needs_compaction: false,
    compaction: null,
    notes: { system: ['Workspace prefers Rust'], with_message: [] },
  };
  const toolsSample = {
    format: 'native',
    token_counts: 'exact_model_tokenizer',
    conversation_tokens: 410,
    system_tools_tokens: 180,
    template_tools_tokens: 90,
    hint_tokens: 20,
    load_room_tokens: 5990,
    loaded_in_chat: ['fs.read'],
    bound: ['fs.read', 'memory.search'],
  };

  const h = setup(body => {
    if (body.method === 'context.preview') {
      assert.equal(body.params.chat_id, 'chat-a');
      assert.equal(body.params.request.messages.length, 1);
      return reply(body, { plan: planSample, tools: toolsSample });
    }
    if (body.method === 'context.reports') {
      return reply(body, { chat_id: 'chat-a', reports: ['req-1', 'req-2'] });
    }
    if (body.method === 'context.report') {
      assert.equal(body.params.request_id, 'req-2');
      return reply(body, {
        chat_id: 'chat-a',
        request_id: 'req-2',
        context_report: {
          plan: planSample,
          tools: toolsSample,
          timing: { preflight_ms: 14, model_load_ms: 0, count_ms: 5 },
        },
      });
    }
    if (body.method === 'context.jobs') {
      return reply(body, {
        indexer: 'idle',
        requests_in_flight: 0,
        running: false,
        queue: [{ chat_id: 'chat-a', answer_pos: 3, kind: 'enrich' }],
        counts: { done: 4, failed: 0, stopped: 1, skipped: 2 },
        recent: [{ chat: 'chat-a', answer_pos: 2, cold: false, outcome: 'done', ms: 18 }],
      });
    }
    assert.fail('Unexpected method ' + body.method);
  });

  const preview = await h.contextApi.preview({
    chat_id: 'chat-a',
    request: { model: 'qwen', messages: [{ role: 'user', content: 'Hello' }] },
  });
  assert.equal(preview.plan.n_ctx, 8192);
  assert.equal(preview.tools.conversation_tokens, 410);

  const list = await h.contextApi.listReports('chat-a');
  assert.deepEqual(list.reports, ['req-1', 'req-2']);

  const report = await h.contextApi.getReport('chat-a', 'req-2');
  assert.equal(report.context_report.timing.preflight_ms, 14);
  assert.equal(report.context_report.plan.used_tokens, 410);

  const jobs = await h.contextApi.getJobs();
  assert.equal(jobs.indexer, 'idle');
  assert.equal(jobs.counts.done, 4);
  assert.equal(jobs.queue[0].kind, 'enrich');
  assert.equal(jobs.recent[0].ms, 18);

  await assert.rejects(
    h.contextApi.preview({ chat_id: 'chat-a', request: { messages: [] } }),
    { statusText: 'INVALID_CONTEXT_INPUT' }
  );
  for (const bad of [
    { plan: {}, tools: {} },
    { plan: { n_ctx: -1 }, tools: {} },
    { plan: { n_ctx: 4096 }, tools: { hint_tokens: -5 } },
  ]) {
    const broken = setup(body => reply(body, bad));
    await assert.rejects(
      broken.contextApi.preview({ chat_id: 'chat-a', request: { messages: [{ role: 'user', content: 'Hi' }] } }),
      { statusText: 'INVALID_CONTEXT_RESPONSE' }
    );
  }
});

test('matchCardsForQuery resolves single-word queries (e.g. "aryan") from indexed cards when Engine recall returns empty', () => {
  const { matchCardsForQuery } = load('src/features/chat/hooks/useConversationMemory.ts', {
    react: { useCallback: fn => fn, useEffect: () => {}, useRef: v => ({ current: v }), useState: v => [typeof v === 'function' ? v() : v, () => {}] },
    '../../../api/engine/chat': { chatHistoryApi: {} },
    '../../../api/client/errors': { errorMessage: String },
    '../../../store/engine/useConnectionStore': { useConnectionStore: () => 'http:http://127.0.0.1:8000' },
  });

  const cards = [
    sampleCard({
      id: 'ev_1',
      pos: 8,
      role: 'user',
      keywords: ['my', 'name', 'aryan', 'is'],
      importance: 0.2,
      enrichment: {
        by: 'model:Qwen3-4B-Q4_K_M.gguf',
        title: 'AI vs Human',
        summary: 'Discussed key differences between AI and human capabilities.',
        motive: 'Understand differences between AI and humans',
        keywords: ['AI', 'Human', 'Differences'],
      },
    }),
    sampleCard({
      id: 'ev_2',
      pos: 9,
      role: 'assistant',
      keywords: ['meet', 'pleasure', 'you', 'aryan', 'assist', 'hello'],
      importance: 0.2,
      enrichment: {
        by: 'model:Qwen3-4B-Q4_K_M.gguf',
        title: 'AI vs Human',
        summary: 'Discussed key differences between AI and human capabilities.',
        motive: 'Understand differences between AI and humans',
        keywords: ['AI', 'Human'],
      },
    }),
  ];

  const hits = matchCardsForQuery(cards, 'aryan', []);
  assert.equal(hits.length, 2);
  assert.equal(hits[0].ref, 'm:9');
  assert.equal(hits[1].ref, 'm:8');
  assert.deepEqual([...hits[0].why], ['aryan']);
});

test('cluaizEngine.send forwards history_mode adaptive for saved chats and omits it when absent', async () => {
  const sentPayloads = [];
  const { cluaizEngine } = load('src/core/engine.ts', {
    '@tauri-apps/api/core': { invoke: async () => {} },
    '../store/engine/useEngineStore': { useEngineStore: { getState: () => ({ setStatus: () => {} }) } },
    '../store/engine/useConnectionStore': { useConnectionStore: { getState: () => ({ protocol: 'http' }) } },
    '../api': {
      client: { get: async () => ({}) },
      chatApi: {
        streamCompletion: async payload => {
          sentPayloads.push(payload);
        },
        cancelStream: async () => {},
        skipThinking: async () => {},
      },
    },
    '../api/client/ipc': { isTauri: () => false },
  });

  await cluaizEngine.send('remember my name is aryan', {
    session_id: 'chat-saved',
    history_mode: 'adaptive',
    messages: [{ role: 'user', content: 'remember my name is aryan' }],
  });
  assert.equal(sentPayloads[0].history_mode, 'adaptive');
  assert.equal(sentPayloads[0].session_id, 'chat-saved');

  await cluaizEngine.send('private question', {
    session_id: 'chat-private',
    temporary_chat: 'lite',
    messages: [{ role: 'user', content: 'private question' }],
  });
  assert.equal(sentPayloads[1].temporary_chat, 'lite');
  assert.equal(sentPayloads[1].history_mode, undefined);
});

test('memory.import validates external RAM import events and rejects cross-chat or malformed replies', async () => {
  const calls = [];
  let overrideReply = null;
  const { chatHistoryApi } = load('src/api/engine/chat/history.ts', {
    '../../client/cep': {
      callCep: async (method, params) => {
        calls.push({ method, params });
        if (overrideReply) return overrideReply;
        return {
          chat_id: params.chat_id,
          storage: 'external',
          events: params.events.length,
          cards: 1,
        };
      },
    },
    '../../client/errors': load('src/api/client/errors.ts'),
  });

  const imported = await chatHistoryApi.importChat('c1', [sampleEvent({ chat: 'c1' })]);
  assert.equal(calls[0].method, 'memory.import');
  assert.equal(imported.storage, 'external');
  assert.equal(imported.events, 1);
  assert.equal(imported.cards, 1);

  await assert.rejects(
    () => chatHistoryApi.importChat('c1', [sampleEvent({ chat: 'c2' })]),
    { statusText: 'INVALID_HISTORY_RESPONSE' },
  );

  overrideReply = { chat_id: 'c1', storage: 'engine', events: 1, cards: 1 };
  await assert.rejects(
    () => chatHistoryApi.importChat('c1', [sampleEvent({ chat: 'c1' })]),
    { statusText: 'INVALID_HISTORY_RESPONSE' },
  );
});

test('router pushChatRoute and pushViewRoute strip stale API Explorer endpoint and method params', () => {
  const pushed = [];
  const win = {
    location: {
      href: 'http://localhost:1420/?endpoint=%2Fv1%2Fingest&method=POST',
      pathname: '/',
      search: '?endpoint=%2Fv1%2Fingest&method=POST',
      hash: '',
    },
    history: {
      pushState: (state, _title, url) => pushed.push({ mode: 'push', state, url }),
      replaceState: (state, _title, url) => pushed.push({ mode: 'replace', state, url }),
    },
  };
  const { pushChatRoute, pushViewRoute } = load(
    'src/core/router.ts',
    {
      '../store/ui/useLayoutStore': {
        useLayoutStore: { getState: () => ({ activeExtension: null }) },
      },
      '../extensions/routes': {
        extensionPath: () => '/extensions',
        parseExtensionPath: () => null,
      },
    },
    { window: win, URL, URLSearchParams },
  );

  pushChatRoute(null, true);
  assert.equal(pushed[0].url, '/');

  pushChatRoute('chat_20261029_01', false);
  assert.equal(pushed[1].url, '/?c=chat_20261029_01');

  pushViewRoute('chat', false);
  assert.equal(pushed[2].url, '/');
});

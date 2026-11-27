const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load, harness } = require('./cepHarness.cjs');

// chatRequest.ts imports SAMPLING_KEYS from the controls store; the same sampling module backs it in test/chat_controls.test.cjs
const chatControlsStub = load('src/api/engine/chat/sampling.ts', {});

const reply = (body, result) => ({ jsonrpc: '2.0', id: body.id, result });

test('models.load_history validates records and rejects malformed pages', async () => {
  const h = harness((url, body) => {
    assert.equal(url, '/v1/cep');
    assert.equal(body.method, 'models.load_history');
    assert.equal(body.params.model, 'qwen3-4b');
    return reply(body, {
      records: [{
        seq: 1, at: '2026-11-19T02:00:00Z', action: 'load', outcome: 'ok',
        model: 'qwen3-4b', file: '/m.gguf', placement: 'GpuOnly', attempts: 1, ms: 420,
      }],
      total: 1, skipped_lines: 0, next_from_seq: null,
    });
  });
  const history = load('src/api/engine/models/loadHistory.ts', {
    '../../client/cep': h, '../../client/errors': h.errors,
  });
  const page = await history.readLoadHistory({ model: 'qwen3-4b', limit: 20 });
  assert.equal(page.records[0].placement, 'GpuOnly');
  assert.equal(page.next_from_seq, null);

  const bad = harness((_, body) => reply(body, { records: [{ seq: '1' }], total: 1, skipped_lines: 0 }));
  const badHistory = load('src/api/engine/models/loadHistory.ts', {
    '../../client/cep': bad, '../../client/errors': bad.errors,
  });
  await assert.rejects(badHistory.readLoadHistory(), { statusText: 'INVALID_MODELS_RESPONSE' });
});

test('system.events validates cursor page and passes wait_ms timeout budget', async () => {
  const h = harness((_, body) => {
    assert.equal(body.method, 'system.events');
    assert.equal(body.params.after, 3);
    assert.equal(body.params.wait_ms, 5000);
    return reply(body, {
      events: [{ seq: 4, name: 'model.load_step', at: '2026-11-19T02:00:01Z', data: { model: 'm', message: 'reading weights 50%' } }],
      next: 4, latest_seq: 4,
    });
  });
  const eventsApi = load('src/api/engine/system/events.ts', {
    '../../client/cep': h, '../../client/errors': h.errors,
  });
  const page = await eventsApi.readSystemEvents({ after: 3, wait_ms: 5000 });
  assert.equal(page.events[0].name, 'model.load_step');
  assert.equal(h.requests[0].options.timeoutMs, 10000);
});

test('chat processingLabel prefers live model_loading step message', () => {
  const req = load('src/features/chat/utils/chatRequest.ts', { '../../../store/chat/useChatControlsStore': chatControlsStub });
  assert.equal(
    req.processingLabel({ stage: 'model_loading', state: 'running', elapsed_ms: 100, message: 'reading weights 42%' }, []),
    'reading weights 42%',
  );
  assert.equal(
    req.processingLabel({ stage: 'model_loading', state: 'running', elapsed_ms: 100 }, []),
    'Loading model',
  );
});

test('reduceLoadEvent tracks background model load lifecycle from system.events', () => {
  const eventsApi = load('src/api/engine/system/events.ts', {
    '../../client/cep': {}, '../../client/errors': {},
  });
  const storeMod = load('src/store/engine/useSystemEventsStore.ts', {
    zustand: require('zustand'),
    '../../api/client/cep': { CepError: class CepError extends Error {} },
    '../../api/engine/system/events': eventsApi,
  });
  let s = storeMod.reduceLoadEvent(null, { seq: 1, name: 'model.load_started', at: '', data: { model: 'qwen', attempt: 1, placement: 'GpuOnly', message: 'loading: GpuOnly' } });
  assert.equal(s.status, 'loading');
  assert.equal(s.placement, 'GpuOnly');
  s = storeMod.reduceLoadEvent(s, { seq: 2, name: 'model.load_step', at: '', data: { model: 'qwen', step: 'weights', percent: 65, message: 'reading weights 65%' } });
  assert.equal(s.percent, 65);
  s = storeMod.reduceLoadEvent(s, { seq: 3, name: 'model.load_retry', at: '', data: { model: 'qwen', attempt: 2, placement: 'MoeSplit', message: 'did not fit; retry 2' } });
  assert.equal(s.attempt, 2);
  assert.equal(s.percent, undefined);
  s = storeMod.reduceLoadEvent(s, { seq: 4, name: 'model.loaded', at: '', data: { model: 'qwen', ms: 1200, message: 'loaded in 1200 ms' } });
  assert.equal(s.status, 'loaded');
  assert.equal(s.ms, 1200);
});

test('reduceChatModelLoading ignores no-op model_loading boundaries when model is already loaded in memory', () => {
  const req = load('src/features/chat/utils/chatRequest.ts', { '../../../store/chat/useChatControlsStore': chatControlsStub });
  // Turn 2+: model is already in memory, preflight emits stage=model_loading running + completed with no p.load
  let state = req.reduceChatModelLoading(undefined, { stage: 'model_loading', state: 'running', elapsed_ms: 0 }, 'Qwen3-4B');
  assert.equal(state, undefined);
  // Previous model unload event must also never start a loading state
  state = req.reduceChatModelLoading(undefined, {
    stage: 'model_loading', state: 'running', elapsed_ms: 10,
    load: { kind: 'unloaded', model: 'OldModel', ms: 585, message: 'unloaded in 585 ms' },
  }, 'Qwen3-4B');
  assert.equal(state, undefined);
  state = req.reduceChatModelLoading(state, { stage: 'model_loading', state: 'completed', elapsed_ms: 1 }, 'Qwen3-4B');
  assert.equal(state, undefined);
  // engine.load summary at end of turn must also be ignored when no real load steps ran
  state = req.finalizeChatModelLoad(state, { placement: 'Hybrid', context: 8192 }, 'Qwen3-4B');
  assert.equal(state, undefined);

  // Turn 1 (cold load): actual LoadEvents arrive on p.load
  let cold = req.reduceChatModelLoading(undefined, {
    stage: 'model_loading', state: 'running', elapsed_ms: 5,
    load: { kind: 'started', model: 'Qwen3-4B', attempt: 1, placement: 'Hybrid', message: 'loading: Hybrid' },
  }, 'Qwen3-4B');
  assert.equal(cold.status, 'loading');
  assert.equal(cold.steps.length, 1);
  cold = req.reduceChatModelLoading(cold, {
    stage: 'model_loading', state: 'running', elapsed_ms: 200,
    load: { kind: 'step', model: 'Qwen3-4B', attempt: 1, step: 'weights', percent: 77, message: 'reading weights 77%' },
  }, 'Qwen3-4B');
  assert.equal(cold.percent, 77);
  cold = req.reduceChatModelLoading(cold, {
    stage: 'model_loading', state: 'completed', elapsed_ms: 1400,
    load: { kind: 'loaded', model: 'Qwen3-4B', attempt: 1, ms: 1400, message: 'loaded in 1400 ms' },
  }, 'Qwen3-4B');
  assert.equal(cold.status, 'loaded');
  assert.equal(cold.percent, undefined);
  assert.equal(cold.loadMs, 1400);
  cold = req.finalizeChatModelLoad(cold, { placement: 'Hybrid', context: 8192, gpu_blocks: 18, ram_blocks: 15 }, 'Qwen3-4B');
  assert.equal(cold.plan.gpu_blocks, 18);
});

test('the events watcher first reads the newest events and starts again after an Engine restart', async () => {
  const calls = [];
  const pages = [
    { events: [], next: 0, latest_seq: 300 },
    { events: [{ seq: 300, name: 'model.load_step', at: '', data: { model: 'qwen', step: 'weights', percent: 40, message: 'reading weights 40%' } }], next: 300, latest_seq: 300 },
    // The Engine restarted: its events count from 1 again
    { events: [{ seq: 1, name: 'engine.started', at: '', data: {} }], next: 1, latest_seq: 1 },
  ];
  let stop;
  const done = new Promise(resolve => { stop = resolve; });
  const storeMod = load('src/store/engine/useSystemEventsStore.ts', {
    zustand: require('zustand'),
    '../../api/client/cep': { CepError: class CepError extends Error {} },
    '../../api/engine/system/events': { readSystemEvents: async params => {
      calls.push(JSON.parse(JSON.stringify(params)));
      if (pages.length) return pages.shift();
      stop();
      return new Promise(() => {});
    } },
  });
  const unwatch = storeMod.useSystemEventsStore.getState().startWatching();
  await done;
  unwatch();
  assert.deepEqual(calls.slice(0, 3), [{ limit: 1 }, { after: 250, limit: 50 }, { after: 300, limit: 50, wait_ms: 15000 }]);
  assert.equal(storeMod.useSystemEventsStore.getState().activeLoad.percent, 40);
  // After the restart it looks again from the newest events
  assert.deepEqual(calls[3], { limit: 1 });
});

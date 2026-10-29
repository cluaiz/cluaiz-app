const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness, toolHarness } = require('./cepHarness.cjs');
const reply = (body, result) => ({ jsonrpc: '2.0', id: body.id, result });
const view = (status, patch = {}) => ({ task_id: 'owned-task', method: 'models.download', status, poll_ms: 500, ...patch });
const outcome = { status: 'success', model: 'canonical-model', downloaded: true, path: 'test-only' };

test('observed model install starts once, exposes actual progress, then validates final outcome', async () => {
  let reads = 0;
  const seen = [];
  const h = harness((_, body) => {
    if (body.method === 'models.download') return reply(body, { task: view('working') });
    if (body.method === 'tasks.get') return reply(body, ++reads === 1
      ? view('working', { progress: { done: 0, total: 1024, unit: 'bytes' } }) : view('completed'));
    assert.equal(body.method, 'tasks.result');
    assert.equal(body.params.wait_ms, 0);
    return reply(body, outcome);
  });
  const got = await h.downloadInstalledModel({ model_id: 'catalogue:Q4_K_M' }, undefined, task => seen.push(task));
  assert.equal(got.model, 'canonical-model');
  assert.equal(seen[1].progress.done, 0);
  assert.equal(seen[1].progress.total, 1024);
  assert.equal(h.requests.filter(r => r.body.method === 'models.download').length, 1);
});

test('resume reads the original task id and never starts another model operation', async () => {
  const h = harness((_, body) => {
    assert.equal(body.params.task_id, 'owned-task');
    return reply(body, body.method === 'tasks.get' ? view('completed') : outcome);
  });
  const got = await h.resumeModelDownload('owned-task', undefined, () => {});
  assert.equal(got.downloaded, true);
  assert.deepEqual(h.requests.map(r => r.body.method), ['tasks.get', 'tasks.result']);
});

test('wrong task identity/progress and malformed final results fail without replay', async () => {
  for (const bad of [view('working', { task_id: 'another' }), view('working', { method: 'tools.install' }),
    view('working', { progress: { done: -1 } }), view('working', { progress: { done: 1, total: '10' } })]) {
    const h = harness((_, body) => reply(body, bad));
    await assert.rejects(h.resumeModelDownload('owned-task', undefined, () => {}), e => e.statusText === 'INVALID_CEP_TASK');
    assert.equal(h.requests.length, 1);
  }
  const h = harness((_, body) => reply(body, body.method === 'tasks.get' ? view('completed') : { status: 'success' }));
  await assert.rejects(h.resumeModelDownload('owned-task', undefined, () => {}), e => e.statusText === 'INVALID_MODEL_ACTION');
});

test('local observation abort sends no tasks.cancel; cooperative cancel requires exact acknowledgement', async () => {
  const controller = new AbortController();
  const h = harness((_, body) => reply(body, view(body.method === 'tasks.cancel' ? 'cancelled' : 'working')));
  const observing = h.resumeModelDownload('owned-task', controller.signal, () => controller.abort());
  await assert.rejects(observing);
  assert.equal(h.requests.some(r => r.body.method === 'tasks.cancel'), false);
  const cancelled = await h.cancelCepTask('models.download', 'owned-task');
  assert.equal(cancelled.status, 'cancelled');
  const refused = harness((_, body) => reply(body, view('working')));
  await assert.rejects(refused.cancelCepTask('models.download', 'owned-task'), e => e.statusText === 'INVALID_CEP_TASK');
});

test('expired/forbidden/cancelled task errors preserve domain data rather than claiming installation', async () => {
  for (const [code, type] of [[-32004, 'task_not_found'], [-32002, 'forbidden'], [-32008, 'cancelled']]) {
    const h = harness((_, body) => ({ jsonrpc: '2.0', id: body.id, error: { code, message: type, data: { type } } }));
    await assert.rejects(h.resumeModelDownload('owned-task', undefined, () => {}), e => e.code === code && e.data.type === type);
    assert.equal(h.requests.length, 1);
  }
});

test('tool resume reuses installed-package validator and refuses mismatched package success', async () => {
  for (const id of ['requested', 'someone-else']) {
    const h = toolHarness((_, body) => reply(body, body.method === 'tasks.get'
      ? view('completed', { method: 'tools.install' }) : { id, category: 'skill', enabled: true }));
    const pending = h.resumeToolInstall('skill', 'requested', 'owned-task', undefined, () => {});
    if (id === 'requested') assert.equal((await pending).status, 'success');
    else await assert.rejects(pending, e => e.statusText === 'INVALID_TOOL_RESULT');
    assert.equal(h.requests.some(r => r.body.method === 'tools.install'), false);
  }
});

test('cancel preflight refuses a wrong-method or ended task before dispatching a mutation', async () => {
  for (const current of [view('working', { method: 'system.exec' }), view('completed')]) {
    const h = harness((_, body) => reply(body, current));
    await assert.rejects(h.cancelCepTask('models.download', 'owned-task'));
    assert.deepEqual(h.requests.map(r => r.body.method), ['tasks.get']);
  }
});

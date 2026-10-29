const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./cepHarness.cjs');
const method = 'models.download';
const tick = () => new Promise(resolve => setImmediate(resolve));
const task = (status = 'working') => ({ task_id: 'owned-task', method, status });
const deferred = () => { let resolve; const result = new Promise(done => { resolve = done; }); return { result, resolve }; };

function setup({ failStorage = false, resume, cancel } = {}) {
  const disk = new Map();
  const storage = { getItem: key => disk.get(key) ?? null,
    setItem: (key, value) => { if (failStorage) throw Error('quota'); disk.set(key, value); },
    removeItem: key => disk.delete(key) };
  const receipts = load('src/features/extensions/catalogueTaskReceipt.ts', {}, { localStorage: storage });
  let slots = [], cursor = 0, queued = [];
  const react = {
    useRef(value) { const i = cursor++; return slots[i] ?? (slots[i] = { current: value }); },
    useState(value) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof value === 'function' ? value() : value;
      return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }];
    },
    useCallback(fn, deps) {
      const i = cursor++, old = slots[i];
      if (!old || deps.some((v, index) => !Object.is(v, old.deps[index]))) slots[i] = { deps, value: fn };
      return slots[i].value;
    },
    useEffect(effect, deps) {
      const i = cursor++, old = slots[i];
      if (!old || deps.some((v, index) => !Object.is(v, old.deps[index]))) queued.push(() => {
        old?.cleanup?.(); slots[i] = { deps, cleanup: effect() };
      });
    },
  };
  let connection = { protocol: 'http', host: 'one', port: 8000 };
  const listeners = new Set(), store = Object.assign(select => select(connection), {
    getState: () => connection,
    subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); },
  });
  const { useCatalogueTask } = load('src/features/extensions/useCatalogueTask.ts', {
    react, './catalogueTaskReceipt': receipts,
    '../../api/client/cepTask': { cancelCepTask: cancel ?? (async () => task('cancelled')) },
    '../../api/client/errors': { errorMessage: error => error.message },
    '../../store/engine/useConnectionStore': { useConnectionStore: store },
  });
  const resumeFn = resume ?? (async (_, __, ___, observe) => { observe(task('completed')); return { model: 'restored' }; });
  return {
    disk, storage, receipts,
    scope: () => JSON.stringify([connection.protocol, connection.host, connection.port]),
    render() { cursor = 0; const view = useCatalogueTask(method, resumeFn); const effects = queued; queued = []; effects.forEach(fn => fn()); return view; },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); slots = []; queued = []; },
    switch(host) { const old = connection; connection = { ...connection, host }; listeners.forEach(fn => fn(connection, old)); },
  };
}

test('double click starts once; remount reattaches the saved id, never the installer', async () => {
  const waiting = deferred(); let starts = 0, signal;
  const h = setup(); h.render();
  const first = h.render();
  const started = first.start('model:quant', async (s, observe) => {
    signal = s; starts++; observe(task()); return waiting.result;
  });
  await first.start('model:quant', async () => { starts++; });
  assert.equal(starts, 1);
  assert.equal(h.render().receipt.taskId, 'owned-task');
  h.unmount(); assert.equal(signal.aborted, true);
  h.render(); await tick();
  assert.equal(h.render().result.model, 'restored');
  assert.equal(starts, 1);
  waiting.resolve({ model: 'late old reply' }); await started;
  assert.equal(h.render().result.model, 'restored');
});

test('A to B to A connection changes invalidate old observers even before React rerenders', async () => {
  const waiting = deferred(); let notify;
  const h = setup(); h.render();
  const operation = h.render().start('target', async (_, observe) => { notify = observe; observe(task()); return waiting.result; });
  h.switch('two'); h.switch('one');
  notify({ ...task(), progress: { done: 999 } });
  waiting.resolve({ model: 'stale' }); await operation;
  h.render(); await tick();
  assert.equal(h.render().result.model, 'restored');
  assert.notEqual(h.render().task.progress?.done, 999);
});

test('a missing accepted id blocks automatic replay and an explicit forget does not cancel', async () => {
  const waiting = deferred(); let starts = 0, cancels = 0;
  const h = setup({ cancel: async () => { cancels++; } }); h.render();
  const operation = h.render().start('target', async () => { starts++; return waiting.result; });
  h.unmount(); h.render();
  assert.match(h.render().error, /no saved task id/);
  assert.equal(h.render().canStart, false);
  h.render().forget(); assert.equal(h.render().receipt, null);
  assert.equal(cancels, 0); assert.equal(starts, 1);
  waiting.resolve({}); await operation;
});

test('cancel refusal is visible and never becomes a cancelled acknowledgement', async () => {
  const waiting = deferred();
  const h = setup({ cancel: async () => { throw Error('forbidden'); } }); h.render();
  const operation = h.render().start('target', async (_, observe) => { observe(task()); return waiting.result; });
  await h.render().cancel();
  assert.equal(h.render().error, 'forbidden');
  assert.equal(h.render().task.status, 'working');
  waiting.resolve({}); await operation;
});

test('receipt reload retains only task reference; corrupt data and storage failure remain explicit', () => {
  const h = setup();
  h.receipts.saveTaskReceipt(h.scope(), method, null, { target: 'target', taskId: 'owned-task' });
  const raw = [...h.disk.values()][0];
  assert.deepEqual(Object.keys(JSON.parse(raw)).sort(), ['target', 'taskId']);
  const reload = () => load('src/features/extensions/catalogueTaskReceipt.ts', {}, { localStorage: h.storage });
  assert.equal(reload().readTaskReceipt(h.scope(), method).receipt.taskId, 'owned-task');
  h.disk.set([...h.disk.keys()][0], '{bad');
  assert.match(reload().readTaskReceipt(h.scope(), method).error, /invalid/);
  const session = setup({ failStorage: true });
  const saved = session.receipts.saveTaskReceipt(session.scope(), method, null, { target: 'target' });
  assert.match(saved.warning, /session only/);
  assert.equal(session.receipts.readTaskReceipt(session.scope(), method).receipt.target, 'target');
});

test('a late cancel acknowledgement cannot replace another Engine view', async () => {
  const waiting = deferred(), cancellation = deferred();
  const h = setup({ cancel: () => cancellation.result }); h.render();
  const operation = h.render().start('target', async (_, observe) => { observe(task()); return waiting.result; });
  const cancelling = h.render().cancel();
  h.switch('two'); h.render();
  cancellation.resolve(task('cancelled')); await cancelling;
  assert.equal(h.render().receipt, null);
  assert.equal(h.render().task, undefined);
  waiting.resolve({}); await operation;
});

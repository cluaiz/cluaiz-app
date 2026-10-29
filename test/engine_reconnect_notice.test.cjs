const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./cepHarness.cjs');

function setup(initialStatus = 'error') {
  let cursor = 0, calls = 0, finish;
  const slots = [];
  const state = { fetchStatus: initialStatus, permissions: null, initEngineSettings: () => {
    calls++;
    return new Promise((resolve, reject) => { finish = { resolve, reject }; });
  } };
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => { slots[index] = value; }];
    },
    useRef(initial) {
      const index = cursor++;
      return slots[index] ??= { current: initial };
    },
  };
  const useEngineStore = selector => selector(state);
  useEngineStore.getState = () => state;
  const jsx = (type, props) => ({ type, props });
  const { EngineReconnectNotice } = load('src/features/chat/components/EngineReconnectNotice.tsx', {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'lucide-react': { RotateCw: 'RotateCw' },
    '../../../components/ui/Button': { Button: 'Button' },
    '../../../store/engine/useEngineStore': { useEngineStore },
  });
  const render = () => {
    cursor = 0;
    const row = EngineReconnectNotice();
    const [label, button] = row.props.children;
    return { message: label.props.children, ...button.props };
  };
  return { state, render, calls: () => calls, finish: () => finish };
}

test('offline retry uses existing initializer once and disables the pending action', async () => {
  const h = setup();
  const action = h.render();
  assert.equal(action['aria-label'], 'Retry Engine connection');
  const first = action.onClick();
  await action.onClick(); // Same event closure, before React can render disabled=true.
  assert.equal(h.calls(), 1);
  assert.equal(h.render().disabled, true);
  assert.match(h.render().message, /Connecting/);
  h.finish().resolve();
  await first;
  assert.match(h.render().message, /still offline/);
  assert.equal(h.render().disabled, false);
});

test('initialization elsewhere blocks another retry', async () => {
  const h = setup('loading');
  await h.render().onClick();
  assert.equal(h.calls(), 0);
  assert.equal(h.render().disabled, true);
});

test('authentication failure stays explicit rather than claiming connection success', async () => {
  const h = setup();
  const pending = h.render().onClick();
  h.state.fetchStatus = 'auth_required';
  h.finish().resolve();
  await pending;
  assert.match(h.render().message, /session token/);
});

test('permissions alone do not turn a failed settings sync into success', async () => {
  const h = setup();
  const pending = h.render().onClick();
  h.state.permissions = {};
  h.finish().resolve();
  await pending;
  assert.match(h.render().message, /still offline/);
});

test('rejected initialization leaves a usable retry action', async () => {
  const h = setup();
  const pending = h.render().onClick();
  h.finish().reject(Error('unreachable'));
  await pending;
  assert.match(h.render().message, /Could not connect/);
  assert.equal(h.render().disabled, false);
  const retry = h.render().onClick();
  assert.equal(h.calls(), 2);
  h.state.fetchStatus = 'success';
  h.state.permissions = {};
  h.finish().resolve();
  await retry;
  assert.doesNotMatch(h.render().message, /Could not|still offline/);
});

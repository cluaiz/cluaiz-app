const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load } = require('./cepHarness.cjs');

test('scroll events without a state change do not schedule React updates', () => {
    const updates = [];
    const { useChatScroll } = load('src/features/chat/hooks/useChatScroll.ts', {
        react: {
            useState: value => [value, next => updates.push(next)],
            useRef: current => ({ current }),
            useCallback: callback => callback,
            useEffect: () => {},
        },
    });
    const { handleScroll } = useChatScroll({ messages: [] });
    const scroll = (scrollTop, scrollHeight = 1000) => handleScroll({ currentTarget: { scrollTop, scrollHeight, clientHeight: 500 } });

    scroll(0, 500);
    scroll(0, 500);
    assert.deepEqual(updates, []);

    scroll(100);
    assert.deepEqual(updates, [false, false, true]);
    updates.length = 0;
    scroll(100);
    assert.deepEqual(updates, []);

    scroll(500);
    assert.deepEqual(updates, [true, 0, false]);
    updates.length = 0;
    scroll(500);
    assert.deepEqual(updates, []);
});

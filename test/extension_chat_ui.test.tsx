import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { useExtensionChat } from '../src/features/chat/hooks/useExtensionChat';
import { createExtensionSession } from '../src/extensions/sdk';
import { extensionServices } from '../src/extensions/services';
import { EXTENSION_CAPABILITIES } from '../src/extensions/manifest';
import { useChatStore } from '../src/store/chat/useChatStore';
import { chatStorageManager } from '../src/services/storage/ChatStorageManager';
import { chatApi } from '../src/api/engine/chat/chat.api';
import { cluaizEngine } from '../src/core/engine';

const tick = () => new Promise<void>(resolve => setImmediate(resolve));
async function setup(t: TestContext) {
    const warn = console.warn.bind(console);
    t.mock.method(console, 'warn', (message: unknown, ...args: unknown[]) => {
        if (typeof message === 'string' && message.startsWith('[IDB]')
            && args[0] instanceof Error && args[0].message === 'IndexedDB is not supported in this environment') return;
        warn(message, ...args);
    });
    for (const name of ['saveSessionsIndex', 'saveSessionMetadata', 'appendMessage', 'saveAllMessages'] as const) {
        t.mock.method(chatStorageManager, name, async () => {});
    }
    t.mock.method(chatStorageManager, 'loadSessionMessages', async () => []);
    t.mock.method(console, 'log', () => {});
    useChatStore.setState({ sessions: {}, activeSessionId: null, streamingSessionId: null, isHydrated: true });
    const main = useChatStore.getState().createNewSession('Main chat');
    const session = createExtensionSession({ hub_type: 'extension', id: 'test.chat-ui', name: 'Chat UI',
        version: '1.0.0', host_api: 1, capabilities: EXTENSION_CAPABILITIES,
        contributes: { views: [{ id: 'main', title: 'Main', slot: 'workspace', layout: 'with-chat' }] } },
    EXTENSION_CAPABILITIES, extensionServices, { getItem: () => null, setItem: () => {}, removeItem: () => {} });
    const handle = await session.sdk.chat.create().result;
    let clears = 0;
    let tokens = 0;
    let ui!: ReturnType<typeof useExtensionChat>;
    function Harness() {
        ui = useExtensionChat({ sdk: session.sdk, handle }, {
            startStreaming: () => {}, endStreaming: () => null, recordToken: () => tokens++,
        } as any, () => { clears++; }, 'draft');
        return null;
    }
    renderToString(<Harness />);
    t.after(() => session.dispose());
    const settle = async () => {
        for (let i = 0; i < 25 && session.sdk.jobs.list().some(job => job.status === 'running'); i++) await tick();
        await tick();
    };
    return { main, session, handle, ui, settle, clears: () => clears, tokens: () => tokens };
}

test('shared UI send writes its saved session and preserves the main chat selection', async t => {
    const state = await setup(t);
    const payloads: any[] = [];
    t.mock.method(chatApi, 'streamCompletion', async (payload: unknown, callbacks: any) => {
        payloads.push(payload); callbacks.onToken('Own answer');
    });
    assert.equal(state.ui.send('Own question', { model: 'selected-model' }), true);
    await state.settle();
    const store = useChatStore.getState();
    assert.equal(store.activeSessionId, state.main);
    assert.equal(store.sessions[state.main].messages.length, 0);
    assert.deepEqual(store.sessions[state.handle.id].messages.map(message => message.text), ['Own question', 'Own answer']);
    assert.equal(payloads[0].session_id, state.handle.id);
    assert.deepEqual(payloads[0].tools, []);
    assert.equal(state.clears(), 1);
    assert.equal(state.tokens(), 1);
});

test('missing model, attachments, tools and busy admission preserve the draft and do not send', async t => {
    const state = await setup(t);
    const stream = t.mock.method(chatApi, 'streamCompletion', async () => { assert.fail('Must not send'); });
    assert.equal(state.ui.send('draft'), false);
    assert.equal(state.ui.send('draft', { model: 'selected-model', attachments: [{ name: 'file' }] }), false);
    assert.equal(state.ui.send('draft', { model: 'selected-model', tools: [{ id: 'tool', name: 'tool' }] }), false);
    useChatStore.getState().setStreamingSession(state.main);
    assert.equal(state.ui.send('draft', { model: 'selected-model' }), false);
    assert.equal(state.clears(), 0);
    assert.equal(stream.mock.callCount(), 0);
    assert.equal(useChatStore.getState().sessions[state.handle.id].messages.length, 0);
});

test('shared UI Stop cancels its SDK job without invoking the global Engine stop', { timeout: 5000 }, async t => {
    const state = await setup(t);
    const stop = t.mock.method(cluaizEngine, 'stop', async () => {});
    let callbacks: any;
    let finish!: () => void;
    let started!: () => void;
    const streamStarted = new Promise<void>(resolve => { started = resolve; });
    t.mock.method(chatApi, 'streamCompletion', async (_payload: unknown, cb: any) => {
        callbacks = cb;
        cb.onToken('Partial');
        started();
        await new Promise<void>(resolve => { finish = resolve; });
    });
    state.ui.send('Question', { model: 'selected-model' });
    await streamStarted;
    assert.ok(callbacks);
    state.ui.stop();
    callbacks.onToken('Late');
    finish();
    await state.settle();
    assert.equal(stop.mock.callCount(), 0);
    assert.equal(useChatStore.getState().activeSessionId, state.main);
    assert.equal(useChatStore.getState().sessions[state.handle.id].messages.at(-1)?.text, 'Partial');
    assert.equal(useChatStore.getState().streamingSessionId, null);
    assert.equal(state.session.sdk.jobs.list().at(-1)?.status, 'cancelled');
});

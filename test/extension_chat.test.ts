import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { http } from '../src/api/client/http';
import { chatApi } from '../src/api/engine/chat/chat.api';
import { useChatStore } from '../src/store/chat/useChatStore';
import { chatStorageManager } from '../src/services/storage/ChatStorageManager';
import { createExtensionSession } from '../src/extensions/sdk';
import { extensionServices } from '../src/extensions/services';
import { EXTENSION_CAPABILITIES } from '../src/extensions/manifest';
import type { ChatMessage } from '../src/store/chat/types';
import { IndexedDbChatStorageDriver } from '../src/services/storage/IndexedDbChatStorageDriver';
import { cluaizEngine } from '../src/core/engine';

const request = { model: 'selected-model', input: 'Hello', maxTokens: 32 };
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(yes => { resolve = yes; });
    return { promise, resolve };
}
function session(id = 'test.assistant', granted: readonly typeof EXTENSION_CAPABILITIES[number][] = EXTENSION_CAPABILITIES) {
    const values = new Map<string, string>();
    return createExtensionSession({ hub_type: 'extension', id, name: 'Test assistant', version: '1.0.0', host_api: 1,
        capabilities: EXTENSION_CAPABILITIES, contributes: { views: [{ id: 'main', title: 'Main', slot: 'workspace' }] } },
    granted, extensionServices, { getItem: key => values.get(key) ?? null,
        setItem: (key, value) => { values.set(key, value); }, removeItem: key => { values.delete(key); } });
}

/** Only filesystem HTTP is replaced; store, manager, drivers and JSON/JSONL encoding are real. */
function setup(t: TestContext) {
    const warn = console.warn.bind(console);
    t.mock.method(console, 'warn', (message: unknown, ...args: unknown[]) => {
        // Node intentionally exercises the driver's memory fallback, not a browser DB.
        if (typeof message === 'string' && message.startsWith('[IDB]')
            && args[0] instanceof Error && args[0].message === 'IndexedDB is not supported in this environment') return;
        warn(message, ...args);
    });
    const previous = useChatStore.getState();
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const files = new Map<string, string>();
    const urls: string[] = [];
    const location = new URL('http://app.test/?c=main-chat');
    const history = { pushState: (_state: unknown, _unused: string, url: string) => { urls.push(url); },
        replaceState: (_state: unknown, _unused: string, url: string) => { urls.push(url); } };
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { location, history } });
    t.mock.method(http, 'post', async (endpoint: string, body: unknown) => {
        const input = body as { path: string; content?: string };
        if (endpoint === '/v1/fs/write') { files.set(input.path, input.content!); return { status: 'success' } as never; }
        if (endpoint === '/v1/fs/read') return { content: files.get(input.path) ?? '' } as never;
        assert.fail(`Unexpected network operation: ${endpoint}`);
    });
    useChatStore.setState({ sessions: {}, activeSessionId: null, streamingSessionId: null, isHydrated: true });
    const main = useChatStore.getState().createNewSession('Main chat');
    urls.length = 0;
    t.after(async () => {
        await tick(); await tick();
        useChatStore.setState(previous);
        if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
        else Reflect.deleteProperty(globalThis, 'window');
    });
    return { files, urls, main,
        json: (path: string) => JSON.parse(files.get(path)!),
        messages: (id: string): ChatMessage[] => (files.get(`data/chats/${id}/messages.jsonl`) || '')
            .trim().split('\n').filter(Boolean).map(line => JSON.parse(line)),
    };
}

test('extension creates a normal saved chat without changing main selection or URL', async t => {
    const storage = setup(t);
    const current = session();
    try {
        const handle = await current.sdk.chat.create({ title: 'Assistant chat' }).result;
        await tick();
        const store = useChatStore.getState();
        assert.equal(store.activeSessionId, storage.main);
        assert.deepEqual(storage.urls, []);
        assert.equal(store.sessions[handle.id].extensionId, current.sdk.identity.id);
        assert.equal(Object.isFrozen(handle), true);
        const meta = storage.json(`data/chats/${handle.id}/meta.json`);
        assert.equal(meta.extensionId, current.sdk.identity.id);
        const index = storage.json('data/chats/sessions_index.json');
        assert.equal(index.lastActiveSessionId, storage.main);
        assert.equal(index.sessions.find((item: { id: string }) => item.id === handle.id).extensionId, current.sdk.identity.id);
        assert.equal(index.sessions.length, 2, 'ordinary and extension chats use one catalog');
    } finally { current.dispose(); }
});

test('ordinary new-chat defaults still select the new chat and update its route', async t => {
    const storage = setup(t);
    const id = useChatStore.getState().createNewSession('Another chat');
    await tick();
    assert.equal(useChatStore.getState().activeSessionId, id);
    assert.equal(storage.urls.length, 1);
    assert.equal(storage.json('data/chats/sessions_index.json').lastActiveSessionId, id);
    assert.equal(useChatStore.getState().sessions[id].extensionId, undefined);
});

test('owned send reuses chat adapter and persists both messages through the old JSONL driver', async t => {
    const storage = setup(t);
    const adapter = t.mock.method(chatApi, 'streamCompletion', async (_payload, options) => {
        await tick();
        options?.onReasoning?.('Consider'); options?.onToken?.('Answer');
    });
    const current = session();
    try {
        const handle = await current.sdk.chat.create().result;
        const events: unknown[] = [];
        await current.sdk.chat.send(handle, request, event => events.push(event)).result;
        await tick();
        const payload = adapter.mock.calls[0].arguments[0];
        assert.equal(payload.session_id, handle.id);
        assert.deepEqual(payload.messages, [{ role: 'user', content: 'Hello' }]);
        assert.equal(payload.tool_choice, 'none');
        assert.equal(payload.temporary_chat, 'strict');
        assert.deepEqual(events, [{ type: 'reasoning', text: 'Consider' }, { type: 'text', text: 'Answer' }]);
        assert.deepEqual(storage.messages(handle.id).map(message => [message.sender, message.text]), [['user', 'Hello'], ['assistant', 'Answer']]);
        assert.equal(storage.messages(handle.id)[1].thinking, 'Consider');
        assert.equal(useChatStore.getState().activeSessionId, storage.main);
        assert.equal(useChatStore.getState().sessions[storage.main].messages.length, 0);
        assert.equal(useChatStore.getState().streamingSessionId, null);
    } finally { current.dispose(); }
});

test('history rehydrates with its owner and the same package can reopen it without selecting it', async t => {
    const storage = setup(t);
    t.mock.method(chatApi, 'streamCompletion', async (_payload, options) => { await tick(); options?.onToken?.('Saved answer'); });
    const first = session();
    const second = session();
    try {
        const old = await first.sdk.chat.create().result;
        await first.sdk.chat.send(old, request, () => {}).result;
        await tick();
        useChatStore.setState({ sessions: {}, activeSessionId: null, isHydrated: false });
        await useChatStore.getState().hydrateFromStorage();
        assert.equal(useChatStore.getState().sessions[old.id].extensionId, first.sdk.identity.id);
        assert.equal(useChatStore.getState().sessions[old.id].messages.length, 0, 'history remains lazy');
        await assert.rejects(second.sdk.chat.read(old).result, /handle/);
        const reopened = await second.sdk.chat.open(old.id).result;
        const snapshot = await second.sdk.chat.read(reopened).result;
        assert.equal(snapshot.messages[1].text, 'Saved answer');
        assert.equal(useChatStore.getState().activeSessionId, null);
        assert.equal(storage.json(`data/chats/${old.id}/meta.json`).extensionId, first.sdk.identity.id);
        snapshot.messages[1].text = 'Caller mutation';
        assert.equal(useChatStore.getState().sessions[old.id].messages[1].text, 'Saved answer');
    } finally { first.dispose(); second.dispose(); }
});

test('another package, a copied handle and an ordinary chat cannot be claimed', async t => {
    const storage = setup(t);
    const first = session(), second = session('other.assistant');
    const adapter = t.mock.method(chatApi, 'streamCompletion', async () => assert.fail('no unauthorized inference'));
    try {
        const handle = await first.sdk.chat.create().result;
        await assert.rejects(second.sdk.chat.open(handle.id).result, /unavailable/);
        await assert.rejects(second.sdk.chat.read(handle).result, /handle/);
        await assert.rejects(first.sdk.chat.read({ id: handle.id }).result, /handle/);
        await assert.rejects(first.sdk.chat.send({ id: handle.id }, request, () => {}).result, /handle/);
        await assert.rejects(first.sdk.chat.open(storage.main).result, /unavailable/);
        assert.equal(adapter.mock.callCount(), 0);
    } finally { first.dispose(); second.dispose(); }
});

test('session and send grants are independent and denial creates no session or network request', async t => {
    setup(t);
    const denied = session('test.denied', []);
    const readOnly = session('test.readonly', ['chat.sessions']);
    try {
        const before = Object.keys(useChatStore.getState().sessions).length;
        assert.throws(() => denied.sdk.chat.create(), /not granted/);
        assert.throws(() => denied.sdk.chat.open('anything'), /not granted/);
        assert.throws(() => denied.sdk.chat.send({ id: 'anything' }, request, () => {}), /not granted/);
        assert.equal(Object.keys(useChatStore.getState().sessions).length, before);
        const handle = await readOnly.sdk.chat.create().result;
        assert.throws(() => readOnly.sdk.chat.send(handle, request, () => {}), /not granted/);
    } finally { denied.dispose(); readOnly.dispose(); }
});

test('private extension chat uses existing incognito behavior and is never written to index, metadata or JSONL', async t => {
    const storage = setup(t);
    t.mock.method(chatApi, 'streamCompletion', async (_payload, options) => { options?.onToken?.('Private'); });
    const current = session();
    try {
        const handle = await current.sdk.chat.create({ incognito: true }).result;
        await current.sdk.chat.send(handle, request, () => {}).result;
        await tick();
        assert.equal(storage.json('data/chats/sessions_index.json').sessions.some((item: { id: string }) => item.id === handle.id), false);
        assert.ok([...storage.files.keys()].every(path => !path.includes(handle.id)));
        assert.equal((await current.sdk.chat.read(handle).result).messages[1].text, 'Private');
    } finally { current.dispose(); }
});

test('busy main chat refuses extension sending before adding a turn', async t => {
    const storage = setup(t);
    const current = session();
    try {
        const handle = await current.sdk.chat.create().result;
        useChatStore.getState().setStreamingSession(storage.main);
        await assert.rejects(current.sdk.chat.send(handle, request, () => {}).result, /Another chat/);
        assert.equal(useChatStore.getState().sessions[handle.id].messages.length, 0);
        assert.equal(useChatStore.getState().streamingSessionId, storage.main);
    } finally { current.dispose(); }
});

test('switching main chats does not send global stop for a private extension running in the background', { timeout: 3000 }, async t => {
    setup(t);
    const started = deferred<void>(), finish = deferred<void>();
    const stop = t.mock.method(cluaizEngine, 'stop', async () => {});
    t.mock.method(chatApi, 'streamCompletion', async (_payload, options) => {
        started.resolve(); await finish.promise; options?.onToken?.('Private answer');
    });
    const current = session();
    try {
        const handle = await current.sdk.chat.create({ incognito: true }).result;
        const job = current.sdk.chat.send(handle, request, () => {});
        await started.promise;
        const other = useChatStore.getState().createNewSession('Other main chat', { activate: false });
        await useChatStore.getState().switchSession(other, false);
        assert.equal(stop.mock.callCount(), 0);
        assert.equal(useChatStore.getState().streamingSessionId, handle.id);
        finish.resolve();
        await job.result;
        assert.equal(useChatStore.getState().activeSessionId, other);
    } finally { finish.resolve(); current.dispose(); }
});

test('the answer lease remains owned until existing assistant persistence finishes', { timeout: 3000 }, async t => {
    setup(t);
    const persisted = deferred<void>(), release = deferred<void>();
    const original = chatStorageManager.appendMessage.bind(chatStorageManager);
    t.mock.method(chatStorageManager, 'appendMessage', async (id, message) => {
        await original(id, message);
        if (message.sender === 'assistant') { persisted.resolve(); await release.promise; }
    });
    t.mock.method(chatApi, 'streamCompletion', async (_payload, options) => { await tick(); options?.onToken?.('Answer'); });
    const current = session();
    try {
        const handle = await current.sdk.chat.create().result;
        const job = current.sdk.chat.send(handle, request, () => {});
        await persisted.promise;
        assert.equal(useChatStore.getState().streamingSessionId, handle.id);
        const other = await current.sdk.chat.create().result;
        await assert.rejects(current.sdk.chat.send(other, request, () => {}).result, /Another chat/);
        release.resolve();
        await job.result;
        assert.equal(useChatStore.getState().streamingSessionId, null);
    } finally { release.resolve(); current.dispose(); }
});

test('leaving the active ordinary private chat retains its existing stop behavior', async t => {
    setup(t);
    const stop = t.mock.method(cluaizEngine, 'stop', async () => {});
    const store = useChatStore.getState();
    const privateId = store.createNewSession('Private', { incognito: true });
    const other = store.createNewSession('Other', { activate: false });
    store.setStreamingSession(privateId);
    await store.switchSession(other, false);
    assert.equal(stop.mock.callCount(), 1);
    assert.equal(useChatStore.getState().activeSessionId, other);
});

test('failed partial answer stays saved while the next request excludes that failed turn', async t => {
    const storage = setup(t);
    let count = 0;
    const adapter = t.mock.method(chatApi, 'streamCompletion', async (_payload, options) => {
        await tick();
        options?.onToken?.(++count === 1 ? 'Partial' : 'Recovered');
        if (count === 1) throw new Error('Model failed');
    });
    const current = session();
    try {
        const handle = await current.sdk.chat.create().result;
        await assert.rejects(current.sdk.chat.send(handle, request, () => {}).result, /Model failed/);
        assert.ok(storage.messages(handle.id).every(message => message.finishReason === 'error'));
        await current.sdk.chat.send(handle, { ...request, input: 'Retry' }, () => {}).result;
        assert.deepEqual(adapter.mock.calls[1].arguments[0].messages, [{ role: 'user', content: 'Retry' }]);
        await new Promise(resolve => setTimeout(resolve, 180));
        assert.equal(storage.messages(handle.id).length, 4, 'no stale debounce overwrites the next turn');
        assert.equal(storage.messages(handle.id)[3].text, 'Recovered');
    } finally { current.dispose(); }
});

for (const action of ['cancel', 'dispose'] as const) {
    test(`${action} aborts only its owned request, suppresses late events and saves partial history`, { timeout: 3000 }, async t => {
        const storage = setup(t);
        const started = deferred<void>(), stopped = deferred<void>();
        let late!: () => void;
        t.mock.method(chatApi, 'streamCompletion', async (_payload, options) => {
            await tick();
            options?.onToken?.('Partial');
            late = () => options?.onToken?.('Late');
            options?.signal?.addEventListener('abort', () => { late(); stopped.resolve(); }, { once: true });
            started.resolve();
            await stopped.promise;
        });
        const current = session();
        const events: unknown[] = [];
        try {
            const handle = await current.sdk.chat.create().result;
            const job = current.sdk.chat.send(handle, request, event => events.push(event));
            await started.promise;
            if (action === 'cancel') job.cancel(); else current.dispose();
            await assert.rejects(job.result, { name: 'AbortError' });
            await tick(); await tick();
            late();
            assert.equal(events.length, 1);
            assert.equal(useChatStore.getState().streamingSessionId, null);
            assert.equal(useChatStore.getState().activeSessionId, storage.main);
            assert.equal(storage.messages(handle.id)[1].text, 'Partial');
            assert.equal(storage.messages(handle.id)[1].finishReason, 'error');
        } finally { stopped.resolve(); current.dispose(); }
    });
}

test('history loading cannot resurrect a deleted session or overwrite newer in-memory messages', async t => {
    setup(t);
    const pending = deferred<ChatMessage[]>();
    t.mock.method(chatStorageManager, 'loadSessionMessages', () => pending.promise);
    const store = useChatStore.getState();
    const first = store.createNewSession('First', { activate: false });
    const second = store.createNewSession('Second', { activate: false });
    const a = store.loadMessages(first), b = store.loadMessages(second);
    useChatStore.setState(state => {
        const { [first]: _deleted, ...sessions } = state.sessions;
        return { sessions: { ...sessions, [second]: { ...sessions[second], messages: [
            { id: 'newer', sender: 'user', text: 'New message', date: 1, time: '' },
        ] } } };
    });
    pending.resolve([{ id: 'older', sender: 'user', text: 'Disk message', date: 0, time: '' }]);
    await Promise.all([a, b]);
    assert.equal(useChatStore.getState().sessions[first], undefined);
    assert.equal(useChatStore.getState().sessions[second].messages[0].id, 'newer');
});

test('not-yet-loaded history and invalid session options fail without creating a chat', async t => {
    setup(t);
    const current = session();
    try {
        useChatStore.setState({ isHydrated: false });
        await assert.rejects(current.sdk.chat.create().result, /still loading/);
        useChatStore.setState({ isHydrated: true });
        const before = Object.keys(useChatStore.getState().sessions).length;
        await assert.rejects(current.sdk.chat.create({ title: ' ' }).result, /Invalid/);
        await assert.rejects(current.sdk.chat.create({ incognito: 'yes' as never }).result, /Invalid/);
        assert.equal(Object.keys(useChatStore.getState().sessions).length, before);
    } finally { current.dispose(); }
});

test('a saved chat with unavailable history refuses sending instead of replacing it with an empty conversation', async t => {
    setup(t);
    const current = session();
    const adapter = t.mock.method(chatApi, 'streamCompletion', async () => assert.fail('missing history must not reach inference'));
    try {
        const handle = await current.sdk.chat.create().result;
        useChatStore.setState(state => ({ sessions: { ...state.sessions,
            [handle.id]: { ...state.sessions[handle.id], messageCount: 2, messages: [] } } }));
        await assert.rejects(current.sdk.chat.send(handle, request, () => {}).result, /could not be loaded/);
        assert.equal(adapter.mock.callCount(), 0);
        assert.equal(useChatStore.getState().sessions[handle.id].messageCount, 2);
        assert.equal(useChatStore.getState().streamingSessionId, null);
    } finally { current.dispose(); }
});

test('IndexedDB catalog and metadata recovery retain ownership; orphan message keys do not invent an owner', async t => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const catalog = { version: 1, lastActiveSessionId: null,
        sessions: [{ id: 'catalog-owned', extensionId: 'test.assistant', title: 'Saved', createdAt: 1, updatedAt: 1 }] };
    const metadata = [{ id: 'meta-owned', extensionId: 'other.assistant', title: 'Recovered', createdAt: 1, updatedAt: 1 }];
    const database = { open() {
        const request: Record<string, any> = { result: { transaction() {
            const transaction: Record<string, any> = { objectStore() {
                return { get: () => ({ result: catalog }), getAll: () => ({ result: metadata }),
                    getAllKeys: () => ({ result: ['orphan'] }) };
            } };
            queueMicrotask(() => transaction.oncomplete?.());
            return transaction;
        } } };
        queueMicrotask(() => request.onsuccess?.());
        return request;
    } };
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { indexedDB: database } });
    t.after(() => {
        if (original) Object.defineProperty(globalThis, 'window', original);
        else Reflect.deleteProperty(globalThis, 'window');
    });
    const restored = await new IndexedDbChatStorageDriver().loadSessionsIndex();
    assert.equal(restored?.lastActiveSessionId, null);
    assert.equal(restored?.sessions.find(item => item.id === 'catalog-owned')?.extensionId, 'test.assistant');
    assert.equal(restored?.sessions.find(item => item.id === 'meta-owned')?.extensionId, 'other.assistant');
    assert.equal(restored?.sessions.find(item => item.id === 'orphan')?.extensionId, undefined);
});

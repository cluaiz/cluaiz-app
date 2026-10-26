import test from 'node:test';
import assert from 'node:assert/strict';
import { extensionPath, parseExtensionPath } from '../src/extensions/routes';

// Browser-owned boundaries only; the router, Zustand actions and service facade are real.
const values = new Map<string, string>();
const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
};
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage } });
const { useLayoutStore } = await import('../src/store/ui/useLayoutStore');
const { parseCurrentRoute, pushViewRoute, pushChatRoute, pushSettingsRoute } = await import('../src/core/router');
const { extensionServices } = await import('../src/extensions/services');
const { modelsApi } = await import('../src/api/engine/models/models.api');
const { chatApi } = await import('../src/api/engine/chat/chat.api');
const { audioApi } = await import('../src/api/engine/audio/audio.api');

function browser(path: string) {
    let url = new URL(path, 'https://app.example');
    const calls: Array<{ method: string; state: unknown; url: string }> = [];
    const write = (method: string) => (state: unknown, _title: string, target: string) => {
        calls.push({ method, state, url: target });
        url = new URL(target, url);
    };
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Object.defineProperty(globalThis, 'window', { configurable: true, value: {
        localStorage: storage,
        get location() { return url; },
        history: { pushState: write('push'), replaceState: write('replace') },
    } });
    return { calls, get url() { return url; }, restore: () => {
        if (previous) Object.defineProperty(globalThis, 'window', previous);
        else Reflect.deleteProperty(globalThis, 'window');
    } };
}

test('extension deep links round-trip and reject malformed or encoded identities', () => {
    const route = { extensionId: 'publisher.app-name', viewId: 'main-panel' };
    assert.equal(extensionPath(route), '/extensions/publisher.app-name/main-panel');
    assert.deepEqual(parseExtensionPath(extensionPath(route)), route);
    for (const path of ['/extensions', '/extensions/app/main', '/extensions/../main',
        '/extensions/publisher.app/%2e%2e', '/extensions/publisher.app/main/extra',
        '/extensions/publisher.app/main/', '/extensions/Publisher.app/main']) {
        assert.equal(parseExtensionPath(path), null, path);
    }
    assert.throws(() => extensionPath({ extensionId: '../app', viewId: 'main' }));
    assert.throws(() => extensionPath({ extensionId: 'publisher.app', viewId: '../main' }));
});

test('actual router restores extensions without routing invalid extension paths into other views', () => {
    for (const [path, extension] of [
        ['/extensions/publisher.app/main', { extensionId: 'publisher.app', viewId: 'main' }],
        ['/extensions', undefined], ['/extensions/invalid/notebook', undefined],
        ['/extensions/publisher.app/main/extra', undefined],
    ] as const) {
        const page = browser(path);
        try {
            const route = parseCurrentRoute();
            assert.equal(route.view, 'extensions', path);
            assert.equal(route.isSettingsOpen, false);
            assert.deepEqual(route.extension, extension);
        } finally { page.restore(); }
    }
});

test('legacy notebook, library, settings and chat deep links retain their public behavior', () => {
    const cases = [
        ['/notebook', 'notebook', false, 'general', null],
        ['/#/library', 'library', false, 'general', null],
        ['/settings?tab=security', 'chat', true, 'security', null],
        ['/settings/tools', 'tools', false, 'general', undefined],
        ['/settings/voice?c=conversation', 'chat', true, 'engine', 'conversation'],
        ['/?c=conversation', 'chat', false, 'general', 'conversation'],
    ] as const;
    for (const [path, view, settings, tab, chat] of cases) {
        const page = browser(path);
        try {
            const route = parseCurrentRoute();
            assert.equal(route.view, view, path);
            assert.equal(route.isSettingsOpen, settings, path);
            assert.equal(route.settingsTab, tab, path);
            assert.equal(route.activeChatId, chat, path);
            assert.equal(route.extension, undefined);
        } finally { page.restore(); }
    }
});

test('actual history uses selected Zustand extension and preserves legacy navigation', () => {
    const page = browser('/settings?tab=general&c=old');
    const previous = useLayoutStore.getState();
    try {
        useLayoutStore.getState().setActiveExtension({ extensionId: 'publisher.app', viewId: 'main' });
        pushViewRoute('extensions');
        assert.equal(page.url.pathname, '/extensions/publisher.app/main');
        assert.equal(page.url.search, '');
        assert.equal(page.calls.length, 1);
        pushViewRoute('extensions');
        assert.equal(page.calls.length, 1, 'same route must not duplicate history');
        useLayoutStore.getState().setActiveExtension(null);
        pushViewRoute('extensions', true);
        assert.equal(page.url.pathname, '/extensions');
        assert.equal(page.calls.at(-1)?.method, 'replace');
        pushViewRoute('notebook');
        assert.equal(page.url.pathname, '/notebook');
        pushViewRoute('library');
        assert.equal(page.url.pathname, '/library');
        pushSettingsRoute('security');
        assert.equal(page.url.pathname + page.url.search, '/settings?tab=security');
        pushChatRoute('restored', true);
        assert.equal(page.url.pathname + page.url.search, '/?c=restored');
        assert.equal(page.calls.at(-1)?.method, 'replace');
        assert.equal(page.calls.at(-1)?.state && (page.calls.at(-1)!.state as any).view, 'chat');
    } finally { useLayoutStore.setState(previous); page.restore(); }
});

test('services delegate models and isolated generation to existing adapters with the same signal', async t => {
    const signal = new AbortController().signal;
    const installed = { status: 'success', count: 0, installed: [] };
    const completion = { id: 'reply', object: 'chat.completion', created: 0, model: 'selected', choices: [] };
    const models = t.mock.method(modelsApi, 'getInstalled', async () => installed);
    const generate = t.mock.method(chatApi, 'createCompletion', async () => completion);
    assert.equal(await extensionServices.listModels(signal), installed);
    assert.deepEqual(models.mock.calls[0].arguments, [signal]);
    assert.equal(await extensionServices.generate({ model: 'selected', input: 'Current document', maxTokens: 32 }, signal), completion);
    assert.deepEqual(generate.mock.calls[0].arguments, [{ model: 'selected',
        messages: [{ role: 'user', content: 'Current document' }], max_tokens: 32,
        temporary_chat: 'strict', tools: [], tool_choice: 'none' }, signal]);
});

test('invalid generation is rejected before the domain adapter can execute', async t => {
    const adapter = t.mock.method(chatApi, 'createCompletion', async () => { throw new Error('must not execute'); });
    const signal = new AbortController().signal;
    for (const request of [null, {}, { model: '', input: 'text' }, { model: '  ', input: 'text' },
        { model: 'selected', input: '' }, { model: 'selected', input: '   ' },
        ...[0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY].map(maxTokens => ({ model: 'selected', input: 'text', maxTokens }))]) {
        await assert.rejects(extensionServices.generate(request as any, signal), /Select a model/);
    }
    assert.equal(adapter.mock.callCount(), 0);
});

test('audio delegates retain selected model, language, non-streaming contract and cancellation signal', async t => {
    const signal = new AbortController().signal;
    const audio = new Blob(['test audio'], { type: 'audio/wav' });
    const transcript = { text: 'recognized', segments: [] };
    const speech = t.mock.method(audioApi, 'speech', async () => audio);
    const transcribe = t.mock.method(audioApi, 'transcriptions', async () => transcript);
    const speechRequest = { model: 'selected-voice', input: 'Read document', voice: 'default' };
    const transcriptionRequest = { model: 'selected-recognizer', file: 'data:audio/wav;base64,YQ==', language: 'hi' };
    assert.equal(await extensionServices.speak(speechRequest, signal), audio);
    assert.deepEqual(speech.mock.calls[0].arguments, [speechRequest, signal]);
    assert.equal(await extensionServices.transcribe(transcriptionRequest, signal), transcript);
    assert.deepEqual(transcribe.mock.calls[0].arguments, [{ ...transcriptionRequest, stream: false }, signal]);
    assert.equal('stream' in transcriptionRequest, false, 'caller input must not be mutated');
});

test('adapter failures preserve their identity for the host error state', async t => {
    const failure = new Error('Engine unavailable');
    t.mock.method(modelsApi, 'getInstalled', async () => { throw failure; });
    await assert.rejects(extensionServices.listModels(new AbortController().signal), error => error === failure);
});

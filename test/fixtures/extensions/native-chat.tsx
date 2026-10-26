import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { isTauri } from '../../../src/api/client/ipc';
import { useConnectionStore } from '../../../src/store/engine/useConnectionStore';
import { useEngineStore } from '../../../src/store/engine/useEngineStore';
import { useChatStore } from '../../../src/store/chat/useChatStore';
import { chatStorageManager } from '../../../src/services/storage/ChatStorageManager';
import { EngineFsChatStorageDriver } from '../../../src/services/storage/EngineFsChatStorageDriver';
import { extensionServices } from '../../../src/extensions/services';
import { createExtensionSession } from '../../../src/extensions/sdk';
import { WorkspaceExtensionRegistry, type ExtensionViewProps } from '../../../src/extensions/registry';
import { ExtensionWorkspaceHost } from '../../../src/features/extensions/ExtensionWorkspaceHost';
import { cluaizEngine } from '../../../src/core/engine';
import { http } from '../../../src/api/client/http';
import { getCurrentWindow } from '@tauri-apps/api/window';
import '../../../src/styles/index.css';

// Real WebView, native IPC, model and disk IO. Select the existing EngineFs driver
// only in this fixture so all acceptance data stays in the disposable Engine home.
// The default Windows TauriFs storage directory is deliberately NOT certified here.
const reportUrl = new URL(location.href).searchParams.get('report');
if (!reportUrl || new URL(reportUrl).hostname !== '127.0.0.1') throw Error('Loopback report URL is required.');
(chatStorageManager as unknown as { primaryDriver: EngineFsChatStorageDriver }).primaryDriver = new EngineFsChatStorageDriver();
const browserFetch = window.fetch.bind(window);
const allowedHttpOrigins = new Set([location.origin, new URL(reportUrl).origin]);
const blockedHttp: string[] = [];
window.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), location.href);
    // Tauri's own custom IPC protocol is an OS-local bridge, not an Engine HTTP fallback.
    const tauriIpc = (url.protocol === 'ipc:' && url.hostname === 'localhost')
        || (url.protocol === 'http:' && url.hostname === 'ipc.localhost');
    if (!allowedHttpOrigins.has(url.origin) && !tauriIpc) {
        blockedHttp.push(url.pathname);
        return Promise.reject(new Error('Native acceptance blocks auxiliary browser HTTP outside its test origins.'));
    }
    return browserFetch(input, init);
};
const warnings: string[] = [];
const originalError = console.error.bind(console);
console.error = (...args) => {
    warnings.push(args.map(String).join(' '));
    originalError(...args);
};
const caps = ['chat.sessions', 'chat.send'] as const;
const state = { main: '', owned: '', expected: '', model: '', ready: false };
const savedKey = 'native-chat-acceptance';
const checks: string[] = [];
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function until(test: () => boolean, label: string, limit = 90_000) {
    const deadline = Date.now() + limit;
    while (!test()) {
        if (Date.now() >= deadline) throw Error(`Timed out: ${label}`);
        await wait(50);
    }
}
function assert(value: unknown, label: string): asserts value {
    if (!value) throw Error(label);
    checks.push(label);
}
const registry = new WorkspaceExtensionRegistry();
let boundSDK: ExtensionViewProps['sdk'] | undefined;
function View({ sdk, showChat }: ExtensionViewProps) {
    const [status, setStatus] = useState('Opening saved chat');
    useEffect(() => {
        let active = true;
        const open = sdk.chat.open(state.owned);
        void open.result.then(handle => showChat!(handle)).then(() => {
            if (active) { boundSDK = sdk; state.ready = true; setStatus('Owned saved chat bound'); }
        }).catch(error => { if (active) setStatus(String(error)); });
        return () => { active = false; open.cancel(); };
    }, [sdk, showChat]);
    return <section aria-label="Native extension"><h2>Native extension test</h2><p>{status}</p></section>;
}
registry.registerBundled({ manifest: { hub_type: 'extension', id: 'test.native-chat', name: 'Native chat test',
    host_api: 1, version: '1.0.0', capabilities: caps,
    contributes: { views: [{ id: 'main', title: 'Main', slot: 'workspace', layout: 'with-chat' }] } },
grants: caps, load: async () => ({ views: { main: View } }) });

async function submit(text: string) {
    const editor = document.querySelector<HTMLElement>('[role="textbox"]');
    if (!editor) throw Error('Shared chat input missing.');
    editor.textContent = text;
    editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    await wait(100);
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
}

async function run() {
    assert(isTauri(), 'actual Tauri WebView');
    const config = await (await fetch(`${reportUrl}/config`)).json();
    state.model = config.model;
    useConnectionStore.setState({ protocol: 'ffi' });
    await cluaizEngine.boot();
    await useEngineStore.getState().initEngineSettings();
    assert(useConnectionStore.getState().protocol === 'ffi', 'native transport selected');
    assert(useEngineStore.getState().permissions?.chat_models?.text === state.model, 'selected installed model returned by Engine');
    await useChatStore.getState().hydrateFromStorage();
    const previous = localStorage.getItem(savedKey);
    if (previous) {
        Object.assign(state, JSON.parse(previous));
        state.ready = false;
        assert(Boolean(useChatStore.getState().sessions[state.owned]), 'saved owner restored from real disk catalog');
        useChatStore.setState({ activeSessionId: state.main });
    } else {
        state.main = useChatStore.getState().createNewSession('Acceptance main chat', { activate: false });
        useChatStore.setState({ activeSessionId: state.main });
        const session = createExtensionSession(registry.get('test.native-chat')!.manifest, caps,
            extensionServices, { getItem: () => null, setItem: () => {}, removeItem: () => {} });
        state.owned = (await session.sdk.chat.create({ title: 'Acceptance extension chat' }).result).id;
        session.dispose();
    }
    createRoot(document.getElementById('root')!).render(<div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <ExtensionWorkspaceHost extensionId="test.native-chat" viewId="main" registry={registry} services={extensionServices} />
    </div>);
    await until(() => state.ready, 'owned chat binding');
    if (!previous) {
        await submit('Say hello in one short sentence.');
        await until(() => useChatStore.getState().sessions[state.owned]?.messages.length === 2, 'request admission');
        await until(() => !useChatStore.getState().streamingSessionId, 'real model completion', 180_000);
        const messages = useChatStore.getState().sessions[state.owned].messages;
        state.expected = messages[1].text;
        assert(state.expected.trim() && messages[1].finishReason !== 'error', 'real model answer streamed into shared UI');
        assert(document.body.innerText.includes(state.expected.trim()), 'model answer rendered');
        const disk = await http.post<{ content: string }>('/v1/fs/read', { path: `data/chats/${state.owned}/messages.jsonl`, caller: 'user' });
        const rows = disk.content.trim().split('\n').map(line => JSON.parse(line));
        assert(rows[1]?.text === state.expected, 'answer written through existing disk driver');
        localStorage.setItem(savedKey, JSON.stringify(state));
        await fetch(`${reportUrl}/progress`, { method: 'POST', body: JSON.stringify({ checks, phase: 'before-reload' }) });
        await getCurrentWindow().close();
        return;
    }
    const messages = useChatStore.getState().sessions[state.owned].messages;
    assert(messages[1]?.text === state.expected, 'same saved answer restored after desktop restart');
    assert(document.body.innerText.includes(state.expected.trim()), 'restored answer rendered in shared UI');
    assert(useChatStore.getState().activeSessionId === state.main, 'main selection unchanged');
    assert(useChatStore.getState().sessions[state.main].messages.length === 0, 'main messages unchanged');
    await submit('List the integers from one to one thousand, one per line.');
    await until(() => Boolean(useChatStore.getState().sessions[state.owned]?.messages[3]?.text), 'second real model first token');
    await until(() => Boolean(document.querySelector('[title="Stop generating"]')), 'owned stop button');
    (document.querySelector('[title="Stop generating"]') as HTMLButtonElement).click();
    await until(() => boundSDK!.jobs.list().some(job => job.operation === 'chat.send' && job.status === 'cancelled'), 'owned job cancellation');
    assert(useChatStore.getState().activeSessionId === state.main, 'Stop preserved main selection');
    const renderWarnings = warnings.filter(text => /Cannot update a component|while rendering a different component/.test(text));
    assert(renderWarnings.length === 0, 'no cross-component render state warning');
    await fetch(`${reportUrl}/result`, { method: 'POST', body: JSON.stringify({ passed: true, checks, warnings, blockedHttp, model: state.model }) });
    await getCurrentWindow().close();
}
void run().catch(async error => {
    const detail = error instanceof Error ? error.message : String(error);
    document.body.textContent = `Native acceptance failed: ${detail}`;
    await fetch(`${reportUrl}/result`, { method: 'POST', body: JSON.stringify({ passed: false, checks, error: detail, warnings, blockedHttp }) });
    await getCurrentWindow().close();
});

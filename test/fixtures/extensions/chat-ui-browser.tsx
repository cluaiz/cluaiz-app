import React, { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ExtensionWorkspaceHost } from '../../../src/features/extensions/ExtensionWorkspaceHost';
import { WorkspaceExtensionRegistry, type ExtensionViewProps } from '../../../src/extensions/registry';
import { extensionServices } from '../../../src/extensions/services';
import { useChatStore } from '../../../src/store/chat/useChatStore';
import { useEngineStore } from '../../../src/store/engine/useEngineStore';
import { chatStorageManager } from '../../../src/services/storage/ChatStorageManager';
import { chatApi } from '../../../src/api/engine/chat/chat.api';
import { modelsApi } from '../../../src/api/engine/models/models.api';
import { cluaizEngine } from '../../../src/core/engine';
import { ToastContainer } from '../../../src/components/ui/toast';
import '../../../src/styles/index.css';

// Browser acceptance: real host/SDK/chat store/UI; only model, filesystem and server boundaries replaced.
const stats = { subscriptions: 0, globalStops: 0, sends: 0, aborts: 0 };
for (const key of ['saveSessionsIndex', 'saveSessionMetadata', 'appendMessage', 'saveAllMessages'] as const) {
    (chatStorageManager[key] as unknown) = async () => {};
}
useChatStore.setState({ sessions: {}, activeSessionId: null, streamingSessionId: null, isHydrated: true,
    hydrateFromStorage: async () => {} });
const main = useChatStore.getState().createNewSession('Main selection', { activate: false });
useChatStore.setState({ activeSessionId: main });
useChatStore.getState().addMessage(main, { sender: 'user', text: 'MAIN CHAT SECRET', date: Date.now(), time: 'now' });
useEngineStore.setState({ permissions: { chat_models: { text: 'fixture-model' } } as any,
    initEngineSettings: async () => {}, launchOnStartup: false });
cluaizEngine.onToken = async () => { stats.subscriptions++; return () => {}; };
cluaizEngine.stop = async () => { stats.globalStops++; };
modelsApi.getInstalled = async () => ({ installed: [{ id: 'fixture-model', category: 'chat', format_type: 'gguf' }] } as any);
// Auxiliary settings/telemetry queries never touch the user's running Engine.
window.fetch = async () => new Response('{}', { status: 404, headers: { 'content-type': 'application/json' } });
let late: (() => void) | undefined;
let finish: (() => void) | undefined;
chatApi.streamCompletion = async (_payload, callbacks) => {
    stats.sends++;
    callbacks.onToken?.('OWN ANSWER');
    late = () => callbacks.onToken?.(' LATE TOKEN');
    await new Promise<void>((resolve, reject) => {
        finish = resolve;
        callbacks.signal?.addEventListener('abort', () => {
            stats.aborts++;
            reject(new DOMException('Cancelled', 'AbortError'));
        }, { once: true });
    });
};
const registry = new WorkspaceExtensionRegistry();
const caps = ['chat.sessions', 'chat.send'] as const;
function View({ sdk, showChat }: ExtensionViewProps) {
    const [status, setStatus] = useState('idle');
    async function open() {
        try {
            const handle = await sdk.chat.create({ title: 'Extension conversation' }).result;
            await showChat!(handle);
            setStatus('opened');
        } catch (error) { setStatus(String(error)); }
    }
    async function bad() {
        try { await showChat!({ id: main }); setStatus('BAD HANDLE ACCEPTED'); }
        catch (error) { setStatus(String(error)); }
    }
    return <section aria-label="Extension fixture" style={{ padding: 12 }}>
        <h2>Extension workspace</h2>
        <button onClick={open}>Open own chat</button>
        <button onClick={bad}>Try main chat handle</button>
        <p data-testid="binding-status">{status}</p>
    </section>;
}
registry.registerBundled({ manifest: { hub_type: 'extension', id: 'test.chat-ui', name: 'Chat UI', version: '1.0.0',
    host_api: 1, capabilities: caps, contributes: { views: [{ id: 'main', title: 'Main', slot: 'workspace', layout: 'with-chat' }] } },
grants: caps, load: async () => ({ views: { main: View } }) });
function Shell() {
    const [open, setOpen] = useState(true);
    const [, refresh] = useState(0);
    const selected = useChatStore(state => state.activeSessionId);
    return <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <nav style={{ padding: 8, display: 'flex', gap: 12 }}>
            <button onClick={() => setOpen(value => !value)}>Toggle workspace</button>
            <button onClick={() => { finish?.(); refresh(value => value + 1); }}>Finish model response</button>
            <button onClick={() => { late?.(); refresh(value => value + 1); }}>Emit late token</button>
            <button onClick={() => { document.dispatchEvent(new Event('start-new-chat')); refresh(value => value + 1); }}>Main new-chat event</button>
            <button onClick={() => refresh(value => value + 1)}>Refresh evidence</button>
        </nav>
        <output data-testid="evidence">{JSON.stringify({ ...stats, mainUnchanged: selected === main,
            mainMessages: useChatStore.getState().sessions[main].messages.length,
            chatCount: Object.keys(useChatStore.getState().sessions).length })}</output>
        {open && <ExtensionWorkspaceHost extensionId="test.chat-ui" viewId="main" registry={registry} services={extensionServices} />}
        <ToastContainer />
    </div>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><Shell /></StrictMode>);

import { createRoot } from 'react-dom/client';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauri } from '../../../src/api/client/ipc';
import { useConnectionStore } from '../../../src/store/engine/useConnectionStore';
import { chatStorageManager } from '../../../src/services/storage/ChatStorageManager';
import { EngineFsChatStorageDriver } from '../../../src/services/storage/EngineFsChatStorageDriver';
import { GuestWorkspaceHost } from '../../../src/features/extensions/GuestWorkspaceHost';
import { readDeveloperDocument } from '../../../src/extensions/surfaces/document';
import { ExtensionState, documentStateStorage } from '../../../src/extensions/storage';
import type { ExtensionCapability } from '../../../src/extensions/manifest';
import { extensionServices } from '../../../src/extensions/services';
import type { ExtensionServices } from '../../../src/extensions/sdk';
import { http } from '../../../src/api/client/http';
import '../../../src/styles/index.css';

// The real chat router updates history while creating/selecting a conversation.
// Reload this fixture, not that production route on the fixture-only Vite server.
const fixtureUrl = new URL(location.href);
const report = fixtureUrl.searchParams.get('report');
if (!report || !/^http:\/\/127\.0\.0\.1:\d+$/.test(report)) throw new Error('Owned report URL required.');
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const checks: string[] = [];
const serviceErrors: { operation: string; message: string }[] = [];
async function diagnose<T>(operation: string, action: () => Promise<T>): Promise<T> {
    try { return await action(); }
    catch (error) {
        serviceErrors.push({ operation, message: error instanceof Error ? error.message : String(error) });
        throw error;
    }
}
// Observe the existing adapters only in this host fixture. Keep the guest's
// sanitized error contract; never send it host diagnostics or credentials.
const liveServices: ExtensionServices = { ...extensionServices,
    listModels: signal => diagnose('models.list', () => extensionServices.listModels(signal)),
    chat: async identity => {
        const owner = await diagnose('chat.init', () => Promise.resolve(extensionServices.chat!(identity)));
        return { ...owner,
            create: (options, signal) => diagnose('chat.create', () => owner.create(options, signal)),
            open: (id, signal) => diagnose('chat.open', () => owner.open(id, signal)),
            read: (handle, signal) => diagnose('chat.read', () => owner.read(handle, signal)),
            send: (handle, request, onEvent, signal) => diagnose('chat.send', () => owner.send(handle, request, onEvent, signal)),
        };
    },
};
function assert(value: unknown, message: string): asserts value {
    if (!value) throw new Error(message);
    checks.push(message);
}
async function until<T>(read: () => T | null | undefined, message: string, limit = 180000): Promise<T> {
    const deadline = Date.now() + limit;
    while (Date.now() < deadline) { const value = read(); if (value) return value; await pause(100); }
    throw new Error('Timed out: ' + message);
}
// Same existing manager/driver as native-chat acceptance: keep all chat IO inside
// this runner's disposable Engine home, not the user's default TauriFs data path.
(chatStorageManager as unknown as { primaryDriver: EngineFsChatStorageDriver }).primaryDriver = new EngineFsChatStorageDriver();
const fetchBrowser = window.fetch.bind(window);
const allowed = new Set([location.origin, new URL(report).origin]);
const blocked: string[] = [];
window.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), location.href);
    const ipc = (url.protocol === 'ipc:' && url.hostname === 'localhost')
        || (url.protocol === 'http:' && url.hostname === 'ipc.localhost');
    if (!allowed.has(url.origin) && !ipc) {
        blocked.push(url.pathname);
        return Promise.reject(new Error('Test refuses auxiliary HTTP outside its owned origins.'));
    }
    return fetchBrowser(input, init);
};
const root = createRoot(document.getElementById('root')!);

async function run() {
    const config = await (await fetch(report + '/config')).json();
    const web = config.kind === 'web';
    assert(web ? !isTauri() : isTauri(), web ? 'actual browser host' : 'actual main Tauri App');
    const html = await (await fetch(report + '/document')).text();
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(html))))
        .map(value => value.toString(16).padStart(2, '0')).join('');
    assert(digest === config.documentDigest, 'exact independently built author artifact');
    const document = readDeveloperDocument(html);
    const state = new ExtensionState(document.contract.id, documentStateStorage(window));
    const previous = state.get('live.progress') as { main: string; owned: string; answer: string; instanceId: string } | null;
    state.remove('live.ready'); state.remove('live.error');
    if (web) {
        assert(typeof config.engineOrigin === 'string' && /^http:\/\/127\.0\.0\.1:\d+$/.test(config.engineOrigin), 'owned loopback Engine selected');
        assert(typeof config.token === 'string' && config.token.length > 0, 'test host received its temporary token');
        const engine = new URL(config.engineOrigin);
        allowed.add(engine.origin);
        useConnectionStore.setState({ protocol: 'http', host: engine.hostname, port: Number(engine.port) });
        http.setToken(config.token);
    } else useConnectionStore.setState({ protocol: 'ffi' });
    // ChatStore starts its real startup hydration when imported. Configure the
    // owned transport first, then await that hydration rather than racing it
    // with a second manual load that can replace the selected chat after reload.
    const { useChatStore } = await import('../../../src/store/chat/useChatStore');
    const { cluaizEngine } = await import('../../../src/core/engine');
    await cluaizEngine.boot();
    await until(() => useChatStore.getState().isHydrated, 'existing startup chat hydration');
    const main = previous?.main ?? useChatStore.getState().createNewSession('Acceptance main chat', { activate: false });
    useChatStore.setState({ activeSessionId: main });
    assert(Boolean(useChatStore.getState().sessions[main]), 'existing main chat available');
    const grants = document.requested as readonly ExtensionCapability[];
    root.render(<main style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <h1>Real developer extension / {web ? 'HTTP' : 'native'} Engine / saved chat</h1>
        <GuestWorkspaceHost document={document} grants={grants} services={liveServices} />
    </main>);
    type Ready = { id: string; model: string; answer: string; phase: string; restored: boolean; deltas: number;
        stopRequested: boolean; cancelled: boolean; jobCancelled: boolean; instanceId: string; kind: string;
        nativeDenied: Record<string, string>; hostStorageBlocked: boolean };
    const ready = await until(() => {
        const error = state.get('live.error');
        if (error) throw new Error(String(error));
        return state.get('live.ready') as Ready | null;
    }, 'actual guest model answer / saved history');
    assert(ready.kind === (web ? 'web' : 'desktop') && ready.model === config.model, 'actual guest SDK used the selected installed model');
    if (web) {
        assert(Object.keys(ready.nativeDenied).length === 0, 'browser guest has no native command runtime');
        assert(ready.hostStorageBlocked, 'opaque browser guest could not read host credential storage');
    } else assert(Object.keys(ready.nativeDenied).length === 2 && Object.values(ready.nativeDenied).every(value => value.includes('not allowed')),
        'guest still denied direct native Engine transport and token access');
    assert(ready.deltas > 0, 'real streamed model text crossed the actual guest bridge');
    assert(useChatStore.getState().sessions[ready.id]?.extensionId === document.contract.id, 'same App chat store owns the extension session');
    assert(useChatStore.getState().activeSessionId === main, 'main chat selection unchanged');
    assert(useChatStore.getState().sessions[main].messages.length === 0, 'main chat messages unchanged');
    await until(() => !useChatStore.getState().streamingSessionId, 'owned stream finalization');
    const disk = await http.post<{ content: string }>('/v1/fs/read', { path: `data/chats/${ready.id}/messages.jsonl`, caller: 'user' });
    const rows = disk.content.trim().split('\n').map(line => JSON.parse(line));
    assert(rows[1]?.text === ready.answer, 'actual model answer saved through the existing JSONL driver');
    if (!previous) {
        assert(ready.phase === 'created' && rows.length === 2, 'first guest run created exactly one real conversation turn');
        state.set('live.progress', { main, owned: ready.id, answer: ready.answer, instanceId: ready.instanceId });
        await fetch(report + '/progress', { method: 'POST', body: JSON.stringify({ checks, digest, phase: 'before-restart' }) });
        if (web) { root.unmount(); location.replace(fixtureUrl.href); return; }
    } else {
        assert(ready.restored && ready.id === previous.owned && ready.answer === previous.answer, 'same saved chat and answer restored after App restart');
        assert(ready.instanceId !== previous.instanceId, 'restarted guest received a new runtime identity');
        assert(ready.stopRequested && ready.cancelled && ready.jobCancelled, 'public SDK Stop cancelled its owned real model request');
        assert(rows.length === 4 && rows[3]?.finishReason === 'error', 'cancelled partial turn finalized in the existing JSONL store');
        assert(blocked.length === 0, 'no request attempted outside owned test origins');
        if (web) { http.setToken(null); assert(http.getToken() === null && localStorage.getItem('cluaiz_api_token') === null, 'host token removed after browser test'); }
        await fetch(report + '/result', { method: 'POST', body: JSON.stringify({ passed: true, checks, digest,
            model: ready.model, session: ready.id, answer: ready.answer, streamedDeltas: ready.deltas, blockedHttp: blocked,
            kind: web ? 'web' : 'desktop',
            scope: 'Actual separate developer document/public SDK/real Engine/model/chat store/EngineFs JSONL/reload/owned stop. Default TauriFs and other OSes not certified.' }) });
        if (web) {
            root.render(<main><h1>Browser extension live chat: passed</h1><p>Actual model answer: {ready.answer}</p>
                <p>Saved chat restored after reload. Owned Stop checked. Host token cleared.</p></main>);
            return;
        }
    }
    root.unmount();
    await getCurrentWindow().close();
}
void run().catch(async error => {
    http.setToken(null);
    const result = { passed: false, checks, error: String(error), serviceErrors, blockedHttp: blocked };
    root.render(<p role="alert">{result.error}</p>);
    await fetch(report + '/result', { method: 'POST', body: JSON.stringify(result) }).catch(() => {});
    if (isTauri()) await getCurrentWindow().close();
});

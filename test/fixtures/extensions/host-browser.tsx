import React, { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ExtensionWorkspaceHost } from '../../../src/features/extensions/ExtensionWorkspaceHost';
import { WorkspaceExtensionRegistry, type ExtensionViewProps } from '../../../src/extensions/registry';
import { EXTENSION_CAPABILITIES } from '../../../src/extensions/manifest';
import type { ExtensionJob } from '../../../src/extensions/jobs';
import type { ExtensionServices } from '../../../src/extensions/sdk';
import type { StateStorage } from '../../../src/extensions/storage';

// Test-only acceptance shell: real host and SDK, no Engine, models or network service.
const metrics = {
    notebookActivations: 0, notebookCleanups: 0,
    audioActivations: 0, audioCleanups: 0,
    failureActivations: 0, failureCleanups: 0,
    audioStarts: 0, audioAborts: 0, providerFinishes: 0, renderedCompletions: 0,
};
const listeners = new Set<() => void>();
const changed = () => { for (const listener of listeners) listener(); };
const pendingAudio = new Set<(value: Blob) => void>();
const state = new Map<string, string>();
const storage: StateStorage = {
    getItem: key => state.get(key) ?? null,
    setItem: (key, value) => { state.set(key, value); },
    removeItem: key => { state.delete(key); },
};
const services: ExtensionServices = {
    listModels: async () => ({ status: 'success', count: 0, installed: [] }),
    stream: async () => {},
    generate: async request => ({ id: 'acceptance', object: 'chat.completion', created: 0,
        model: request.model, choices: [] }),
    transcribe: async () => ({ text: 'Test-only transcript' }),
    speak: async (_request, signal) => {
        metrics.audioStarts++; changed();
        // Deliberately do not reject on abort: the real SDK must reject its owned job.
        const onAbort = () => { metrics.audioAborts++; changed(); };
        signal.addEventListener('abort', onAbort, { once: true });
        return new Promise<Blob>(resolve => {
            pendingAudio.add(value => {
                signal.removeEventListener('abort', onAbort);
                resolve(value);
            });
        });
    },
};

function Notebook({ sdk }: ExtensionViewProps) {
    const [count, setCount] = useState(() => {
        const saved = sdk.storage.get('counter');
        return typeof saved === 'number' ? saved : 0;
    });
    function increment() {
        const next = count + 1;
        sdk.storage.set('counter', next);
        setCount(next);
    }
    return <section aria-label="Notebook workspace">
        <h2>Notebook fixture</h2>
        <p role="status" data-testid="notebook-counter">Saved counter: {count}</p>
        <button onClick={increment}>Increment</button>
    </section>;
}

function Audio({ sdk }: ExtensionViewProps) {
    const [status, setStatus] = useState('idle');
    const current = useRef<ExtensionJob<Blob> | null>(null);
    const active = useRef(true);
    useEffect(() => {
        active.current = true;
        return () => { active.current = false; };
    }, []);
    function start() {
        const job = sdk.audio.speech({ model: 'fixture-model', input: 'Fixture audio' });
        current.current = job;
        setStatus('running');
        job.result.then(() => {
            if (!active.current || current.current !== job) return;
            metrics.renderedCompletions++; changed();
            setStatus('completed');
        }, reason => {
            if (!active.current || current.current !== job) return;
            setStatus(reason instanceof Error && reason.name === 'AbortError' ? 'cancelled' : 'failed');
        });
    }
    return <section aria-label="Audio workspace">
        <h2>Audio fixture</h2>
        <p role="status" data-testid="audio-status">Audio: {status}</p>
        <button onClick={start} disabled={status === 'running'}>Start audio</button>
        <button onClick={() => current.current?.cancel()} disabled={status !== 'running'}>Cancel</button>
    </section>;
}

function Failure(): React.ReactNode { throw new Error('Fixture render failure'); }
const registry = new WorkspaceExtensionRegistry();
function register(kind: 'notebook' | 'audio' | 'failure', View: React.ComponentType<ExtensionViewProps>) {
    registry.registerBundled({
        manifest: { hub_type: 'extension', id: `demo.${kind}`, name: `Demo ${kind}`, version: '1.0.0',
            host_api: 1, capabilities: [...EXTENSION_CAPABILITIES],
            contributes: { views: [{ id: 'main', title: kind, slot: 'workspace' }] } },
        grants: EXTENSION_CAPABILITIES,
        load: async () => ({ views: { main: View }, activate: () => {
            metrics[`${kind}Activations`]++; changed();
            return () => { metrics[`${kind}Cleanups`]++; changed(); };
        } }),
    });
}
register('notebook', Notebook);
register('audio', Audio);
register('failure', Failure);
registry.registerBundled({
    manifest: { hub_type: 'extension', id: 'demo.shared-chat', name: 'Demo shared chat', version: '1.0.0',
        host_api: 1, capabilities: ['storage.read', 'storage.write'], contributes: {
            views: [{ id: 'main', title: 'Shared chat', slot: 'workspace', layout: 'with-chat' }],
        } },
    grants: ['storage.read', 'storage.write'],
    load: async () => ({ views: { main: Notebook } }),
});

function AcceptanceShell() {
    const [selected, setSelected] = useState<string | null>('notebook');
    const [, refresh] = useState(0);
    useEffect(() => {
        const listener = () => refresh(value => value + 1);
        listeners.add(listener);
        return () => { listeners.delete(listener); };
    }, []);
    function finishAudio() {
        const completions = [...pendingAudio];
        pendingAudio.clear();
        for (const finish of completions) {
            metrics.providerFinishes++;
            finish(new Blob(['fixture-audio'], { type: 'audio/wav' }));
        }
        changed();
    }
    return <main style={{ fontFamily: 'sans-serif', maxWidth: 900, margin: '24px auto', padding: 16 }}>
        <h1>Extension host browser acceptance</h1>
        <nav aria-label="Fixture navigation" style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setSelected('notebook')}>Notebook</button>
            <button onClick={() => setSelected('audio')}>Audio</button>
            <button onClick={() => setSelected('shared-chat')}>Shared chat</button>
            <button onClick={() => setSelected('failure')}>Failure</button>
            <button onClick={() => setSelected('missing')}>Missing</button>
            <button onClick={() => setSelected(null)}>Close</button>
            <button onClick={finishAudio}>Finish audio</button>
        </nav>
        <p role="status" data-testid="selected-workspace">Selected: {selected ?? 'closed'}</p>
        <section aria-label="Lifecycle counters" data-testid="lifecycle-counters">
            {Object.entries(metrics).map(([key, value]) => <div key={key} data-testid={key}>{key}: {value}</div>)}
        </section>
        <hr />
        <section aria-label="Mounted workspace" style={{ minHeight: 150 }}>
            {selected ? <ExtensionWorkspaceHost extensionId={`demo.${selected}`} viewId="main"
                registry={registry} services={services} stateStorage={storage} />
                : <p role="status">Workspace closed</p>}
        </section>
    </main>;
}

const root = document.getElementById('root');
if (!root) throw new Error('Acceptance fixture requires #root.');
createRoot(root).render(<StrictMode><AcceptanceShell /></StrictMode>);

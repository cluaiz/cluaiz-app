import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { connectExtension, messagePortTransport, bindExtensionTheme, type ExtensionConnection } from '@cluaiz/extension-sdk/guest';
import { Button, Input, Card, CardContent } from '@cluaiz/extension-sdk/ui';
import '@cluaiz/extension-sdk/ui.css';

const root = createRoot(document.getElementById('root')!);
function View({ connection }: { connection: ExtensionConnection }) {
    const [draft, setDraft] = useState('');
    const [count, setCount] = useState(0);
    const [status, setStatus] = useState('Connected to test host');
    useEffect(() => bindExtensionTheme(connection.sdk.theme, document.documentElement), [connection]);
    async function save() {
        try { await connection.sdk.storage.set('draft', draft); setStatus('Host acknowledged save'); }
        catch (error) { setStatus(String(error)); }
    }
    async function load() {
        try { setDraft(String(await connection.sdk.storage.get('draft') ?? '')); setStatus('Read from host'); }
        catch (error) { setStatus(String(error)); }
    }
    return <main style={{ padding: '1rem', minHeight: '100vh', background: 'var(--bg-primary)',
        color: 'var(--text-primary)', fontFamily: 'var(--font-family)' }}>
        <Card data-testid="guest-card"><CardContent>
            <h2>Same SDK UI in a separate document</h2>
            <label>Guest draft<Input aria-label="Guest draft" value={draft} onChange={event => setDraft(event.target.value)} /></label>
            <Button data-testid="guest-primary" onClick={() => setCount(value => value + 1)}>Count {count}</Button>
            <Button onClick={() => void save()}>Save through bridge</Button>
            <Button onClick={() => void load()}>Read through bridge</Button>
            <Button onClick={() => { connection.close(); root.render(<p>Guest view unmounted.</p>); }}>Unmount guest view</Button>
            <p role="status">{status}</p>
        </CardContent></Card>
    </main>;
}
root.render(<p>Waiting for test-owned MessagePort.</p>);
function receive(event: MessageEvent) {
    // This fixture bootstrap is deliberately absent from production SDK/runtime code.
    if (event.source !== parent || event.origin !== location.origin || event.data !== 'cluaiz-test-port' || event.ports.length !== 1) return;
    window.removeEventListener('message', receive);
    void connectExtension(messagePortTransport(event.ports[0])).then(connection => {
        root.render(<View connection={connection} />);
        window.addEventListener('pagehide', () => connection.close(), { once: true });
    }).catch(error => root.render(<p role="alert">{String(error)}</p>));
}
window.addEventListener('message', receive);

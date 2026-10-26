import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '../../../src/core/ThemeProvider';
import { useThemeStore } from '../../../src/store/ui/useThemeStore';
import { THEMES } from '../../../src/config/themes';
import { Button, CustomDropdown } from '../../../src/extensions/ui';
import { createExtensionSession, type ExtensionServices } from '../../../src/extensions/sdk';
import { attachExtensionHost } from '../../../src/extensions/guest/host';
import { documentThemeSource } from '../../../src/extensions/guest/theme';
import { messagePortTransport } from '../../../src/extensions/guest/transport';
import '../../../src/styles/index.css';

// Test-only same-origin documents: proves channels/theme, NOT an isolation boundary.
const unused = async (): Promise<never> => { throw new Error('No model service in this fixture.'); };
const services: ExtensionServices = { listModels: unused, generate: unused, stream: unused, speak: unused, transcribe: unused };
useThemeStore.setState({ theme: 'dark', darkAccent: '#4f46e5', lightAccent: '#2563eb', fontFamily: 'mono' });
function Fixture() {
    const theme = useThemeStore(state => state.theme);
    const [writes, setWrites] = useState(0);
    const [closed, setClosed] = useState(false);
    const current = useRef<ReturnType<typeof attachExtensionHost> | null>(null);
    const values = useRef(new Map<string, string>());
    useEffect(() => () => current.current?.close(), []);
    function load(event: React.SyntheticEvent<HTMLIFrameElement>) {
        current.current?.close();
        const channel = new MessageChannel();
        const session = createExtensionSession({ hub_type: 'extension', id: 'fixture.channel', name: 'Channel fixture',
            version: '1.0.0', host_api: 1, capabilities: ['storage.read', 'storage.write'],
            contributes: { views: [{ id: 'main', title: 'Main', slot: 'workspace' }] } },
        ['storage.read', 'storage.write'], services, {
            getItem: key => values.current.get(key) ?? null,
            setItem: (key, value) => { values.current.set(key, value); setWrites(count => count + 1); },
            removeItem: key => { values.current.delete(key); },
        });
        current.current = attachExtensionHost({ transport: messagePortTransport(channel.port1), session,
            kind: 'web', supportedCapabilities: ['storage.read', 'storage.write'],
            theme: documentThemeSource(document.documentElement) });
        event.currentTarget.contentWindow!.postMessage('cluaiz-test-port', location.origin, [channel.port2]);
    }
    return <ThemeProvider><main style={{ padding: '1rem' }}>
        <h1>Guest channel and separate-document theme fixture</h1>
        <p>Test services: owned memory storage only. No Engine, downloaded runtime or native isolation certification.</p>
        <div className="max-w-xs"><span>Host theme</span><CustomDropdown value={theme}
            onChange={value => useThemeStore.getState().setTheme(value as typeof theme)}
            options={Object.entries(THEMES).map(([value, entry]) => ({ value, label: entry.name }))} /></div>
        <Button data-testid="host-primary">Host button</Button>
        <Button onClick={() => { current.current?.close(); setClosed(true); }}>Close host connection</Button>
        <p>Storage writes: <output data-testid="writes">{writes}</output>; host closed: {String(closed)}</p>
        <iframe title="Extension guest fixture" src="./guest-frame.html" onLoad={load}
            style={{ width: '100%', height: 420, border: '1px solid var(--border-color)' }} />
    </main></ThemeProvider>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);

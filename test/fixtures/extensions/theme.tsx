import React, { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '../../../src/core/ThemeProvider';
import { THEMES } from '../../../src/config/themes';
import { useThemeStore, isThemeDark } from '../../../src/store/ui/useThemeStore';
import { Button as AppButton } from '../../../src/components/ui/Button';
import { ExtensionWorkspaceHost } from '../../../src/features/extensions/ExtensionWorkspaceHost';
import { WorkspaceExtensionRegistry } from '../../../src/extensions/registry';
import {
    Button, Input, Card, CardHeader, CardTitle, CardDescription,
    CardContent, CardFooter, themeTokens,
} from '../../../src/extensions/ui';
import '../../../src/styles/index.css';

// Own origin: never open this fixture on the user's running App origin.
// Services are not called: the view requests no model/storage/chat capabilities.
useThemeStore.setState({ theme: 'dark', darkAccent: '#4f46e5', lightAccent: '#2563eb', fontFamily: 'Inter' });
function View() {
    const [count, setCount] = useState(0);
    const [draft, setDraft] = useState('');
    return <Card data-testid="mini-card">
        <CardHeader>
            <CardTitle>Extension workspace</CardTitle>
            <CardDescription>Existing App components through the private UI entry</CardDescription>
        </CardHeader>
        <CardContent style={{ display: 'grid', gap: '1rem' }}>
            <label>Local draft<Input aria-label="Local draft" value={draft} onChange={event => setDraft(event.target.value)} /></label>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <Button data-testid="mini-primary" onClick={() => setCount(value => value + 1)}>Count {count}</Button>
                <Button data-testid="mini-outline" variant="outline">Outline</Button>
                <Button data-testid="mini-disabled" disabled onClick={() => setCount(value => value + 1)}>Unavailable</Button>
            </div>
            <div data-testid="custom-panel" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                border: '1px solid var(--border-color)', borderStyle: 'var(--border-style)',
                borderRadius: 'var(--radius-card)', padding: '1rem' }}>
                Custom layout, shared colors and borders. Draft: <span data-testid="draft">{draft}</span>
            </div>
            <button data-testid="class-button" className={`${themeTokens.button.root} ${themeTokens.button.secondary} ${themeTokens.button.md}`}>
                Existing semantic CSS classes
            </button>
        </CardContent>
        <CardFooter>Changing the App theme must keep this draft and counter.</CardFooter>
    </Card>;
}
const registry = new WorkspaceExtensionRegistry();
registry.registerBundled({ manifest: { hub_type: 'extension', id: 'test.theme', name: 'Theme fixture',
    version: '1.0.0', host_api: 1, capabilities: [],
    contributes: { views: [{ id: 'main', title: 'Theme', slot: 'workspace', layout: 'full' }] } },
grants: [], load: async () => ({ views: { main: View } }) });
function Shell() {
    const theme = useThemeStore(state => state.theme);
    return <ThemeProvider><main style={{ maxWidth: '62rem', margin: '0 auto', padding: '2rem', display: 'grid', gap: '1.5rem' }}>
        <header><h1>App + extension theme</h1><p>Test fixture only; no model or user chat is opened.</p></header>
        <section aria-label="Host theme controls" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <label>App theme <select aria-label="App theme" className={themeTokens.input} value={theme}
                onChange={event => useThemeStore.getState().setTheme(event.target.value as typeof theme)}>
                {Object.entries(THEMES).map(([id, entry]) => <option key={id} value={id}>{entry.name}</option>)}
            </select></label>
            <AppButton data-testid="host-primary">Host button</AppButton>
            <AppButton variant="outline" onClick={() => {
                const state = useThemeStore.getState();
                if (isThemeDark(state.theme)) state.setDarkAccent('#0f766e');
                else state.setLightAccent('#0f766e');
            }}>Change accent</AppButton>
            <AppButton variant="outline" onClick={() => useThemeStore.getState().setFontFamily('mono')}>Use mono font</AppButton>
        </section>
        <ExtensionWorkspaceHost extensionId="test.theme" viewId="main" registry={registry} />
    </main></ThemeProvider>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><Shell /></StrictMode>);

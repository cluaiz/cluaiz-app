import React, { useEffect, type PropsWithChildren } from 'react';
import { bindExtensionTheme } from '../../../src/extensions/guest/theme';
import type { ExtensionConnection } from '../../../src/extensions/guest/contract';
import { ThemeProvider } from '../../../src/core/ThemeProvider';
import { THEMES } from '../../../src/config/themes';
import { useThemeStore } from '../../../src/store/ui/useThemeStore';
import { CustomDropdown } from '../../../src/extensions/ui';

/** Standalone is UI-only; an explicitly supplied developer connection may bind host services/theme. */
export function ExtensionPreview({ children, connection }: PropsWithChildren<{ connection?: ExtensionConnection }>) {
    if (connection) return <ConnectedPreview connection={connection}>{children}</ConnectedPreview>;
    return <DisconnectedPreview>{children}</DisconnectedPreview>;
}
function ConnectedPreview({ children, connection }: PropsWithChildren<{ connection: ExtensionConnection }>) {
    useEffect(() => bindExtensionTheme(connection.sdk.theme, document.documentElement), [connection]);
    return <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'var(--font-family)' }}>
        <aside style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
            <strong>Cluaiz — developer connection ({connection.sdk.host.kind})</strong>
            <p>A host supplied this connection. This is not an installed extension or platform certification.</p>
        </aside>
        {children}
    </div>;
}
function DisconnectedPreview({ children }: PropsWithChildren) {
    const theme = useThemeStore(state => state.theme);
    return <ThemeProvider>
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        <aside style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
            <strong>Cluaiz — UI-only developer preview</strong>
            <p>App services are not connected. This page is not an installed extension.</p>
            <div className="max-w-xs"><span>Preview theme</span><CustomDropdown value={theme}
                onChange={value => useThemeStore.getState().setTheme(value as typeof theme)}
                options={Object.entries(THEMES).map(([value, entry]) => ({ value, label: entry.name }))} /></div>
        </aside>
        {children}
        </div>
    </ThemeProvider>;
}

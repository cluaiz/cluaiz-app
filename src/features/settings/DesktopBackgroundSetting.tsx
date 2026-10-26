import { useState, useSyncExternalStore } from 'react';
import { desktopLifecycle, desktopLifecycleAPI } from '../../core/desktopLifecycle';
import { SettingItem } from './SharedComponents';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { Button } from '../../components/ui/Button';

export function DesktopBackgroundSetting() {
    const [quitError, setQuitError] = useState('');
    const state = useSyncExternalStore(desktopLifecycle.subscribe, desktopLifecycle.getSnapshot, desktopLifecycle.getSnapshot);
    return <section aria-label="Desktop background settings">
        <SettingItem label="Run in background" description={state.available
            ? 'Closing the main window keeps Cluaiz and its active extensions running. Restore or quit from the tray.'
            : 'Available in the desktop App. Closing a browser tab ends this App session.'}
            toggle active={state.enabled} disabled={!state.available || !state.trayReady || !state.ready} loading={state.busy}
            onToggle={() => { void desktopLifecycle.setEnabled(!state.enabled).catch(() => {}); }} />
        {state.error && <div className="p-4 space-y-2"><AlertBanner variant="warning" title="Background mode unavailable" message={state.error} />
            <Button size="sm" disabled={state.busy} onClick={() => { void desktopLifecycle.initialize().catch(() => {}); }}>Retry</Button></div>}
        {state.available && <div className="p-4"><Button variant="outline" onClick={() => {
            setQuitError(''); void desktopLifecycleAPI.quit().catch(error => setQuitError(String(error)));
        }}>Quit Cluaiz</Button></div>}
        {quitError && <p role="alert" className="px-4 pb-4 text-sm">Could not quit Cluaiz: {quitError}</p>}
    </section>;
}

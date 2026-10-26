import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '../api/client/ipc';

export const BACKGROUND_PREFERENCE = 'cluaiz_run_background';
export interface DesktopStatus { backgroundEnabled: boolean; trayReady: boolean; mainVisible: boolean; quitting: boolean; error: string | null; }
export interface DesktopLifecycleAPI {
    status(): Promise<DesktopStatus>;
    configure(enabled: boolean): Promise<DesktopStatus>;
    show(): Promise<void>;
    quit(): Promise<void>;
}
export const desktopLifecycleAPI: DesktopLifecycleAPI = {
    status: () => invoke('desktop_lifecycle_status'), configure: enabled => invoke('desktop_set_background', { enabled }),
    show: () => invoke('desktop_show_main'), quit: () => invoke('desktop_quit'),
};
interface State { available: boolean; ready: boolean; busy: boolean; enabled: boolean; trayReady: boolean; error: string; }
type Preferences = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
/** Existing browser-profile preference remains the only persisted owner. */
export class DesktopLifecycleController {
    private state: State;
    private listeners = new Set<() => void>();
    private initializing: Promise<void> | null = null;
    constructor(private readonly api: DesktopLifecycleAPI, private readonly preferences: () => Preferences, private readonly supported: boolean) {
        this.state = Object.freeze({ available: supported, ready: false, busy: false, enabled: false, trayReady: false, error: '' });
    }
    getSnapshot = () => this.state;
    subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
    private publish(change: Partial<State>) { this.state = Object.freeze({ ...this.state, ...change }); for (const listener of this.listeners) listener(); }
    initialize(): Promise<void> {
        if (!this.supported) { this.publish({ ready: true, available: false }); return Promise.resolve(); }
        if (this.initializing) return this.initializing;
        this.initializing = this.load().finally(() => { this.initializing = null; });
        return this.initializing;
    }
    private async load() {
        this.publish({ busy: true, error: '' });
        let available = false;
        try {
            const status = await this.api.status();
            available = true;
            this.publish({ available: true, trayReady: status.trayReady, enabled: status.backgroundEnabled });
            const raw = this.preferences().getItem(BACKGROUND_PREFERENCE);
            const enabled = raw === null || raw === 'true'; // Existing default, only after native sync.
            const applied = await this.api.configure(enabled);
            this.publish({ enabled: applied.backgroundEnabled, trayReady: applied.trayReady });
        } catch (error) { this.publish({ available, error: String(error) }); throw error; }
        finally { this.publish({ ready: true, busy: false }); }
    }
    async setEnabled(enabled: boolean) {
        if (!this.supported || !this.state.available) throw Error('Background mode requires the desktop App.');
        if (!this.state.ready || this.state.busy) throw Error('Desktop settings are still synchronizing.');
        this.publish({ busy: true, error: '' });
        let storage: Preferences | undefined, previous: string | null = null, written = false;
        try {
            storage = this.preferences(); previous = storage.getItem(BACKGROUND_PREFERENCE);
            storage.setItem(BACKGROUND_PREFERENCE, String(enabled)); written = true;
            const applied = await this.api.configure(enabled);
            if (applied.backgroundEnabled !== enabled) throw Error('Native background policy did not acknowledge the setting.');
            this.publish({ enabled: applied.backgroundEnabled, trayReady: applied.trayReady });
        } catch (error) {
            let message = String(error);
            if (written && storage) {
                try { if (previous === null) storage.removeItem(BACKGROUND_PREFERENCE); else storage.setItem(BACKGROUND_PREFERENCE, previous); }
                catch (rollback) { message += '; preference rollback failed: ' + String(rollback); }
            }
            this.publish({ error: message }); throw Error(message);
        } finally { this.publish({ busy: false }); }
    }
}
export const desktopLifecycle = new DesktopLifecycleController(desktopLifecycleAPI, () => window.localStorage, isTauri());

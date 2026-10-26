import type { ExtensionRoute } from './routes';
import { validExtensionId, validViewId } from './validation';

export interface ExtensionActivity extends ExtensionRoute {
    readonly id: string;
    readonly status: 'running' | 'failed';
    readonly error?: string;
}
export const MAX_EXTENSION_ACTIVITIES = 3;
/** Host presentation requests only; admission/services stay in their existing owners. */
export class ExtensionActivitiesStore {
    private entries: readonly ExtensionActivity[] = Object.freeze([]);
    private listeners = new Set<() => void>();
    getSnapshot = () => this.entries;
    subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
    open(route: ExtensionRoute) {
        if (!validExtensionId(route.extensionId) || !validViewId(route.viewId)) throw Error('Invalid extension activity route.');
        if (this.entries.some(entry => entry.extensionId === route.extensionId && entry.viewId === route.viewId)) throw Error('This floating extension is already open. Close it before reopening.');
        if (this.entries.length >= MAX_EXTENSION_ACTIVITIES) throw Error('Close a floating extension before opening another.');
        const entry = Object.freeze({ ...route, id: crypto.randomUUID(), status: 'running' as const });
        this.publish([...this.entries, entry]); return entry.id;
    }
    stop(id: string) { this.publish(this.entries.filter(entry => entry.id !== id)); }
    fail(id: string, error: string) {
        this.publish(this.entries.map(entry => entry.id === id ? Object.freeze({ ...entry, status: 'failed' as const, error }) : entry));
    }
    private publish(entries: readonly ExtensionActivity[]) {
        if (entries.length === this.entries.length && entries.every((entry, index) => entry === this.entries[index])) return;
        this.entries = Object.freeze(entries);
        for (const listener of this.listeners) listener();
    }
}
export const extensionActivities = new ExtensionActivitiesStore();

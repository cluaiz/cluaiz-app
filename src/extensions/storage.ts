/** Small owned JSON state, separate from package files and existing chat/notebook assets. */
export interface StateStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}
/** Lazy access preserves real unavailable/quota errors and the existing state owner. */
export function documentStateStorage(view: Window): StateStorage {
    return {
        getItem: key => view.localStorage.getItem(key),
        setItem: (key, value) => view.localStorage.setItem(key, value),
        removeItem: key => view.localStorage.removeItem(key),
    };
}
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export const EXTENSION_STATE_LIMIT_BYTES = 1024 * 1024;
const encoder = new TextEncoder();

export class ExtensionState {
    private readonly prefix: string;
    constructor(id: string, private readonly storage: StateStorage) {
        // Encoding both ID and key creates an unambiguous namespace; version is intentionally absent.
        this.prefix = `cluaiz-extension-state:${encodeURIComponent(id)}:`;
    }
    private key(key: string) {
        if (!key || key.length > 160 || /[\u0000-\u001f]/.test(key)) throw new Error('Invalid extension state key.');
        return this.prefix + encodeURIComponent(key);
    }
    get(key: string): JsonValue | null {
        const raw = this.storage.getItem(this.key(key));
        if (raw === null) return null;
        if (encoder.encode(raw).byteLength > EXTENSION_STATE_LIMIT_BYTES) throw new Error('Stored extension state exceeds the supported size.');
        try { return JSON.parse(raw); } catch { throw new Error('Stored extension state is not valid JSON.'); }
    }
    set(key: string, value: JsonValue): void {
        const serialized = JSON.stringify(value);
        if (serialized === undefined || encoder.encode(serialized).byteLength > EXTENSION_STATE_LIMIT_BYTES) {
            throw new Error('Extension state must be JSON within the supported size.');
        }
        // Do not swallow unavailable storage/quota errors or claim the state was saved.
        this.storage.setItem(this.key(key), serialized);
    }
    remove(key: string): void { this.storage.removeItem(this.key(key)); }
}

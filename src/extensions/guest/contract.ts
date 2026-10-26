/** Portable guest API. A transport must be issued by a separately verified host surface. */
import type { ExtensionSDK, ExtensionChatHandle } from '../client';
import type { ExtensionCapability } from '../manifest';
import type { JsonValue } from '../storage';
import type { GuestTheme } from './theme';

export interface GuestHost {
    readonly kind: 'web' | 'desktop';
    readonly identity: ExtensionSDK['identity'];
    /** Implemented adapters, not a promise that an Engine/model is currently online. */
    readonly supportedCapabilities: readonly ExtensionCapability[];
    readonly grantedCapabilities: readonly ExtensionCapability[];
}
export interface GuestExtensionSDK extends Omit<ExtensionSDK, 'host' | 'storage' | 'grantedCapabilities'> {
    readonly host: GuestHost;
    readonly grantedCapabilities: readonly ExtensionCapability[];
    readonly storage: Readonly<{
        get(key: string): Promise<JsonValue | null>;
        set(key: string, value: JsonValue): Promise<void>;
        remove(key: string): Promise<void>;
    }>;
    readonly theme: Readonly<{
        current(): GuestTheme | null;
        subscribe(listener: (theme: GuestTheme) => void): () => void;
    }>;
}
export interface ExtensionConnection {
    readonly sdk: GuestExtensionSDK;
    close(): void;
}
/** Host-only wire reference; public chat callers still receive an opaque object handle. */
export interface GuestChatReference extends ExtensionChatHandle { readonly token: string; }
export type GuestErrorCode = 'PROTOCOL' | 'CLOSED' | 'DENIED' | 'UNAVAILABLE' | 'INVALID_REQUEST' | 'SERVICE_FAILED';
export class ExtensionError extends Error {
    constructor(readonly code: GuestErrorCode) {
        super({
            PROTOCOL: 'Extension connection protocol is invalid or incompatible.',
            CLOSED: 'Extension connection is closed.',
            DENIED: 'This extension capability or handle was not granted.',
            UNAVAILABLE: 'The requested service is unavailable in this host.',
            INVALID_REQUEST: 'Invalid extension request.',
            SERVICE_FAILED: 'The host service request failed.',
        }[code]);
        this.name = 'ExtensionError';
    }
}

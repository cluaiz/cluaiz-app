import type { ExtensionManifest } from './manifest';

const INSTANCE_ID_BYTES = 16; // 128 bits of host-minted instance entropy.

/** Client runtime ownership only; this ID is not an Engine credential or sandbox principal. */
export function createExtensionIdentity(manifest: ExtensionManifest) {
    if (typeof globalThis.crypto?.getRandomValues !== 'function') throw new Error('Secure random source is unavailable for extension instance identity.');
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(INSTANCE_ID_BYTES));
    const instanceId = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
    return Object.freeze({ id: manifest.id, version: manifest.version, hostApi: manifest.host_api, instanceId });
}

import { invoke } from '@tauri-apps/api/core';
import type { PackageStorage, InstalledExtensionRecord, StoredExtension } from './records';

/** Host-only native commands; no endpoint, credential or path is supplied by a guest. */
export function createNativePackageStorage(invokeCommand: typeof invoke = invoke): PackageStorage {
    // Notifications may make the list and workspace re-read simultaneously.
    // Serialize this host's short operations; the OS lock/CAS still arbitrates
    // different App processes. A rejected call must not poison the next one.
    let tail = Promise.resolve();
    function run<T>(action: () => Promise<T>) {
        const result = tail.then(action);
        tail = result.then(() => {}, () => {});
        return result;
    }
    return {
        list: () => run(() => invokeCommand<InstalledExtensionRecord[]>('extension_packages_list')),
        read: id => run(() => invokeCommand<StoredExtension | null>('extension_package_read', { id })),
        commit: (id, expected, next) => run(() => invokeCommand<void>('extension_package_commit', { id, expected, next })),
    };
}
export const nativePackageStorage = createNativePackageStorage();

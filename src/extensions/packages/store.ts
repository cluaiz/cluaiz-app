import { isTauri } from '../../api/client/ipc';
import { workspaceExtensions } from '../bundled';
import { validExtensionId } from '../validation';
import { readDeveloperDocument } from '../surfaces/document';
import { BrowserPackageStorage } from './browser';
import { nativePackageStorage } from './native';
import { validateInstalledRecord, validatePackageGrants, INSTALLED_EXTENSION_LIMIT,
    type PackageStorage, type InstalledExtensionRecord, type StoredExtension } from './records';
import { documentBytes, sha256, type PreparedExtensionPackage } from './admission';
import type { ExtensionCapability } from '../manifest';

export class InstalledExtensionStore {
    constructor(private readonly storage: PackageStorage) {}
    async list() {
        const values = await this.storage.list();
        if (values.length > INSTALLED_EXTENSION_LIMIT) throw new Error('Installed extension catalog exceeds its limit.');
        return values.map(validateInstalledRecord);
    }
    async read(id: string) {
        if (!validExtensionId(id) || workspaceExtensions.get(id)) throw new Error('Invalid or bundled extension package ID.');
        const saved = await this.storage.read(id);
        if (!saved) return null;
        const record = validateInstalledRecord(saved.record);
        if (record.id !== id || typeof saved.html !== 'string' || await sha256(documentBytes(saved.html)) !== record.documentHash) throw new Error('Installed extension integrity check failed.');
        const document = readDeveloperDocument(saved.html);
        if (document.contract.id !== id || document.contract.version !== record.version || document.contract.name !== record.name) throw new Error('Installed extension metadata does not match its receipt.');
        validatePackageGrants(document, record.grants);
        return { record, document };
    }
    async install(prepared: PreparedExtensionPackage, grants: readonly ExtensionCapability[], expected: string | null) {
        const { document } = prepared;
        if (workspaceExtensions.get(document.contract.id)) throw new Error('Bundled extensions cannot be replaced by an imported package.');
        validatePackageGrants(document, grants);
        const current = await this.read(document.contract.id);
        if ((current?.record.revision ?? null) !== expected) throw new Error('Extension changed since this package was inspected. Inspect it again.');
        if (current && current.record.version === document.contract.version) throw new Error('This version is already installed. Build a new version before updating.');
        if (await sha256(documentBytes(document.html)) !== prepared.documentHash) throw new Error('Prepared extension bytes changed.');
        const now = Date.now();
        const record = validateInstalledRecord({ id: document.contract.id, name: document.contract.name, version: document.contract.version,
            documentHash: prepared.documentHash, packageHash: prepared.packageHash, revision: crypto.randomUUID(),
            grants: [...grants], enabled: true, installedAt: current?.record.installedAt ?? now, updatedAt: now });
        await this.storage.commit(record.id, expected, { record, html: document.html });
        this.changed(record.id);
        return record;
    }
    async configure(id: string, expected: string, grants: readonly ExtensionCapability[], enabled: boolean) {
        const current = await this.read(id);
        if (!current || current.record.revision !== expected) throw new Error('Extension changed. Refresh before editing its permissions.');
        validatePackageGrants(current.document, grants);
        const record = { ...current.record, grants: [...grants], enabled, updatedAt: Date.now(), revision: crypto.randomUUID() };
        await this.storage.commit(id, expected, { record, html: current.document.html });
        this.changed(id);
    }
    async uninstall(id: string, expected: string) {
        if (!validExtensionId(id) || workspaceExtensions.get(id)) throw new Error('Bundled extensions cannot be uninstalled here.');
        await this.storage.commit(id, expected, null);
        this.changed(id);
    }
    private changed(id: string) {
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cluaiz-extensions-changed', { detail: id }));
        // This notification contains no package bytes, permission state or credentials.
        if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
            const channel = new BroadcastChannel('cluaiz-extension-packages'); channel.postMessage({ type: 'changed', id }); channel.close();
        }
    }
    subscribe(listener: (id?: string) => void): () => void {
        if (typeof window === 'undefined') return () => {};
        const receive = (event: Event) => { const id = (event as CustomEvent).detail; listener(validExtensionId(id) ? id : undefined); };
        window.addEventListener('cluaiz-extensions-changed', receive);
        const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('cluaiz-extension-packages');
        if (channel) channel.onmessage = event => listener(validExtensionId(event.data?.id) ? event.data.id : undefined);
        return () => { window.removeEventListener('cluaiz-extensions-changed', receive); channel?.close(); };
    }
}
export const installedExtensions = new InstalledExtensionStore(isTauri() ? nativePackageStorage : new BrowserPackageStorage());
export type { InstalledExtensionRecord, StoredExtension };

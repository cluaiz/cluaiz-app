import { EXTENSION_CAPABILITIES, type ExtensionCapability } from '../manifest';
import { contractRecord, validExtensionId, validReleaseVersion } from '../validation';
import type { DeveloperDocument } from '../surfaces/document';

export const INSTALLED_EXTENSION_LIMIT = 128;
export interface InstalledExtensionRecord {
    id: string;
    name: string;
    version: string;
    packageHash: string;
    documentHash: string;
    revision: string;
    grants: readonly ExtensionCapability[];
    enabled: boolean;
    installedAt: number;
    updatedAt: number;
}
export interface StoredExtension { record: InstalledExtensionRecord; html: string; }
export interface PackageStorage {
    list(): Promise<InstalledExtensionRecord[]>;
    read(id: string): Promise<StoredExtension | null>;
    commit(id: string, expected: string | null, next: StoredExtension | null): Promise<void>;
}
export function validateInstalledRecord(input: unknown): InstalledExtensionRecord {
    const value = contractRecord(input);
    if (!validExtensionId(value.id) || !validReleaseVersion(value.version)
        || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 120
        || typeof value.enabled !== 'boolean' || !Array.isArray(value.grants)
        || value.grants.some(item => !EXTENSION_CAPABILITIES.includes(item)) || new Set(value.grants).size !== value.grants.length
        || !['packageHash', 'documentHash'].every(key => typeof value[key] === 'string' && /^[a-f0-9]{64}$/.test(value[key] as string))
        || typeof value.revision !== 'string' || !/^[a-f0-9-]{36}$/.test(value.revision)
        || !['installedAt', 'updatedAt'].every(key => Number.isSafeInteger(value[key]) && (value[key] as number) > 0)) throw new Error('Installed extension record is invalid.');
    return { id: value.id, name: value.name, version: value.version, packageHash: value.packageHash as string,
        documentHash: value.documentHash as string, revision: value.revision, grants: Object.freeze([...value.grants]),
        enabled: value.enabled, installedAt: value.installedAt as number, updatedAt: value.updatedAt as number };
}
export function validatePackageGrants(document: DeveloperDocument, grants: readonly ExtensionCapability[]) {
    if (new Set(grants).size !== grants.length || grants.some(cap => !document.requested.includes(cap))
        || document.contract.capabilities.required.some(cap => !grants.includes(cap as ExtensionCapability))) throw new Error('Required or requested extension permissions do not match the approved grants.');
}

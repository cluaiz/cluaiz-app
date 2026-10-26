import { validateExtensionContract, EXTENSION_DOCUMENT_LIMIT_BYTES } from '../contract';
import { contractRecord, packageEntry } from '../validation';
import { readDeveloperDocument, type DeveloperDocument } from '../surfaces/document';
import { readPackageArchive, PACKAGE_FILE_LIMIT } from './archive';

export interface PreparedExtensionPackage {
    readonly document: DeveloperDocument;
    readonly packageHash: string;
    readonly documentHash: string;
}
export async function sha256(bytes: Uint8Array): Promise<string> {
    const result = await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>);
    return Array.from(new Uint8Array(result), value => value.toString(16).padStart(2, '0')).join('');
}
export const documentBytes = (text: string) => new TextEncoder().encode(text);
function jsonFile(files: ReadonlyMap<string, Uint8Array>, name: string): Record<string, unknown> {
    const bytes = files.get(name);
    if (!bytes || bytes.length > 256 * 1024) throw new Error('Missing or oversized ' + name);
    return contractRecord(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
}
/** Validate all bytes while inert. A valid digest is integrity, not publisher identity. */
export async function inspectExtensionPackage(blob: Blob): Promise<PreparedExtensionPackage> {
    const files = await readPackageArchive(blob);
    const pkg = jsonFile(files, 'package.json');
    const manifest = validateExtensionContract(pkg.app);
    if (pkg.hub_type !== 'extension' || pkg.version !== manifest.version) throw new Error('Package and extension identity/version disagree.');
    const inventory = jsonFile(files, 'inventory.json');
    if (inventory.schema_version !== 1 || inventory.algorithm !== 'sha256' || inventory.id !== manifest.id
        || inventory.version !== manifest.version || !Array.isArray(inventory.files)
        || !inventory.files.length || inventory.files.length > PACKAGE_FILE_LIMIT) throw new Error('Invalid package inventory.');
    const declared = new Set<string>();
    for (const item of inventory.files) {
        const entry = contractRecord(item);
        const path = packageEntry(entry.path);
        const bytes = files.get(path);
        if (path === 'inventory.json' || declared.has(path) || !bytes
            || !Number.isSafeInteger(entry.bytes) || entry.bytes !== bytes.length
            || typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256)
            || await sha256(bytes) !== entry.sha256) throw new Error('Package inventory verification failed: ' + path);
        declared.add(path);
    }
    if (!declared.has('package.json') || files.size !== declared.size + 1) throw new Error('Package contains unlisted files.');
    const bytes = manifest.runtime.entry && files.get(manifest.runtime.entry);
    if (!bytes || bytes.length > EXTENSION_DOCUMENT_LIMIT_BYTES) throw new Error('Declared extension document is missing or too large.');
    const html = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const document = readDeveloperDocument(html);
    if (JSON.stringify(manifest) !== JSON.stringify(document.contract)) throw new Error('Embedded extension metadata differs from package metadata.');
    return Object.freeze({ document, documentHash: await sha256(documentBytes(html)),
        packageHash: await sha256(new Uint8Array(await blob.arrayBuffer())) });
}

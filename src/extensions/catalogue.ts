import { validateExtensionContract } from './contract';
import { contractRecord as record, contractText as text, packageEntry,
    validExtensionId, validLegacyId, validReleaseVersion } from './validation';

export interface CatalogueSelection { version: string; canonicalId: string; }

/** Pure metadata adapter. No fetch, extraction, code loading, host grants or trust assignment. */
export function resolveCatalogueContract(input: unknown, selection: CatalogueSelection) {
    const catalogue = record(input);
    if (catalogue.hub_type !== 'extension') throw new Error('Catalogue package is not an App extension.');
    const catalogueId = text(catalogue.id, 'catalogue id');
    if (!validExtensionId(catalogueId) && !validLegacyId(catalogueId)) throw new Error('Invalid catalogue identity.');
    if (!selection || !validReleaseVersion(selection.version) || !validExtensionId(selection.canonicalId)) {
        throw new Error('Select an exact release and an explicit canonical extension identity.');
    }
    if (validExtensionId(catalogueId) && catalogueId !== selection.canonicalId) throw new Error('Catalogue canonical identity conflicts with host mapping.');
    const versions = record(catalogue.versions);
    if (!Object.prototype.hasOwnProperty.call(versions, selection.version)) throw new Error('Selected catalogue release is unavailable.');
    const release = record(versions[selection.version]);
    if (!Object.prototype.hasOwnProperty.call(release, 'app')) throw new Error('Extension runtime metadata is incomplete for this release.');
    const contract = validateExtensionContract(release.app);
    if (contract.id !== selection.canonicalId || contract.version !== selection.version) throw new Error('Runtime identity or release conflicts with selected catalogue metadata.');
    if (contract.runtime.kind === 'bundled') throw new Error('Catalogue metadata cannot claim bundled executable provenance.');
    const entry = packageEntry(record(release.files).entry);
    if (entry !== contract.runtime.entry) throw new Error('Catalogue and runtime entry declarations conflict.');
    return Object.freeze({ catalogueId, contract,
        ...(catalogueId !== contract.id ? { legacyAlias: catalogueId } : {}) });
}

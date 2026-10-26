import type { ComponentType } from 'react';
import { validateExtensionManifest, type ExtensionCapability, type ExtensionManifest } from './manifest';
import type { ExtensionSDK, ExtensionViewProps } from './client';
export type { ExtensionViewProps } from './client';
import { adaptBundledManifest, type ExtensionContract } from './contract';
import { EXTENSION_HOST, inspectExtensionContract } from './compatibility';
import { resolveCatalogueContract, type CatalogueSelection } from './catalogue';
import { validLegacyId } from './validation';
export interface ExtensionModule {
    views: Readonly<Record<string, ComponentType<ExtensionViewProps>>>;
    activate?(sdk: ExtensionSDK): void | (() => void) | Promise<void | (() => void)>;
}
export interface BundledExtension {
    manifest: ExtensionManifest;
    contract: ExtensionContract;
    grants: readonly ExtensionCapability[];
    load(): Promise<ExtensionModule>;
}

/** Only the App composition root supplies executable loaders. Never deserialize one from a package. */
export class WorkspaceExtensionRegistry {
    private readonly entries = new Map<string, BundledExtension>();
    private readonly aliases = new Map<string, string>();
    readonly host = EXTENSION_HOST;
    registerBundled(input: { manifest: unknown; aliases?: readonly string[]; grants: readonly ExtensionCapability[]; load: BundledExtension['load'] }): void {
        const manifest = validateExtensionManifest(input.manifest);
        if (this.entries.has(manifest.id)) throw new Error(`Duplicate extension: ${manifest.id}`);
        if (typeof input.load !== 'function') throw new Error('A bundled extension loader is required.');
        if (!Array.isArray(input.grants) || input.grants.some(cap => !manifest.capabilities.includes(cap))) throw new Error('Host grant was not requested by the extension.');
        const contract = adaptBundledManifest(manifest);
        if (!inspectExtensionContract(contract).compatible) throw new Error('Bundled extension contract is incompatible.');
        const aliases = input.aliases === undefined ? [] : input.aliases;
        if (!Array.isArray(aliases) || new Set(aliases).size !== aliases.length
            || aliases.some(alias => !validLegacyId(alias) || this.aliases.has(alias))) {
            throw new Error('Invalid, duplicate or conflicting legacy extension alias.');
        }
        this.entries.set(manifest.id, Object.freeze({ manifest, contract, grants: Object.freeze([...input.grants]), load: input.load }));
        for (const alias of aliases) this.aliases.set(alias, manifest.id);
    }
    get(id: string): BundledExtension | undefined { return this.entries.get(this.aliases.get(id) || id); }
    list(): readonly ExtensionManifest[] { return [...this.entries.values()].map(entry => entry.manifest); }
    inspectCatalogue(input: unknown, selection: CatalogueSelection) {
        const metadata = resolveCatalogueContract(input, selection);
        const bound = this.aliases.get(metadata.catalogueId);
        if (bound && bound !== metadata.contract.id) throw new Error('Catalogue identity conflicts with registered host alias.');
        return Object.freeze({ ...metadata, compatibility: inspectExtensionContract(metadata.contract) });
    }
    async loadView(id: string, viewId: string): Promise<{ entry: BundledExtension; module: ExtensionModule; View: ComponentType<ExtensionViewProps> }> {
        const entry = this.get(id);
        if (!entry || !entry.manifest.contributes.views.some(view => view.id === viewId)) throw new Error('Workspace extension or view is unavailable.');
        const module = await entry.load();
        const View = module.views && Object.prototype.hasOwnProperty.call(module.views, viewId) ? module.views[viewId] : undefined;
        if (typeof View !== 'function' && (typeof View !== 'object' || View === null)) throw new Error('Extension did not provide its declared workspace view.');
        return { entry, module, View };
    }
    registerDownloaded(_manifest: unknown): never {
        throw new Error('Downloaded executable extensions are not supported by this host yet. An isolated runtime and Engine-scoped identity are required.');
    }
}

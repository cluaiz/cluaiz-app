import { validateExtensionManifest, type ExtensionManifest } from './manifest';
import { contractRecord as record, contractText as text, MAX_DECLARED_CAPABILITIES,
    MAX_EXTENSION_VIEWS, packageEntry, validExtensionId, validReleaseVersion, validViewId } from './validation';

export const EXTENSION_SCHEMA_VERSION = 1;
export const EXTENSION_DOCUMENT_LIMIT_BYTES = 16 * 1024 * 1024;
export const RUNTIME_PROFILES = ['bundled', 'webview', 'native-worker', 'wasm'] as const;
export const VIEW_SURFACES = ['workspace', 'panel', 'floating', 'native-window', 'settings'] as const;
export interface ExtensionViewContract {
    id: string; title: string; surface: typeof VIEW_SURFACES[number]; layout?: 'full' | 'with-chat';
}
export interface ExtensionContract {
    schema_version: typeof EXTENSION_SCHEMA_VERSION;
    hub_type: 'extension'; id: string; name: string; version: string;
    host_api: Readonly<{ min: number; max: number }>;
    runtime: Readonly<{ kind: typeof RUNTIME_PROFILES[number]; entry?: string }>;
    activation: 'on-demand' | 'background';
    capabilities: Readonly<{ required: readonly string[]; optional: readonly string[] }>;
    contributes: Readonly<{ views: readonly ExtensionViewContract[] }>;
}

function capabilities(input: unknown): readonly string[] {
    if (!Array.isArray(input) || input.length > MAX_DECLARED_CAPABILITIES) throw new Error('Invalid extension capabilities.');
    const values = input.map(value => text(value, 'capability'));
    if (values.some(value => value !== value.trim() || !/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+$/.test(value))
        || new Set(values).size !== values.length) throw new Error('Invalid or duplicate extension capability.');
    return Object.freeze(values);
}

/** Metadata only: profiles/surfaces listed in the schema are not a host support promise. */
export function validateExtensionContract(input: unknown): ExtensionContract {
    const data = record(input);
    if (data.schema_version !== EXTENSION_SCHEMA_VERSION) throw new Error('Unsupported extension schema version.');
    if (data.hub_type !== 'extension') throw new Error('This package is not an App extension.');
    const id = text(data.id, 'id');
    if (!validExtensionId(id)) throw new Error('Extension ID must be publisher.app-name.');
    const name = text(data.name, 'name');
    const version = text(data.version, 'version', 60);
    if (!validReleaseVersion(version)) throw new Error('Invalid extension release version.');
    const api = record(data.host_api);
    if (!Number.isSafeInteger(api.min) || !Number.isSafeInteger(api.max)
        || (api.min as number) <= 0 || (api.max as number) < (api.min as number)) throw new Error('Invalid host API range.');
    const runtime = record(data.runtime);
    if (!RUNTIME_PROFILES.includes(runtime.kind as typeof RUNTIME_PROFILES[number])) throw new Error('Unknown extension runtime profile.');
    const kind = runtime.kind as typeof RUNTIME_PROFILES[number];
    if (kind === 'bundled' && runtime.entry !== undefined) throw new Error('Bundled entries come from compiled host registration.');
    const entry = kind === 'bundled' ? undefined : packageEntry(runtime.entry);
    if (data.activation !== 'on-demand' && data.activation !== 'background') throw new Error('Unknown extension activation mode.');
    const requested = record(data.capabilities);
    const required = capabilities(requested.required);
    const optional = capabilities(requested.optional);
    if (required.some(cap => optional.includes(cap))) throw new Error('Required and optional capabilities must be distinct.');
    const contributions = record(data.contributes);
    if (!Array.isArray(contributions.views) || contributions.views.length > MAX_EXTENSION_VIEWS) throw new Error('Invalid extension view count.');
    const ids = new Set<string>();
    const views = contributions.views.map(raw => {
        const view = record(raw);
        const viewId = text(view.id, 'view id', 80);
        if (!validViewId(viewId) || ids.has(viewId)) throw new Error('Invalid or duplicate extension view ID.');
        if (!VIEW_SURFACES.includes(view.surface as typeof VIEW_SURFACES[number])) throw new Error('Unknown extension view surface.');
        if (view.layout !== undefined && (view.surface !== 'workspace'
            || (view.layout !== 'full' && view.layout !== 'with-chat'))) throw new Error('Invalid extension workspace layout.');
        ids.add(viewId);
        return Object.freeze({ id: viewId, title: text(view.title, 'view title'),
            surface: view.surface as ExtensionViewContract['surface'], ...(view.layout ? { layout: view.layout as ExtensionViewContract['layout'] } : {}) });
    });
    return Object.freeze({ schema_version: EXTENSION_SCHEMA_VERSION, hub_type: 'extension' as const, id, name, version,
        host_api: Object.freeze({ min: api.min as number, max: api.max as number }),
        runtime: Object.freeze({ kind, ...(entry ? { entry } : {}) }), activation: data.activation,
        capabilities: Object.freeze({ required, optional }), contributes: Object.freeze({ views: Object.freeze(views) }) });
}

/** Explicit v0 adapter; the App composition root still owns the actual executable loader. */
export function adaptBundledManifest(input: unknown): ExtensionContract {
    const manifest: ExtensionManifest = validateExtensionManifest(input);
    return validateExtensionContract({ schema_version: EXTENSION_SCHEMA_VERSION, hub_type: manifest.hub_type,
        id: manifest.id, name: manifest.name, version: manifest.version,
        host_api: { min: manifest.host_api, max: manifest.host_api }, runtime: { kind: 'bundled' }, activation: 'on-demand',
        capabilities: { required: manifest.capabilities, optional: [] },
        contributes: { views: manifest.contributes.views.map(({ slot: _slot, ...view }) => ({ ...view, surface: 'workspace' })) } });
}

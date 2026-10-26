/** Private v0 App contract. A catalogue row is not executable UI provenance. */
import { contractRecord as record, contractText as text, MAX_EXTENSION_VIEWS,
    validExtensionId, validViewId, validReleaseVersion } from './validation';
export { validExtensionId, validViewId } from './validation';
export const EXTENSION_HOST_API = 1;
export const EXTENSION_CAPABILITIES = [
    'storage.read', 'storage.write', 'models.list', 'ai.generate', 'ai.stream', 'audio.speech', 'audio.transcribe',
    'chat.sessions', 'chat.send',
] as const;
export type ExtensionCapability = typeof EXTENSION_CAPABILITIES[number];
export interface ExtensionView {
    id: string;
    title: string;
    slot: 'workspace';
    layout?: 'full' | 'with-chat';
}
export interface ExtensionManifest {
    hub_type: 'extension';
    id: string;
    name: string;
    version: string;
    host_api: typeof EXTENSION_HOST_API;
    capabilities: readonly ExtensionCapability[];
    contributes: { views: readonly ExtensionView[] };
}

export function validateExtensionManifest(input: unknown): ExtensionManifest {
    const data = record(input);
    if (data.hub_type !== 'extension') throw new Error('This package is not an App extension.');
    if (data.host_api !== EXTENSION_HOST_API) throw new Error('Extension host API version is incompatible.');
    const id = text(data.id, 'id');
    if (!validExtensionId(id)) throw new Error('Extension ID must be publisher.app-name.');
    const name = text(data.name, 'name');
    const release = text(data.version, 'version', 60);
    if (!validReleaseVersion(release)) throw new Error('Extension version must be a semantic release version.');
    if (!Array.isArray(data.capabilities) || data.capabilities.length > EXTENSION_CAPABILITIES.length
        || data.capabilities.some(cap => !EXTENSION_CAPABILITIES.includes(cap))) {
        throw new Error('Unknown or invalid extension capability.');
    }
    if (new Set(data.capabilities).size !== data.capabilities.length) throw new Error('Duplicate extension capability.');
    const contributions = record(data.contributes);
    if (!Array.isArray(contributions.views) || !contributions.views.length || contributions.views.length > MAX_EXTENSION_VIEWS) {
        throw new Error('An extension must declare between one and sixteen workspace views.');
    }
    const ids = new Set<string>();
    const views = contributions.views.map(raw => {
        const view = record(raw);
        const viewId = text(view.id, 'view id', 80);
        if (!validViewId(viewId) || ids.has(viewId)) throw new Error('Invalid or duplicate extension view ID.');
        if (view.slot !== 'workspace') throw new Error('Unsupported extension contribution slot.');
        if (view.layout !== undefined && view.layout !== 'full' && view.layout !== 'with-chat') throw new Error('Unsupported extension workspace layout.');
        ids.add(viewId);
        return Object.freeze({ id: viewId, title: text(view.title, 'view title'), slot: 'workspace' as const,
            ...(view.layout ? { layout: view.layout as 'full' | 'with-chat' } : {}) });
    });
    // Copy only recognized fields; caller mutation cannot change the registered contract.
    return Object.freeze({ hub_type: 'extension' as const, id, name, version: release,
        host_api: EXTENSION_HOST_API, capabilities: Object.freeze([...data.capabilities]),
        contributes: Object.freeze({ views: Object.freeze(views) }) });
}

import { EXTENSION_DOCUMENT_LIMIT_BYTES, validateExtensionContract, type ExtensionContract } from '../contract';
import { EXTENSION_HOST_API, EXTENSION_CAPABILITIES, type ExtensionCapability } from '../manifest';

export interface DeveloperDocument {
    readonly html: string;
    readonly contract: ExtensionContract;
    readonly requested: readonly ExtensionCapability[];
}
export const WEB_DOCUMENT_CSP = "default-src 'none'; script-src data:; style-src 'unsafe-inline' data:; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";

/** Parse while inert, validate metadata before executing any package code. */
export function readDeveloperDocument(html: string): DeveloperDocument {
    if (!html || new TextEncoder().encode(html).length > EXTENSION_DOCUMENT_LIMIT_BYTES) throw new Error('Extension document is empty or too large.');
    const document = new DOMParser().parseFromString(html, 'text/html');
    const manifests = document.querySelectorAll('#cluaiz-extension-manifest');
    if (manifests.length !== 1) throw new Error('Select dist/index.html produced by the extension devkit.');
    const metadata = JSON.parse(manifests[0].textContent ?? '');
    const contract = validateExtensionContract(metadata.app);
    if (contract.runtime.kind !== 'webview' || contract.activation !== 'on-demand'
        || !contract.contributes.views.length || contract.contributes.views.some(view => view.surface !== 'workspace' || (view.layout && view.layout !== 'full'))) {
        throw new Error('This host supports on-demand full workspace WebViews only.');
    }
    if (EXTENSION_HOST_API < contract.host_api.min || EXTENSION_HOST_API > contract.host_api.max) throw new Error('Extension host API is incompatible.');
    const known = EXTENSION_CAPABILITIES as readonly string[];
    if (contract.capabilities.required.some(cap => !known.includes(cap))) throw new Error('A required extension capability is unavailable.');
    const requested = [...contract.capabilities.required, ...contract.capabilities.optional.filter(cap => known.includes(cap))] as ExtensionCapability[];
    return Object.freeze({ html, contract, requested: Object.freeze(requested) });
}

export function browserDocument(source: DeveloperDocument): string {
    const document = new DOMParser().parseFromString(source.html, 'text/html');
    const csp = document.createElement('meta');
    csp.httpEquiv = 'Content-Security-Policy';
    csp.content = WEB_DOCUMENT_CSP;
    document.head.prepend(csp);
    return '<!doctype html>' + document.documentElement.outerHTML;
}

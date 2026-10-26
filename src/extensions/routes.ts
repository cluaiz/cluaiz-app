import { validExtensionId, validViewId } from './manifest';

export interface ExtensionRoute { extensionId: string; viewId: string; }
export function extensionPath(route: ExtensionRoute): string {
    if (!validExtensionId(route.extensionId) || !validViewId(route.viewId)) throw new Error('Invalid extension route.');
    return `/extensions/${route.extensionId}/${route.viewId}`;
}
export function parseExtensionPath(path: string): ExtensionRoute | null {
    const parts = path.split('/');
    if (parts.length !== 4 || parts[1] !== 'extensions'
        || !validExtensionId(parts[2]) || !validViewId(parts[3])) return null;
    return { extensionId: parts[2], viewId: parts[3] };
}

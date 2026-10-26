import { useLayoutStore } from '../store/ui/useLayoutStore';
import { pushViewRoute } from '../core/router';
import { workspaceExtensions } from './bundled';
import type { ExtensionRoute } from './routes';
import { installedExtensions } from './packages/store';

/** Navigation entry for compiled App commands; downloaded packages cannot register loaders here. */
export function openExtensionWorkspace(route: ExtensionRoute): void {
    const entry = workspaceExtensions.get(route.extensionId);
    if (!entry?.manifest.contributes.views.some(view => view.id === route.viewId)) throw new Error('Workspace extension or view is unavailable.');
    useLayoutStore.getState().setActiveExtension({ ...route });
    pushViewRoute('extensions');
}

/** Imported documents open only after re-reading their installed receipt. */
export async function openInstalledExtensionWorkspace(route: ExtensionRoute): Promise<void> {
    const value = await installedExtensions.read(route.extensionId);
    if (!value?.record.enabled || !value.document.contract.contributes.views.some(view => view.id === route.viewId)) throw new Error('Installed workspace is disabled or unavailable.');
    useLayoutStore.getState().setActiveExtension({ ...route });
    pushViewRoute('extensions');
}

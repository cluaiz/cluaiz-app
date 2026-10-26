import { WorkspaceExtensionRegistry } from './registry';

/** This allowlist is code shipped with the App, never a downloaded catalogue's trust flag. */
export const workspaceExtensions = new WorkspaceExtensionRegistry();

workspaceExtensions.registerBundled({
    manifest: { hub_type: 'extension', id: 'cluaiz.notebook', name: 'Notebook', version: '0.1.0',
        host_api: 1, capabilities: [], contributes: { views: [{ id: 'main', title: 'Notebook', slot: 'workspace' }] } },
    grants: [],
    load: async () => {
        const { NotebookHub } = await import('../features/notebook/NotebookHub');
        return { views: { main: NotebookHub } };
    },
});

workspaceExtensions.registerBundled({
    manifest: { hub_type: 'extension', id: 'cluaiz.library', name: 'Library', version: '0.1.0',
        host_api: 1, capabilities: [], contributes: { views: [{ id: 'main', title: 'Library', slot: 'workspace' }] } },
    grants: [],
    load: async () => {
        const { LibraryHub } = await import('../features/library');
        return { views: { main: LibraryHub } };
    },
});

/** Legacy route aliases remain stable while mounting uses the same contribution host. */
export const bundledWorkspaceRoutes = {
    notebook: { extensionId: 'cluaiz.notebook', viewId: 'main' },
    library: { extensionId: 'cluaiz.library', viewId: 'main' },
} as const;

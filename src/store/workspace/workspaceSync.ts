import { fsApi } from '../../api';
import { useEngineStore } from '../engine/useEngineStore';
import { useProjectStore } from './useProjectStore';

/** The folder of the open project, when one is open */
const openFolder = (): string | null => {
    const { isWorkspaceOpen, activeProjectId, projects } = useProjectStore.getState();
    const folder = isWorkspaceOpen && activeProjectId ? projects[activeProjectId]?.rootPath?.trim() : '';
    return folder || null;
};

/**
 * The Engine forgets the open folder when it restarts and falls back to its empty default workspace.
 * Each time the App (re)connects, it sends the open project's folder again. Returns the unsubscribe.
 */
export function startWorkspaceSync(): () => void {
    return useEngineStore.subscribe((state, previous) => {
        if (state.fetchStatus !== 'success' || previous.fetchStatus === 'success') return;
        const folder = openFolder();
        if (!folder) return;
        fsApi.setWorkspace({ workspace: folder })
            .catch(error => console.warn('[workspaceSync] The open folder was not sent to the Engine again:', error));
    });
}

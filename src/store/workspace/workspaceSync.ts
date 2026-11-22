import { fsApi } from '../../api';
import { useEngineStore } from '../engine/useEngineStore';
import { useProjectStore } from './useProjectStore';

type ProjectState = ReturnType<typeof useProjectStore.getState>;

/** The folder of the open project, when one is open */
const openFolder = ({ isWorkspaceOpen, activeProjectId, projects }: ProjectState = useProjectStore.getState()): string | null => {
    const folder = isWorkspaceOpen && activeProjectId ? projects[activeProjectId]?.rootPath?.trim() : '';
    return folder || null;
};

const send = (folder: string | null) => {
    if (!folder) return;
    fsApi.setWorkspace({ workspace: folder })
        .catch(error => console.warn('[workspaceSync] The open folder was not sent to the Engine:', error));
};

/**
 * Keeps the Engine's open folder on the App's open project. The Engine forgets it when it restarts
 * and falls back to its empty default workspace, so the App sends it again each time it (re)connects,
 * and whenever the user switches to another project. Returns the unsubscribe.
 */
export function startWorkspaceSync(): () => void {
    const connected = useEngineStore.subscribe((state, previous) => {
        if (state.fetchStatus === 'success' && previous.fetchStatus !== 'success') send(openFolder());
    });
    const switched = useProjectStore.subscribe((state, previous) => {
        const folder = openFolder(state);
        // A project opened just now is not a switch: `openFolder` sends it itself
        const known = state.activeProjectId ? Boolean(previous.projects[state.activeProjectId]) : false;
        // Sent even while the settings read is failing: a send that fails is sent again on the next connect
        if (known && folder !== openFolder(previous)) send(folder);
    });
    return () => { connected(); switched(); };
}

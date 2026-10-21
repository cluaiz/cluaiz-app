import { useProjectStore, detectLanguageFromPath } from '../../../store/workspace/useProjectStore';
import { useLayoutStore } from '../../../store/ui/useLayoutStore';
import type { Project, ProjectFile } from '../../workspace/types';
import { fileToDataUri } from './attachmentSerializer';

export interface AttachmentOpenTarget {
    name: string;
    size?: number | null;
    type?: string;
    previewUrl?: string;
    file?: any;
    isPastedText?: boolean;
    pastedContent?: string;
}

/**
 * Safely opens a staged or sent chat attachment directly inside the Workspace Editor Pane.
 * - If Workspace is already open: adds a new tab seamlessly without crashing.
 * - If Workspace is closed: sets splitPaneWidth to 50% and focuses the tab.
 * - Closing the tab removes it cleanly with zero disk corruption or permanent history pollution.
 */
export async function openAttachmentInWorkspace(item: AttachmentOpenTarget): Promise<void> {
    if (!item || !item.name) return;

    const { splitPaneWidth, setSplitPaneWidth, setWorkspaceSidebarOpen } = useLayoutStore.getState();

    // 1. Ensure Workspace Right Split Pane is open
    // If opening freshly, collapse the workspace sidebar explorer so user gets full preview width
    if (splitPaneWidth >= 100) {
        setSplitPaneWidth(50);
        setWorkspaceSidebarOpen(false);
    }

    // 2. Resolve content (text for code/markdown, data URI for media/documents)
    let content = item.previewUrl || '';
    if (item.isPastedText && item.pastedContent) {
        content = item.pastedContent;
    } else if (item.file instanceof File || item.file instanceof Blob) {
        try {
            const isTextLike = item.type?.startsWith('text/') ||
                /\.(tsx?|jsx?|rs|py|json|md|txt|html|css|yaml|yml|toml|sh|bat|cmd|env|lock)$/i.test(item.name);
            if (isTextLike) {
                content = await item.file.text();
            } else if (!content) {
                content = await fileToDataUri(item.file);
            }
        } catch {
            content = item.previewUrl || '';
        }
    }

    // If still empty and it's a known text file, leave empty string so editor can render
    if (!content && /\.(tsx?|jsx?|rs|py|json|md|txt|html|css|yaml|yml|toml|sh|bat|cmd)$/i.test(item.name)) {
        content = '';
    }

    const filePath = item.name;
    const projectStore = useProjectStore.getState();
    let targetProjectId = projectStore.activeProjectId;

    // 3. If no project is currently open, create a safe, lightweight preview project
    if (!targetProjectId || !projectStore.projects[targetProjectId]) {
        targetProjectId = 'preview_workspace';
        const initialProj: Project = {
            id: targetProjectId,
            name: 'Workspace',
            files: {},
            folders: [],
            activeFilePath: '',
            openFilePaths: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        useProjectStore.setState((state) => ({
            projects: {
                ...state.projects,
                [targetProjectId!]: initialProj
            },
            activeProjectId: targetProjectId,
            isWorkspaceOpen: true
        }));
    }

    // 4. Create ProjectFile entry marked strictly as isTemporary
    const newFile: ProjectFile = {
        path: filePath,
        name: item.name,
        content: content,
        language: detectLanguageFromPath(filePath),
        isTemporary: true
    };

    // 5. Update workspace project state safely without crashing
    useProjectStore.setState((state) => {
        const curProj = state.projects[targetProjectId!];
        if (!curProj) return state;

        const openFiles = curProj.openFilePaths.includes(filePath)
            ? curProj.openFilePaths
            : [...curProj.openFilePaths, filePath];

        return {
            projects: {
                ...state.projects,
                [targetProjectId!]: {
                    ...curProj,
                    files: {
                        ...curProj.files,
                        [filePath]: newFile
                    },
                    openFilePaths: openFiles,
                    activeFilePath: filePath,
                    updatedAt: Date.now()
                }
            },
            isWorkspaceOpen: true
        };
    });
}

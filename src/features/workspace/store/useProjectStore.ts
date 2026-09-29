import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Project, ProjectFile } from '../types';
import { normalizeLanguage } from '../../../components/ui/CodeEditor/languages';

export const detectLanguageFromPath = (path: string): string => {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    return normalizeLanguage(ext);
};

interface ProjectStoreState {
    projects: Record<string, Project>;
    activeProjectId: string | null;
    isWorkspaceOpen: boolean;

    // Actions
    createOrUpdateProject: (id: string, name: string, files: Record<string, string>, description?: string) => void;
    setActiveProject: (id: string | null) => void;
    setActiveFile: (path: string) => void;
    openFile: (path: string) => void;
    closeFile: (path: string) => void;
    updateFileContent: (path: string, content: string) => void;
    openWorkspace: (projectId?: string) => void;
    closeWorkspace: () => void;
    getActiveProject: () => Project | null;
    getActiveFile: () => ProjectFile | null;
}

export const useProjectStore = create<ProjectStoreState>()(
    persist(
        (set, get) => ({
            projects: {},
            activeProjectId: null,
            isWorkspaceOpen: false,

            createOrUpdateProject: (id, name, rawFiles, description) => {
                const now = Date.now();
                const existing = get().projects[id];
                const filePaths = Object.keys(rawFiles);
                const firstFile = filePaths[0] || '';

                const formattedFiles: Record<string, ProjectFile> = {};
                for (const [filePath, content] of Object.entries(rawFiles)) {
                    const fileName = filePath.split('/').pop() || filePath;
                    formattedFiles[filePath] = {
                        path: filePath,
                        name: fileName,
                        content,
                        language: detectLanguageFromPath(filePath),
                        isModified: false
                    };
                }

                const updatedProject: Project = {
                    id,
                    name,
                    description: description || existing?.description,
                    files: { ...(existing?.files || {}), ...formattedFiles },
                    activeFilePath: existing?.activeFilePath && formattedFiles[existing.activeFilePath]
                        ? existing.activeFilePath
                        : firstFile,
                    openFilePaths: existing?.openFilePaths && existing.openFilePaths.length > 0
                        ? Array.from(new Set([...existing.openFilePaths, ...filePaths]))
                        : filePaths.slice(0, 4),
                    createdAt: existing?.createdAt || now,
                    updatedAt: now
                };

                set((state) => ({
                    projects: {
                        ...state.projects,
                        [id]: updatedProject
                    },
                    activeProjectId: id,
                    isWorkspaceOpen: true
                }));
            },

            setActiveProject: (id) => set({ activeProjectId: id }),

            setActiveFile: (path) => {
                const activeId = get().activeProjectId;
                if (!activeId) return;

                set((state) => {
                    const proj = state.projects[activeId];
                    if (!proj || !proj.files[path]) return state;

                    const openFiles = proj.openFilePaths.includes(path)
                        ? proj.openFilePaths
                        : [...proj.openFilePaths, path];

                    return {
                        projects: {
                            ...state.projects,
                            [activeId]: {
                                ...proj,
                                activeFilePath: path,
                                openFilePaths: openFiles
                            }
                        }
                    };
                });
            },

            openFile: (path) => {
                get().setActiveFile(path);
            },

            closeFile: (path) => {
                const activeId = get().activeProjectId;
                if (!activeId) return;

                set((state) => {
                    const proj = state.projects[activeId];
                    if (!proj) return state;

                    const remaining = proj.openFilePaths.filter(p => p !== path);
                    const newActive = proj.activeFilePath === path
                        ? remaining[remaining.length - 1] || ''
                        : proj.activeFilePath;

                    return {
                        projects: {
                            ...state.projects,
                            [activeId]: {
                                ...proj,
                                openFilePaths: remaining,
                                activeFilePath: newActive
                            }
                        }
                    };
                });
            },

            updateFileContent: (path, content) => {
                const activeId = get().activeProjectId;
                if (!activeId) return;

                set((state) => {
                    const proj = state.projects[activeId];
                    if (!proj || !proj.files[path]) return state;

                    return {
                        projects: {
                            ...state.projects,
                            [activeId]: {
                                ...proj,
                                files: {
                                    ...proj.files,
                                    [path]: {
                                        ...proj.files[path],
                                        content,
                                        isModified: true
                                    }
                                },
                                updatedAt: Date.now()
                            }
                        }
                    };
                });
            },

            openWorkspace: (projectId) => {
                set((state) => ({
                    isWorkspaceOpen: true,
                    activeProjectId: projectId || state.activeProjectId || Object.keys(state.projects)[0] || null
                }));
            },

            closeWorkspace: () => set({ isWorkspaceOpen: false }),

            getActiveProject: () => {
                const { activeProjectId, projects } = get();
                return activeProjectId ? projects[activeProjectId] || null : null;
            },

            getActiveFile: () => {
                const proj = get().getActiveProject();
                if (!proj || !proj.activeFilePath) return null;
                return proj.files[proj.activeFilePath] || null;
            }
        }),
        {
            name: 'cluaiz-project-store',
            partialize: (state) => ({
                projects: state.projects,
                activeProjectId: state.activeProjectId
            })
        }
    )
);

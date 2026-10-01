import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Project, ProjectFile, RecentWorkspace } from '../types';
import { normalizeLanguage } from '../../../components/ui/CodeEditor/languages';
import { useConnectionStore } from '../../../store/engine/useConnectionStore';
import { 
    readDiskFileFast, 
    writeDiskFileFast, 
    isTauri, 
    listDiskDirFast, 
    deleteDiskPathFast, 
    renameDiskPathFast, 
    copyDiskPathFast, 
    createDirFast,
    startFsWatcher,
    stopFsWatcher,
    onFsChangeEvent
} from '../../../core/engineBridge';
import { toSniffedDataUri, fixDataUriMime } from '../../../utils/mimeSniffer';
import { isMediaOrBinaryFile } from '../../../utils/mediaResolver';

export const detectLanguageFromPath = (path: string): string => {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    return normalizeLanguage(ext);
};

const isWindowsEnv = () => typeof navigator !== 'undefined' && (navigator.userAgent.includes('Windows') || navigator.platform?.startsWith('Win'));
export const isMediaFileExt = (filePath: string): boolean => isMediaOrBinaryFile(filePath);

// Pure browser-safe UTF-16LE Base64 encoding for Windows PowerShell -EncodedCommand
function encodeUtf16LeBase64(str: string): string {
    const bytes = new Uint8Array(new Uint16Array([...str].map(c => c.charCodeAt(0))).buffer);
    return btoa(String.fromCharCode(...bytes));
}

// Low-level command runner via Cluaiz Engine
async function runEngineCmd(cmd: string): Promise<string> {
    try {
        const baseUrl = useConnectionStore.getState().getBaseUrl();
        const res = await fetch(`${baseUrl}/v1/system/cmd`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: cmd })
        });
        return res.ok ? ((await res.json()).output || '') : '';
    } catch { return ''; }
}

export interface DiskItem {
    path: string;
    name: string;
    isFolder: boolean;
    length: number;
    modified: string;
}

// ── Physical Disk Operations via Cluaiz Engine ───────────────────────────
async function runPowerShell(script: string): Promise<string> {
    const encoded = encodeUtf16LeBase64(`$ProgressPreference = 'SilentlyContinue';\n${script}`);
    return runEngineCmd(`powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand ${encoded}`);
}

export const pickFolderFromOS = async (): Promise<string> => {
    try {
        if (isWindowsEnv()) {
            const script = `Add-Type -AssemblyName System.Windows.Forms; $form = New-Object System.Windows.Forms.Form; $form.TopMost = $true; $form.WindowState = [System.Windows.Forms.FormWindowState]::Minimized; $form.Show(); $form.Activate(); $dialog = New-Object System.Windows.Forms.FolderBrowserDialog; $dialog.Description = 'Select Workspace Folder'; $dialog.SelectedPath = $env:USERPROFILE; $dialog.ShowNewFolderButton = $true; $res = $dialog.ShowDialog($form); $form.Dispose(); if ($res -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dialog.SelectedPath }`;
            const out = await runEngineCmd(`powershell -NoProfile -STA -ExecutionPolicy Bypass -EncodedCommand ${encodeUtf16LeBase64(script)}`);
            const path = out.trim().split(/[\r\n]+/)[0]?.trim();
            return (path && !path.startsWith('#<') && !path.includes('CLIXML') && !path.includes('Error') && /^[a-zA-Z]:[\\/]/.test(path)) ? path : '';
        }
        const out = await runEngineCmd(`zenity --file-selection --directory 2>/dev/null || kdialog --getexistingdirectory 2>/dev/null || true`);
        const path = out.trim().split(/[\r\n]+/)[0]?.trim();
        return (path && path.startsWith('/')) ? path : '';
    } catch { return ''; }
};

export const syncFileToDisk = async (rootPath: string | undefined, filePath: string, content: string): Promise<boolean> => {
    if (!rootPath || !filePath) return false;
    try {
        const isWin = isWindowsEnv();
        const normRoot = isWin ? rootPath.replace(/\//g, '\\').replace(/\\+$/, '') : rootPath.replace(/\/+$/, '');
        const normFile = isWin ? filePath.replace(/\//g, '\\').replace(/^\\+/, '') : filePath.replace(/^\/+/, '');
        return await writeDiskFileFast(`${normRoot}${isWin ? '\\' : '/'}${normFile}`, content);
    } catch { return false; }
};

export const readFileFromDisk = async (rootPath: string | undefined, filePath: string): Promise<string> => {
    if (!rootPath || !filePath) return '';
    try {
        const isWin = isWindowsEnv();
        const normRoot = isWin ? rootPath.replace(/\//g, '\\').replace(/\\+$/, '') : rootPath.replace(/\/+$/, '');
        const normFile = isWin ? filePath.replace(/\//g, '\\').replace(/^\\+/, '') : filePath.replace(/^\/+/, '');
        const isAbsolute = isWin ? /^[a-zA-Z]:[\\/]/.test(filePath) : filePath.startsWith('/');
        const fullPath = isAbsolute ? (isWin ? filePath.replace(/\//g, '\\') : filePath) : `${normRoot}${isWin ? '\\' : '/'}${normFile}`;
        const ext = filePath.split('.').pop()?.toLowerCase() || '';
        const isMedia = isMediaOrBinaryFile(filePath);
        const content = await readDiskFileFast(fullPath, isMedia);
        if (isMedia && content) {
            if (content.startsWith('__BASE64__:') || (!content.startsWith('data:') && !content.startsWith('http') && !content.startsWith('blob:'))) {
                return toSniffedDataUri(content, ext);
            }
            if (content.startsWith('data:')) return fixDataUriMime(content, ext);
        }
        if (content.includes('The filename, directory name, or volume label syntax is incorrect') ||
            content.includes('#< CLIXML') || content.includes('Continue = \'SilentlyContinue\'')) {
            return '';
        }
        return content;
    } catch { return ''; }
};

export const listFilesFromDisk = async (
    targetDir: string | undefined, 
    rootPath?: string, 
    recursive: boolean = false
): Promise<DiskItem[]> => {
    if (!targetDir) return [];
    try {
        const root = rootPath || targetDir;
        if (isTauri()) return await listDiskDirFast(targetDir, root, recursive);
        if (isWindowsEnv()) {
            const recurseFlag = recursive ? '-Recurse' : '';
            const out = await runPowerShell(`if (-not (Test-Path -LiteralPath '${targetDir}')) { New-Item -ItemType Directory -Path '${targetDir}' -Force | Out-Null }; $items = @(Get-ChildItem -LiteralPath '${targetDir}' ${recurseFlag} | ForEach-Object { [PSCustomObject]@{ path = $_.FullName.Substring('${root}'.Length).TrimStart('\\', '/').Replace('\\', '/'); name = $_.Name; isFolder = $_.PSIsContainer; length = if ($_.PSIsContainer) { 0 } else { $_.Length }; modified = $_.LastWriteTimeUtc.ToString('o') } }); ConvertTo-Json -InputObject $items -Compress`);
            if (!out.trim()) return [];
            const parsed = JSON.parse(out.trim());
            return Array.isArray(parsed) ? parsed : [parsed];
        }
        const out = await runEngineCmd(`find "${targetDir}" -maxdepth 1`);
        return out.split('\n').filter(Boolean).map(l => ({ path: l.replace(`${root}/`, ''), name: l.split('/').pop() || l, isFolder: false, length: 0, modified: '' }));
    } catch { return []; }
};

export const deleteFileFromDisk = async (rootPath: string | undefined, filePath: string): Promise<boolean> => {
    if (!rootPath || !filePath) return false;
    try {
        const fullPath = `${rootPath}/${filePath}`.replace(/\\/g, '/');
        if (isTauri()) return await deleteDiskPathFast(fullPath);
        if (isWindowsEnv()) await runPowerShell(`if (Test-Path -LiteralPath '${fullPath}') { Remove-Item -LiteralPath '${fullPath}' -Recurse -Force -ErrorAction SilentlyContinue }`);
        else await runEngineCmd(`rm -rf "${fullPath}"`);
        return true;
    } catch { return false; }
};

export const renameFileOnDisk = async (rootPath: string | undefined, oldPath: string, newPath: string): Promise<boolean> => {
    if (!rootPath || !oldPath || !newPath) return false;
    try {
        const oldFull = `${rootPath}/${oldPath}`.replace(/\\/g, '/');
        const newFull = `${rootPath}/${newPath}`.replace(/\\/g, '/');
        if (isTauri()) return await renameDiskPathFast(oldFull, newFull);
        if (isWindowsEnv()) await runPowerShell(`$d = Split-Path -Path '${newFull}' -Parent; if (-not (Test-Path -LiteralPath $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }; if (Test-Path -LiteralPath '${oldFull}') { Move-Item -LiteralPath '${oldFull}' -Destination '${newFull}' -Force }`);
        else await runEngineCmd(`mkdir -p "$(dirname "${newFull}")" && mv -f "${oldFull}" "${newFull}"`);
        return true;
    } catch { return false; }
};

export const copyFileOnDisk = async (rootPath: string | undefined, srcPath: string, destPath: string): Promise<boolean> => {
    if (!rootPath || !srcPath || !destPath) return false;
    try {
        const srcFull = `${rootPath}/${srcPath}`.replace(/\\/g, '/');
        const destFull = `${rootPath}/${destPath}`.replace(/\\/g, '/');
        if (isTauri()) return await copyDiskPathFast(srcFull, destFull);
        if (isWindowsEnv()) await runPowerShell(`$d = Split-Path -Path '${destFull}' -Parent; if (-not (Test-Path -LiteralPath $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }; Copy-Item -LiteralPath '${srcFull}' -Destination '${destFull}' -Recurse -Force`);
        else await runEngineCmd(`mkdir -p "$(dirname "${destFull}")" && cp -rf "${srcFull}" "${destFull}"`);
        return true;
    } catch { return false; }
};

export const createFolderOnDisk = async (rootPath: string | undefined, folderPath: string): Promise<boolean> => {
    if (!rootPath || !folderPath) return false;
    try {
        const fullDir = `${rootPath}/${folderPath}`.replace(/\\/g, '/');
        if (isTauri()) return await createDirFast(fullDir);
        if (isWindowsEnv()) await runPowerShell(`if (-not (Test-Path -LiteralPath '${fullDir}')) { New-Item -ItemType Directory -Path '${fullDir}' -Force | Out-Null }`);
        else await runEngineCmd(`mkdir -p "${fullDir}"`);
        return true;
    } catch { return false; }
};

// ── Store State Interface ────────────────────────────────────────────────

interface ProjectStoreState {
    projects: Record<string, Project>;
    activeProjectId: string | null;
    isWorkspaceOpen: boolean;
    isSyncing: boolean;
    isLoadingFile: boolean;
    recentWorkspaces: RecentWorkspace[];

    // Actions
    createOrUpdateProject: (id: string, name: string, files: Record<string, string>, description?: string, rootPath?: string) => Promise<void>;
    openFolder: (folderPath: string) => Promise<void>;
    removeRecentWorkspace: (folderPath: string) => void;
    setProjectRootPath: (rootPath: string) => void;
    setActiveProject: (id: string | null) => void;
    setActiveFile: (path: string) => void;
    openFile: (path: string) => void;
    closeFile: (path: string) => void;
    updateFileContent: (path: string, content: string) => void;
    createFile: (path: string, content?: string) => Promise<void>;
    createFolder: (folderPath: string) => Promise<void>;
    deleteFile: (path: string) => Promise<void>;
    renameFile: (oldPath: string, newPath: string) => Promise<void>;
    copyFile: (srcPath: string, destPath: string) => Promise<void>;
    loadFolderChildren: (folderPath: string) => Promise<void>;
    syncFromDisk: (projectId?: string) => Promise<void>;
    loadFileContentFromDisk: (path: string) => Promise<string>;
    openWorkspace: (projectId?: string) => void;
    closeWorkspace: () => void;
    getActiveProject: () => Project | null;
    getActiveFile: () => ProjectFile | null;
}

let unlistenWatcher: (() => void) | null = null;

async function initWorkspaceWatcher(rootPath: string) {
    if (!isTauri() || !rootPath) return;
    if (unlistenWatcher) {
        unlistenWatcher();
        unlistenWatcher = null;
    }
    await startFsWatcher(rootPath);
    unlistenWatcher = await onFsChangeEvent(async (event) => {
        const store = useProjectStore.getState();
        const activeId = store.activeProjectId;
        if (!activeId) return;
        const curProj = store.projects[activeId];
        if (!curProj) return;

        const path = event.path;
        if (event.kind === 'remove') {
            useProjectStore.setState((state) => {
                const p = state.projects[activeId];
                if (!p) return state;
                const newFiles = { ...p.files };
                delete newFiles[path];
                Object.keys(newFiles).forEach(k => { if (k.startsWith(`${path}/`)) delete newFiles[k]; });
                const newFolders = (p.folders || []).filter(f => f !== path && !f.startsWith(`${path}/`));
                const remainingOpen = p.openFilePaths.filter(fp => fp !== path && !fp.startsWith(`${path}/`));
                return {
                    projects: {
                        ...state.projects,
                        [activeId]: {
                            ...p,
                            files: newFiles,
                            folders: newFolders,
                            openFilePaths: remainingOpen,
                            activeFilePath: p.activeFilePath === path ? (remainingOpen[0] || '') : p.activeFilePath
                        }
                    }
                };
            });
        } else if (event.kind === 'create') {
            if (event.isFolder) {
                useProjectStore.setState((state) => {
                    const p = state.projects[activeId];
                    if (!p) return state;
                    const existing = new Set(p.folders || []);
                    existing.add(path);
                    return { projects: { ...state.projects, [activeId]: { ...p, folders: Array.from(existing) } } };
                });
            } else {
                useProjectStore.setState((state) => {
                    const p = state.projects[activeId];
                    if (!p || p.files[path]) return state;
                    return {
                        projects: {
                            ...state.projects,
                            [activeId]: {
                                ...p,
                                files: {
                                    ...p.files,
                                    [path]: { path, name: path.split('/').pop() || path, content: '', language: detectLanguageFromPath(path), isModified: false }
                                }
                            }
                        }
                    };
                });
            }
        } else if (event.kind === 'modify') {
            if (!event.isFolder && curProj.activeFilePath === path) {
                const freshContent = await readFileFromDisk(curProj.rootPath, path);
                const currentContent = curProj.files[path]?.content;
                if (freshContent !== currentContent && typeof freshContent === 'string' && freshContent.length > 0) {
                    useProjectStore.setState((state) => {
                        const p = state.projects[activeId];
                        if (!p || !p.files[path]) return state;
                        return {
                            projects: {
                                ...state.projects,
                                [activeId]: {
                                    ...p,
                                    files: { ...p.files, [path]: { ...p.files[path], content: freshContent, isModified: false } }
                                }
                            }
                        };
                    });
                }
            }
        }
    });
}

export const useProjectStore = create<ProjectStoreState>()(
    persist(
        (set, get) => ({
            projects: {},
            activeProjectId: null,
            isWorkspaceOpen: false,
            isSyncing: false,
            isLoadingFile: false,
            recentWorkspaces: [],

            createOrUpdateProject: async (id, name, rawFiles, description, customRoot) => {
                const now = Date.now();
                const existing = get().projects[id];
                const filePaths = Object.keys(rawFiles);
                const firstFile = filePaths[0] || '';

                const formattedFiles: Record<string, ProjectFile> = {};
                for (const [filePath, content] of Object.entries(rawFiles)) {
                    formattedFiles[filePath] = { path: filePath, name: filePath.split('/').pop() || filePath, content, language: detectLanguageFromPath(filePath), isModified: false };
                }
                const resolvedRoot = customRoot || existing?.rootPath || '';
                const updatedProject: Project = {
                    id, name: name || 'Project', description: description || existing?.description, rootPath: resolvedRoot,
                    files: { ...(existing?.files || {}), ...formattedFiles }, folders: existing?.folders || [],
                    activeFilePath: existing?.activeFilePath && formattedFiles[existing.activeFilePath] ? existing.activeFilePath : firstFile,
                    openFilePaths: existing?.openFilePaths && existing.openFilePaths.length > 0 ? Array.from(new Set([...existing.openFilePaths, ...filePaths])) : filePaths.slice(0, 4),
                    createdAt: existing?.createdAt || now, updatedAt: now
                };

                set((state) => ({ projects: { ...state.projects, [id]: updatedProject }, activeProjectId: id, isWorkspaceOpen: true }));
                if (resolvedRoot) {
                    await Promise.all(Object.entries(rawFiles).map(([f, c]) => syncFileToDisk(resolvedRoot, f, c)));
                    await get().syncFromDisk(id);
                }
            },

            openFolder: async (folderPath: string) => {
                const clean = folderPath.trim();
                if (!clean || clean.startsWith('#<') || clean.includes('CLIXML') || clean.includes('Error')) return;
                const folderName = clean.split(/[\\/]/).filter(Boolean).pop() || clean;
                const projId = `folder_${folderName.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}_${Date.now().toString(36)}`;
                const recent = get().recentWorkspaces.filter(w => w.path !== clean && !w.path.startsWith('#<') && !w.name.includes('CLIXML'));
                const updatedRecent: RecentWorkspace[] = [{ path: clean, name: folderName, lastOpened: Date.now() }, ...recent].slice(0, 10);
                const project: Project = { id: projId, name: folderName, rootPath: clean, files: {}, folders: [], activeFilePath: '', openFilePaths: [], createdAt: Date.now(), updatedAt: Date.now() };
                set((state) => ({ projects: { ...state.projects, [projId]: project }, activeProjectId: projId, isWorkspaceOpen: true, recentWorkspaces: updatedRecent }));
                await get().syncFromDisk(projId);
            },

            removeRecentWorkspace: (folderPath: string) => {
                set((state) => ({ recentWorkspaces: state.recentWorkspaces.filter(w => w.path !== folderPath) }));
            },

            setProjectRootPath: (rootPath: string) => {
                const activeId = get().activeProjectId;
                if (!activeId) return;
                set((state) => {
                    const proj = state.projects[activeId];
                    if (!proj) return state;
                    return { projects: { ...state.projects, [activeId]: { ...proj, rootPath, updatedAt: Date.now() } } };
                });
                get().syncFromDisk(activeId);
            },

            setActiveProject: (id) => {
                set({ activeProjectId: id });
                if (id) get().syncFromDisk(id);
            },

            setActiveFile: (path) => {
                const activeId = get().activeProjectId;
                if (!activeId) return;
                const curProj = get().projects[activeId];
                if (!curProj || !curProj.files[path]) return;
                const targetFile = curProj.files[path];
                const isErrorString = typeof targetFile.content === 'string' && (targetFile.content.includes('#< CLIXML') || targetFile.content.includes('[System.IO.File]::ReadAllText'));
                const hasLoaded = isMediaFileExt(path) || (typeof targetFile.content === 'string' && targetFile.content.length > 0 && !isErrorString);
                set((state) => {
                    const proj = state.projects[activeId];
                    if (!proj || !proj.files[path]) return state;
                    const openFiles = proj.openFilePaths.includes(path) ? proj.openFilePaths : [...proj.openFilePaths, path];
                    return { isLoadingFile: !hasLoaded, projects: { ...state.projects, [activeId]: { ...proj, activeFilePath: path, openFilePaths: openFiles } } };
                });
                if (!hasLoaded) get().loadFileContentFromDisk(path);
            },

            openFile: (path) => get().setActiveFile(path),

            closeFile: (path) => {
                const activeId = get().activeProjectId;
                if (!activeId) return;
                set((state) => {
                    const proj = state.projects[activeId];
                    if (!proj) return state;
                    const open = proj.openFilePaths.filter(p => p !== path);
                    return { projects: { ...state.projects, [activeId]: { ...proj, openFilePaths: open, activeFilePath: proj.activeFilePath === path ? open[open.length - 1] || '' : proj.activeFilePath } } };
                });
            },

            updateFileContent: (path, content) => {
                const activeId = get().activeProjectId;
                if (!activeId) return;
                const proj = get().projects[activeId];
                if (proj?.rootPath) syncFileToDisk(proj.rootPath, path, content);
                set((state) => {
                    const p = state.projects[activeId];
                    if (!p?.files[path]) return state;
                    return { projects: { ...state.projects, [activeId]: { ...p, files: { ...p.files, [path]: { ...p.files[path], content, isModified: false } }, updatedAt: Date.now() } } };
                });
            },

            createFile: async (path, content = '') => {
                const activeId = get().activeProjectId;
                if (!activeId) return;
                const cleanPath = path.trim().replace(/^\/+/, '');
                if (!cleanPath) return;
                const fileName = cleanPath.split('/').pop() || cleanPath;
                const newFile: ProjectFile = { path: cleanPath, name: fileName, content, language: detectLanguageFromPath(cleanPath), isModified: false };
                set((state) => {
                    const curProj = state.projects[activeId];
                    if (!curProj) return state;
                    const openFiles = curProj.openFilePaths.includes(cleanPath) ? curProj.openFilePaths : [...curProj.openFilePaths, cleanPath];
                    const existingFolders = new Set(curProj.folders || []);
                    const pathParts = cleanPath.split('/').filter(Boolean);
                    let accFolder = '';
                    for (let i = 0; i < pathParts.length - 1; i++) {
                        accFolder = accFolder ? `${accFolder}/${pathParts[i]}` : pathParts[i];
                        existingFolders.add(accFolder);
                    }
                    return { isLoadingFile: false, projects: { ...state.projects, [activeId]: { ...curProj, files: { ...curProj.files, [cleanPath]: newFile }, folders: Array.from(existingFolders), openFilePaths: openFiles, activeFilePath: cleanPath, updatedAt: Date.now() } } };
                });
                const proj = get().projects[activeId];
                if (proj?.rootPath) syncFileToDisk(proj.rootPath, cleanPath, content).catch(() => {});
            },

            createFolder: async (folderPath) => {
                const activeId = get().activeProjectId;
                if (!activeId) return;
                const cleanFolder = folderPath.trim().replace(/^\/+|\/+$/g, '');
                if (!cleanFolder) return;

                // P1: OPTIMISTIC STATE UPDATE — 0ms instant folder appearance in tree
                set((state) => {
                    const curProj = state.projects[activeId];
                    if (!curProj) return state;
                    const curFolders = curProj.folders || [];
                    if (!curFolders.includes(cleanFolder)) {
                        return {
                            projects: {
                                ...state.projects,
                                [activeId]: {
                                    ...curProj,
                                    folders: [...curFolders, cleanFolder],
                                    updatedAt: Date.now()
                                }
                            }
                        };
                    }
                    return state;
                });

                // Background Asynchronous Disk Persistence
                const proj = get().projects[activeId];
                if (proj?.rootPath) {
                    createFolderOnDisk(proj.rootPath, cleanFolder).catch((err) => {
                        console.error('[useProjectStore] Background createFolderOnDisk error:', err);
                    });
                }
            },

            deleteFile: async (path) => {
                const activeId = get().activeProjectId;
                if (!activeId) return;

                const proj = get().projects[activeId];
                if (proj?.rootPath) {
                    await deleteFileFromDisk(proj.rootPath, path);
                }

                set((state) => {
                    const curProj = state.projects[activeId];
                    if (!curProj) return state;

                    const newFiles = { ...curProj.files };
                    Object.keys(newFiles).forEach((k) => {
                        if (k === path || k.startsWith(path + '/')) delete newFiles[k];
                    });

                    const newFolders = (curProj.folders || []).filter(f => f !== path && !f.startsWith(path + '/'));

                    const remainingOpen = curProj.openFilePaths.filter(p => !p.startsWith(path));
                    const newActive = curProj.activeFilePath.startsWith(path)
                        ? remainingOpen[remainingOpen.length - 1] || Object.keys(newFiles)[0] || ''
                        : curProj.activeFilePath;

                    return {
                        projects: {
                            ...state.projects,
                            [activeId]: {
                                ...curProj,
                                files: newFiles,
                                folders: newFolders,
                                openFilePaths: remainingOpen,
                                activeFilePath: newActive,
                                updatedAt: Date.now()
                            }
                        }
                    };
                });
            },

            renameFile: async (oldPath, newPath) => {
                const activeId = get().activeProjectId;
                if (!activeId) return;
                const cleanNew = newPath.trim().replace(/^\/+/, '');
                if (!cleanNew || cleanNew === oldPath) return;
                const proj = get().projects[activeId];
                if (proj?.rootPath) {
                    await renameFileOnDisk(proj.rootPath, oldPath, cleanNew);
                }
                set((state) => {
                    const curProj = state.projects[activeId];
                    if (!curProj) return state;
                    const newFiles = { ...curProj.files };
                    const oldFile = newFiles[oldPath];
                    if (oldFile) {
                        delete newFiles[oldPath];
                        newFiles[cleanNew] = { ...oldFile, path: cleanNew, name: cleanNew.split('/').pop() || cleanNew, language: detectLanguageFromPath(cleanNew) };
                    }
                    Object.keys(newFiles).forEach(p => {
                        if (p.startsWith(`${oldPath}/`)) {
                            const sub = cleanNew + p.substring(oldPath.length);
                            newFiles[sub] = { ...newFiles[p], path: sub, name: sub.split('/').pop() || sub };
                            delete newFiles[p];
                        }
                    });
                    const newFolders = (curProj.folders || []).map(f => f === oldPath ? cleanNew : f.startsWith(`${oldPath}/`) ? cleanNew + f.substring(oldPath.length) : f);
                    const openFiles = curProj.openFilePaths.map(p => p === oldPath ? cleanNew : p.startsWith(`${oldPath}/`) ? cleanNew + p.substring(oldPath.length) : p);
                    const newActive = curProj.activeFilePath === oldPath ? cleanNew : curProj.activeFilePath.startsWith(`${oldPath}/`) ? cleanNew + curProj.activeFilePath.substring(oldPath.length) : curProj.activeFilePath;
                    return { projects: { ...state.projects, [activeId]: { ...curProj, files: newFiles, folders: newFolders, openFilePaths: openFiles, activeFilePath: newActive, updatedAt: Date.now() } } };
                });
            },

            copyFile: async (srcPath, destPath) => {
                const activeId = get().activeProjectId;
                if (!activeId) return;
                const cleanDest = destPath.trim().replace(/^\/+/, '');
                if (!cleanDest || cleanDest === srcPath) return;
                const proj = get().projects[activeId];
                if (proj?.rootPath) {
                    await copyFileOnDisk(proj.rootPath, srcPath, cleanDest);
                }
                set((state) => {
                    const curProj = state.projects[activeId];
                    if (!curProj) return state;
                    const newFiles = { ...curProj.files };
                    const srcFile = newFiles[srcPath];
                    if (srcFile) {
                        newFiles[cleanDest] = { ...srcFile, path: cleanDest, name: cleanDest.split('/').pop() || cleanDest, language: detectLanguageFromPath(cleanDest) };
                    }
                    Object.keys(newFiles).forEach(p => {
                        if (p.startsWith(`${srcPath}/`)) {
                            const sub = cleanDest + p.substring(srcPath.length);
                            newFiles[sub] = { ...newFiles[p], path: sub, name: sub.split('/').pop() || sub };
                        }
                    });
                    const newFolders = [...(curProj.folders || [])];
                    if (curProj.folders?.includes(srcPath) && !newFolders.includes(cleanDest)) newFolders.push(cleanDest);
                    (curProj.folders || []).forEach(f => {
                        if (f.startsWith(`${srcPath}/`)) {
                            const subF = cleanDest + f.substring(srcPath.length);
                            if (!newFolders.includes(subF)) newFolders.push(subF);
                        }
                    });
                    return { projects: { ...state.projects, [activeId]: { ...curProj, files: newFiles, folders: newFolders, updatedAt: Date.now() } } };
                });
            },

            loadFolderChildren: async (folderPath: string) => {
                const activeId = get().activeProjectId;
                if (!activeId) return;
                const proj = get().projects[activeId];
                if (!proj?.rootPath) return;

                const isWin = isWindowsEnv();
                const sep = isWin ? '\\' : '/';
                const cleanFolder = isWin ? folderPath.replace(/\//g, '\\') : folderPath;
                const fullDir = `${proj.rootPath}${sep}${cleanFolder}`;

                const items = await listFilesFromDisk(fullDir, proj.rootPath, false);
                if (!items || items.length === 0) return;

                set((state) => {
                    const curProj = state.projects[activeId];
                    if (!curProj) return state;

                    const newFiles = { ...curProj.files };
                    const newFolders = new Set(curProj.folders || []);

                    for (const item of items) {
                        if (item.isFolder) {
                            newFolders.add(item.path);
                        } else {
                            if (item.name === '.gitkeep') continue;
                            if (!newFiles[item.path]) {
                                newFiles[item.path] = {
                                    path: item.path,
                                    name: item.name,
                                    content: '',
                                    language: detectLanguageFromPath(item.path),
                                    isModified: false
                                };
                            }
                        }
                    }

                    return {
                        projects: {
                            ...state.projects,
                            [activeId]: {
                                ...curProj,
                                files: newFiles,
                                folders: Array.from(newFolders),
                                updatedAt: Date.now()
                            }
                        }
                    };
                });
            },

            syncFromDisk: async (projectId) => {
                const targetId = projectId || get().activeProjectId;
                if (!targetId) return;
                const proj = get().projects[targetId];
                if (!proj || !proj.rootPath) return;

                set({ isSyncing: true });
                try {
                    const rootPath = proj.rootPath;
                    const currentFiles = proj.files || {};

                    // Shallow root scan (<1ms)
                    const diskItems = await listFilesFromDisk(rootPath, rootPath, false);
                    const diskFiles: Record<string, ProjectFile> = {};
                    const diskFolders: string[] = [];

                    for (const item of diskItems) {
                        if (item.isFolder) {
                            diskFolders.push(item.path);
                        } else {
                            if (item.name === '.gitkeep') continue;
                            const existing = currentFiles[item.path];
                            diskFiles[item.path] = {
                                path: item.path,
                                name: item.name,
                                content: existing?.content ?? '',
                                language: detectLanguageFromPath(item.path),
                                isModified: false
                            };
                        }
                    }

                    set((state) => {
                        const p = state.projects[targetId];
                        if (!p) return { isSyncing: false };

                        const updatedActive = diskFiles[p.activeFilePath]
                            ? p.activeFilePath
                            : (Object.keys(diskFiles)[0] || '');
                        const updatedOpen = p.openFilePaths.filter(fp => diskFiles[fp]);

                        return {
                            isSyncing: false,
                            projects: {
                                ...state.projects,
                                [targetId]: {
                                    ...p,
                                    files: diskFiles,
                                    folders: diskFolders,
                                    activeFilePath: updatedActive,
                                    openFilePaths: updatedOpen.length > 0 ? updatedOpen : (updatedActive ? [updatedActive] : [])
                                }
                            }
                        };
                    });

                    const curActive = get().projects[targetId]?.activeFilePath;
                    if (curActive && !isMediaFileExt(curActive) && (!diskFiles[curActive]?.content || diskFiles[curActive]?.content === '')) {
                        get().loadFileContentFromDisk(curActive);
                    }
                    initWorkspaceWatcher(rootPath);
                } catch {
                    set({ isSyncing: false });
                }
            },

            loadFileContentFromDisk: async (path) => {
                const activeId = get().activeProjectId;
                if (!activeId) return '';
                const proj = get().projects[activeId];
                if (!proj || !proj.rootPath) return '';

                // P2: Bypass heavy Base64 disk reads for media/binary files (videos, images, audio, pdf)
                if (isMediaFileExt(path)) {
                    set({ isLoadingFile: false });
                    return '';
                }

                set({ isLoadingFile: true });
                try {
                    const content = await readFileFromDisk(proj.rootPath, path);
                    set((state) => {
                        const curProj = state.projects[activeId];
                        if (!curProj || !curProj.files[path]) return { isLoadingFile: false };

                        return {
                            isLoadingFile: false,
                            projects: {
                                ...state.projects,
                                [activeId]: {
                                    ...curProj,
                                    files: {
                                        ...curProj.files,
                                        [path]: {
                                            ...curProj.files[path],
                                            content,
                                            isModified: false
                                        }
                                    }
                                }
                            }
                        };
                    });
                    return content;
                } catch {
                    set({ isLoadingFile: false });
                    return '';
                }
            },

            openWorkspace: (projectId) => {
                const activeId = projectId || get().activeProjectId;
                if (activeId && get().projects[activeId]) {
                    set({
                        isWorkspaceOpen: true,
                        activeProjectId: activeId
                    });
                    get().syncFromDisk(activeId);
                } else {
                    set({ isWorkspaceOpen: true });
                }
            },

            closeWorkspace: () => {
                if (unlistenWatcher) {
                    unlistenWatcher();
                    unlistenWatcher = null;
                }
                stopFsWatcher().catch(() => {});
                set({ isWorkspaceOpen: false, activeProjectId: null });
            },

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
                activeProjectId: state.activeProjectId,
                isWorkspaceOpen: state.isWorkspaceOpen,
                recentWorkspaces: (state.recentWorkspaces || []).filter(w => !w.path.startsWith('#<') && !w.name.includes('CLIXML')),
                projects: Object.fromEntries(
                    Object.entries(state.projects).map(([id, p]) => [
                        id,
                        { id: p.id, name: p.name, description: p.description, rootPath: p.rootPath, activeFilePath: p.activeFilePath, openFilePaths: p.openFilePaths, createdAt: p.createdAt, updatedAt: p.updatedAt, files: {} }
                    ])
                )
            }),
            onRehydrateStorage: () => (state) => {
                if (state?.recentWorkspaces) {
                    state.recentWorkspaces = state.recentWorkspaces.filter(w => !w.path.startsWith('#<') && !w.name.includes('CLIXML'));
                }
            }
        }
    )
);

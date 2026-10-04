import React, { useState, useRef } from 'react';
import { 
    Maximize2, 
    Minimize2, 
    X, 
    FolderGit2, 
    ChevronDown,
    FileCode,
    PanelLeft,
    FilePlus,
    FolderPlus,
    FileUp,
    FolderUp,
    Terminal,
    LogOut,
    LayoutGrid,
    Pin,
    Loader2
} from 'lucide-react';
import { useProjectStore, pickFolderFromOS, syncFileToDisk } from '../../../store/workspace/useProjectStore';
import { WorkspaceFileTree, getFileExtension } from './WorkspaceFileTree';
import { WorkspaceTerminal } from './WorkspaceTerminal';
import { EditorContextMenu } from './EditorContextMenu';
import { EditorTabContextMenu } from './EditorTabContextMenu';
import { CodeEditor } from '../../../components/ui/CodeEditor/CodeEditor';
import { useLayoutStore } from '../../../store/ui/useLayoutStore';
import { Tooltip } from '../../../components/ui/tooltip';
import { FileIcon } from 'react-material-icon-theme';
import { FilePreviewDispatcher, isPreviewableFile } from '../../../components/preview/FilePreviewDispatcher';
import { EditorLoadingSkeleton } from '../../../components/preview/EditorLoadingSkeleton';
import { resolveDiskPath } from '../../../utils/mediaResolver';

export const WorkspaceEditorPane: React.FC = () => {
    const {
        projects,
        activeProjectId,
        setActiveFile,
        closeFile,
        updateFileContent,
        createFile,
        createFolder,
        deleteFile,
        renameFile,
        copyFile,
        closeWorkspace,
        getActiveProject,
        getActiveFile,
        syncFromDisk,
        openFolder,
        recentWorkspaces,
        removeRecentWorkspace,
        isSyncing,
        isLoadingFile,
        setActiveProject,
        createOrUpdateProject,
        openWorkspace
    } = useProjectStore();

    const { splitPaneWidth, setSplitPaneWidth } = useLayoutStore();
    const [isMaximized, setIsMaximized] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [sidebarWidth, setSidebarWidth] = useState(230);
    const [isOpeningFolder, setIsOpeningFolder] = useState(false);
    const [openingWorkspacePath, setOpeningWorkspacePath] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; editor: any } | null>(null);
    const [fileMenuOpen, setFileMenuOpen] = useState(false);
    const [isTerminalOpen, setIsTerminalOpen] = useState(false);
    const [terminalTarget, setTerminalTarget] = useState<{ path: string; type: 'folder' | 'file' | 'root'; token: number }>({
        path: '',
        type: 'root',
        token: 0
    });
    const [tabContextMenu, setTabContextMenu] = useState<{
        x: number;
        y: number;
        filePath: string;
        fileName: string;
    } | null>(null);
    const [pinnedFilePaths, setPinnedFilePaths] = useState<string[]>([]);

    const editorInstanceRef = useRef<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const isResizingRef = useRef(false);

    const activeProject = getActiveProject();
    const activeFile = getActiveFile();
    const cleanRecentWorkspaces = (recentWorkspaces || [])
        .filter(rw => !rw.path.startsWith('#<') && !rw.name.includes('CLIXML') && !rw.path.includes('CLIXML'))
        .slice(0, 5);

    // Auto-sync files from physical disk on mount / active project change
    React.useEffect(() => {
        if (activeProjectId) {
            syncFromDisk(activeProjectId);
        }
    }, [activeProjectId]);

    // Intercept browser shortcuts to prevent conflicts when workspace is active
    React.useEffect(() => {
        if (!activeProject) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
            const ctrlOrMeta = e.ctrlKey || e.metaKey;
            if (!ctrlOrMeta) return;

            const key = e.key.toLowerCase();

            // Ctrl + W: Close active tab in IDE
            if (key === 'w' && !e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
                if (activeProject.activeFilePath) closeFile(activeProject.activeFilePath);
                return;
            }

            // Ctrl + S: Save file directly to physical disk
            if (key === 's' && !e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
                if (activeFile && activeProject.rootPath) {
                    syncFileToDisk(activeProject.rootPath, activeFile.path, activeFile.content);
                }
                return;
            }

            // Ctrl + P: Prevent browser print dialog
            if (key === 'p' && !e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            // Ctrl + O: Open folder dialog
            if (key === 'o' && !e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
                handleOpenFolder();
                return;
            }

            // Ctrl + B: Toggle Explorer sidebar
            if (key === 'b' && !e.shiftKey && !isInput) {
                e.preventDefault();
                e.stopPropagation();
                setIsSidebarOpen(prev => !prev);
                return;
            }

            // Ctrl + ` (backtick): Toggle Integrated Terminal
            if ((e.key === '`' || e.key === '~') && !isInput) {
                e.preventDefault();
                e.stopPropagation();
                setIsTerminalOpen(prev => !prev);
                return;
            }
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [activeProject, activeFile, closeFile]);

    const sortedOpenFilePaths = React.useMemo(() => {
        if (!activeProject) return [];
        const pinned = activeProject.openFilePaths.filter(p => pinnedFilePaths.includes(p));
        const unpinned = activeProject.openFilePaths.filter(p => !pinnedFilePaths.includes(p));
        return [...pinned, ...unpinned];
    }, [activeProject?.openFilePaths, pinnedFilePaths]);

    const handleCloseOthers = (keepPath: string) => {
        if (!activeProject) return;
        const toClose = activeProject.openFilePaths.filter(p => p !== keepPath && !pinnedFilePaths.includes(p));
        toClose.forEach(p => closeFile(p));
    };

    const handleCloseAll = () => {
        if (!activeProject) return;
        const toClose = activeProject.openFilePaths.filter(p => !pinnedFilePaths.includes(p));
        toClose.forEach(p => closeFile(p));
    };

    const handleTogglePin = (targetPath: string) => {
        setPinnedFilePaths(prev => 
            prev.includes(targetPath) ? prev.filter(p => p !== targetPath) : [...prev, targetPath]
        );
    };

    const handleCopyTabPath = (targetPath: string) => {
        const fullDisk = resolveDiskPath(activeProject?.rootPath || '', targetPath);
        navigator.clipboard.writeText(fullDisk || targetPath);
    };

    const handleCopyTabRelativePath = (targetPath: string) => {
        navigator.clipboard.writeText(targetPath);
    };

    const handleMouseDownResize = (e: React.MouseEvent) => {
        e.preventDefault();
        isResizingRef.current = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        const onMouseMove = (moveEvent: MouseEvent) => {
            if (!isResizingRef.current || !containerRef.current) return;
            const containerRect = containerRef.current.getBoundingClientRect();
            const newWidth = Math.max(160, Math.min(500, moveEvent.clientX - containerRect.left));
            setSidebarWidth(newWidth);
        };

        const onMouseUp = () => {
            isResizingRef.current = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    const toggleMaximize = () => {
        if (isMaximized) {
            setSplitPaneWidth(50);
            setIsMaximized(false);
        } else {
            setSplitPaneWidth(0);
            setIsMaximized(true);
        }
    };

    const handleClose = () => {
        closeWorkspace();
        setSplitPaneWidth(100);
        setIsMaximized(false);
    };

    const handleOpenFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const content = (event.target?.result as string) || '';
            createFile(file.name, content);
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const handleOpenFolder = async () => {
        if (isOpeningFolder || openingWorkspacePath) return;
        setIsOpeningFolder(true);
        try {
            const path = await pickFolderFromOS();
            if (path && path.trim() && !path.startsWith('#<') && !path.includes('CLIXML')) {
                await openFolder(path.trim());
            }
        } catch (err) {
            console.error('Failed to open folder:', err);
        } finally {
            setIsOpeningFolder(false);
        }
    };

    const handleOpenRecentWorkspace = async (path: string) => {
        if (openingWorkspacePath || isOpeningFolder) return;
        setOpeningWorkspacePath(path);
        try {
            await openFolder(path);
        } catch (err) {
            console.error('Failed to open recent workspace:', err);
        } finally {
            setOpeningWorkspacePath(null);
        }
    };



    const handleTriggerFind = () => {
        if (editorInstanceRef.current) {
            editorInstanceRef.current.focus();
            editorInstanceRef.current.getAction('actions.find')?.run();
        }
    };

    const handleSelectFile = (path: string, lineNumber?: number) => {
        setActiveFile(path);
        if (lineNumber) {
            setTimeout(() => {
                if (editorInstanceRef.current) {
                    editorInstanceRef.current.revealLineInCenter(lineNumber);
                    editorInstanceRef.current.setPosition({ lineNumber, column: 1 });
                    editorInstanceRef.current.focus();
                }
            }, 80);
        }
    };

    const handleOpenTerminal = (targetPath: string = '', targetType: 'folder' | 'file' | 'root' = 'folder') => {
        setTerminalTarget({ path: targetPath, type: targetType, token: Date.now() });
        setIsTerminalOpen(true);
    };

    if (!activeProject) {
        return (
            <div className="h-full w-full flex flex-col bg-[var(--bg-primary)] overflow-hidden font-mono select-none relative">
                {/* Hidden Native File Pickers */}
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleOpenFile}
                />

                {/* Top Workspace Header Bar (Theme Matched) */}
                <div className="h-10 border-b border-[var(--border-color)]/70 bg-[var(--bg-secondary)] flex items-center justify-between px-3 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <img src="/logo.ico" alt="Cluaiz" className="w-4 h-4 object-contain opacity-70" />
                        <span className="text-xs font-semibold text-[var(--text-primary)]">Workspace</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={toggleMaximize}
                            className="p-1.5 rounded hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition-colors"
                            title={isMaximized ? "Restore split" : "Maximize editor"}
                        >
                            {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                        </button>
                        <button
                            type="button"
                            onClick={handleClose}
                            className="p-1.5 rounded hover:bg-white/10 text-zinc-400 hover:text-rose-400 transition-colors"
                            title="Close workspace"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Empty Workspace Hero Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col p-6 text-[var(--text-secondary)] font-sans">
                    <div className="max-w-sm w-full mx-auto my-auto flex flex-col items-center text-center py-6">
                        {/* Centered Cluaiz Logo */}
                        <img
                            src="/logo.ico"
                            alt="Cluaiz Logo"
                            className="w-14 h-14 object-contain opacity-50 mb-2 pointer-events-none drop-shadow-sm transition-opacity hover:opacity-80"
                        />
                        <h2 className="text-base font-semibold text-[var(--text-primary)] tracking-wide mb-6">
                            Cluaiz
                        </h2>

                        <button 
                            type="button" 
                            disabled={isOpeningFolder || !!openingWorkspacePath}
                            onClick={handleOpenFolder} 
                            className="w-full py-2.5 px-4 rounded-lg bg-[var(--accent-color)] hover:opacity-90 text-white font-medium text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-60"
                        >
                            {isOpeningFolder ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Opening Folder...</span>
                                </>
                            ) : (
                                <>
                                    <FolderUp className="w-4 h-4" />
                                    <span>Open Folder</span>
                                </>
                            )}
                        </button>
                        <button 
                            type="button" 
                            onClick={() => setIsTerminalOpen(true)} 
                            className="w-full mt-2.5 py-2.5 px-4 rounded-lg bg-[var(--bg-secondary)] hover:bg-white/5 text-[var(--text-primary)] font-medium text-xs flex items-center justify-center gap-2 border border-[var(--border-color)] transition-all cursor-pointer"
                        >
                            <Terminal className="w-4 h-4 text-[var(--accent-color)]" />
                            <span>Open Terminal</span>
                        </button>

                        {/* Workspaces List (Image 3 Style) */}
                        <div className="w-full mt-8 text-left">
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="text-xs font-semibold text-[var(--text-muted)]">Workspaces</h4>
                                <span className="text-[10px] text-zinc-500 font-mono">Recent</span>
                            </div>

                            {cleanRecentWorkspaces.length > 0 ? (
                                <div className="space-y-1.5">
                                    {cleanRecentWorkspaces.map((rw) => {
                                        const isThisOpening = openingWorkspacePath === rw.path;
                                        return (
                                            <div
                                                key={rw.path}
                                                onClick={() => handleOpenRecentWorkspace(rw.path)}
                                                className={`group p-2.5 rounded-lg bg-[var(--bg-secondary)] hover:bg-white/[0.06] border border-[var(--border-color)]/60 hover:border-[var(--border-color)] cursor-pointer transition-all flex items-center justify-between ${
                                                    isThisOpening ? 'opacity-80 border-[var(--accent-color)]/60 bg-[var(--accent-color)]/5' : ''
                                                }`}
                                            >
                                                <div className="min-w-0 pr-2">
                                                    <div className="text-xs font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-color)] transition-colors truncate flex items-center gap-2">
                                                        <span>{rw.name}</span>
                                                        {isThisOpening && (
                                                            <span className="text-[10px] text-[var(--accent-color)] font-mono flex items-center gap-1">
                                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                                Loading...
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[11px] text-[var(--text-muted)] truncate mt-0.5 font-mono">
                                                        {rw.path}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                                    {isThisOpening ? (
                                                        <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-color)]" />
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                removeRecentWorkspace(rw.path);
                                                            }}
                                                            className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 text-zinc-500 hover:text-zinc-300 transition-all flex-shrink-0"
                                                            title="Remove from recent"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="p-3.5 rounded-lg border border-dashed border-[var(--border-color)]/60 text-[var(--text-muted)] text-[11px] text-center font-mono">
                                    No recent workspaces. Click Open Folder to start.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Bottom Integrated Terminal (Usable even without active project) */}
                <WorkspaceTerminal
                    isOpen={isTerminalOpen}
                    onClose={() => setIsTerminalOpen(false)}
                    terminalTarget={terminalTarget}
                    files={{}}
                    projectName="terminal"
                    rootPath=""
                    onOpenFile={(path) => handleSelectFile(path)}
                />
            </div>
        );
    }

    return (
        <div className="h-full w-full flex flex-col bg-[var(--bg-primary)] overflow-hidden font-mono select-none">
            {/* Top Workspace Header Bar */}
            <div className="h-10 border-b border-[var(--border-color)]/70 bg-[var(--bg-secondary)] flex items-center justify-between px-2 flex-shrink-0">
                {/* Zone 1: FIXED LEFT CONTROLS (Never scroll) */}
                <div className="flex items-center gap-1 flex-shrink-0 mr-1.5">
                    {/* File Menu Dropdown */}
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setFileMenuOpen((prev) => !prev)}
                            className={`px-2 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1 ${
                                fileMenuOpen 
                                    ? 'bg-black/10 dark:bg-white/10 text-[var(--text-primary)]' 
                                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/[0.06]'
                            }`}
                        >
                            <span>File</span>
                            <ChevronDown className="w-3 h-3 opacity-60" />
                        </button>

                        {fileMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setFileMenuOpen(false)} />
                                <div className="absolute left-0 top-full mt-1 w-56 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl shadow-2xl p-1 z-50 font-mono text-xs backdrop-blur-md">
                                    <button type="button" onClick={() => { setFileMenuOpen(false); const name = prompt('Enter new file name:'); if (name?.trim()) createFile(name.trim(), ''); }} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10 text-left text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                                        <FilePlus className="w-3.5 h-3.5 text-blue-400" /><span>New File</span>
                                    </button>
                                    <button type="button" onClick={() => { setFileMenuOpen(false); const name = prompt('Enter new folder name:'); if (name?.trim()) createFolder(name.trim()); }} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10 text-left text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                                        <FolderPlus className="w-3.5 h-3.5 text-amber-400" /><span>New Folder</span>
                                    </button>
                                    <div className="my-1 border-t border-[var(--border-color)]/60" />
                                    <button type="button" onClick={() => { setFileMenuOpen(false); fileInputRef.current?.click(); }} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10 text-left text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                                        <FileUp className="w-3.5 h-3.5 text-emerald-400" /><span>Open File...</span>
                                    </button>
                                    <button type="button" onClick={() => { setFileMenuOpen(false); handleOpenFolder(); }} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10 text-left text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                                        <FolderUp className="w-3.5 h-3.5 text-indigo-400" /><span>Open Folder...</span>
                                    </button>
                                    <div className="my-1 border-t border-[var(--border-color)]/60" />
                                    <button type="button" onClick={() => { setFileMenuOpen(false); handleOpenTerminal(''); }} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10 text-left text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                                        <Terminal className="w-3.5 h-3.5 text-cyan-400" /><span>Open Terminal</span>
                                    </button>
                                    <div className="my-1 border-t border-[var(--border-color)]/60" />
                                    <button type="button" onClick={() => { setFileMenuOpen(false); setActiveProject(null); }} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10 text-left text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                                        <LayoutGrid className="w-3.5 h-3.5 text-indigo-400" /><span>Open Workspace</span>
                                    </button>
                                    <div className="my-1 border-t border-[var(--border-color)]/60" />
                                    <button type="button" onClick={() => { setFileMenuOpen(false); handleClose(); }} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-rose-500/20 text-left text-rose-400 hover:text-rose-300 transition-colors">
                                        <LogOut className="w-3.5 h-3.5" /><span>Close Workspace</span>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Fixed Sidebar Toggle Button */}
                    <Tooltip title={isSidebarOpen ? "Collapse Explorer" : "Expand Explorer"}>
                        <button
                            type="button"
                            onClick={() => setIsSidebarOpen((prev) => !prev)}
                            className={isSidebarOpen ? "ui-icon-btn ui-icon-btn-active" : "ui-icon-btn"}
                        >
                            <PanelLeft className="w-3.5 h-3.5" />
                        </button>
                    </Tooltip>

                    <div className="h-4 w-px bg-[var(--border-color)]/60 mx-1 flex-shrink-0" />
                </div>

                {/* Zone 2: SCROLLABLE OPEN FILE TABS (Only tabs scroll horizontally!) */}
                <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar flex-1 mr-2 px-0.5">
                    {sortedOpenFilePaths.map((filePath) => {
                        const file = activeProject.files[filePath];
                        if (!file) return null;
                        const isActive = filePath === activeProject.activeFilePath;
                        const isPinned = pinnedFilePaths.includes(filePath);

                        return (
                            <div
                                key={filePath}
                                onClick={() => setActiveFile(filePath)}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setTabContextMenu({
                                        x: e.clientX,
                                        y: e.clientY,
                                        filePath,
                                        fileName: file.name
                                    });
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t text-xs font-mono transition-colors cursor-pointer flex-shrink-0 group/tab select-none ${
                                    isActive ? 'ui-tab-active' : 'ui-tab-inactive'
                                }`}
                            >
                                <FileIcon fileName={file.name} fileExtension={getFileExtension(file.name)} languageId={getFileExtension(file.name)} size={13} />
                                <span className="truncate max-w-[130px]">{file.name}</span>
                                {isPinned && (
                                    <Pin className="w-2.5 h-2.5 text-amber-400/80 -rotate-45 shrink-0" />
                                )}
                                {file.isModified && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-color)]" />
                                )}
                                {!isPinned && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            closeFile(filePath);
                                        }}
                                        className={`p-0.5 rounded transition-all ${
                                            isActive
                                                ? 'hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] opacity-70 group-hover/tab:opacity-100'
                                                : 'hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] opacity-0 group-hover/tab:opacity-100'
                                        }`}
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Hidden Native File Pickers */}
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleOpenFile}
                    />

                    <Tooltip title={isMaximized ? "Restore split" : "Maximize editor"}>
                        <button
                            type="button"
                            onClick={toggleMaximize}
                            className="ui-icon-btn"
                        >
                            {isMaximized ? (
                                <Minimize2 className="w-3.5 h-3.5" />
                            ) : (
                                <Maximize2 className="w-3.5 h-3.5" />
                            )}
                        </button>
                    </Tooltip>

                    <Tooltip title="Close workspace">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="ui-icon-btn hover:text-rose-400"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </Tooltip>
                </div>
            </div>

            {/* Split Workspace Body: File Tree (Left) + Monaco CodeEditor (Right) */}
            <div ref={containerRef} className="flex-1 flex overflow-hidden relative">

                {/* Explorer File Tree Sub-Panel (Resizable) */}
                {isSidebarOpen && (
                    <div
                        style={{ width: `${sidebarWidth}px` }}
                        className="h-full border-r border-[var(--border-color)]/60 bg-[var(--bg-secondary)]/60 flex-shrink-0 overflow-hidden"
                    >
                        <WorkspaceFileTree
                            files={activeProject.files}
                            folders={activeProject.folders || []}
                            activeFilePath={activeProject.activeFilePath}
                            workspaceName={activeProject.name}
                            rootPath={activeProject.rootPath}
                            onSelectFile={handleSelectFile}
                            onCreateFile={(fileName) => createFile(fileName)}
                            onCreateFolder={(folderName) => createFolder(folderName)}
                            onDeleteFile={(filePath) => deleteFile(filePath)}
                            onRenameFile={(oldP, newP) => renameFile(oldP, newP)}
                            onCopyFile={(srcP, destP) => copyFile(srcP, destP)}
                            onOpenTerminal={handleOpenTerminal}
                            onRefresh={() => syncFromDisk()}
                            isSyncing={isSyncing}
                        />
                    </div>
                )}

                {/* Resizer Handle */}
                {isSidebarOpen && (
                    <div
                        onMouseDown={handleMouseDownResize}
                        className="w-1 hover:w-1.5 active:w-1.5 -ml-0.5 cursor-col-resize hover:bg-[var(--accent-color)]/60 active:bg-[var(--accent-color)] transition-all z-20 flex-shrink-0 select-none"
                        title="Drag to resize explorer"
                    />
                )}

                {/* Monaco Editor Container */}
                <div className="flex-1 h-full bg-[var(--bg-primary)] overflow-hidden flex flex-col relative">
                    {activeFile ? (
                        <>
                            {/* VS Code Style Breadcrumbs Bar */}
                            <div className="h-6 border-b border-[var(--border-color)]/60 bg-[var(--bg-secondary)]/40 flex items-center px-3 text-[11px] font-mono text-[var(--text-muted)] gap-1.5 flex-shrink-0 select-none overflow-x-auto custom-scrollbar">
                                <span className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1">
                                    <FolderGit2 className="w-3 h-3 text-[var(--accent-color)]" />
                                    {activeProject.name || 'Workspace'}
                                </span>
                                {activeFile.path.split('/').map((seg, idx, arr) => {
                                    const isLast = idx === arr.length - 1;
                                    return (
                                        <React.Fragment key={idx}>
                                            <span className="text-[var(--text-muted)]/50">/</span>
                                            <span className={isLast ? 'text-[var(--text-primary)] font-medium flex items-center gap-1' : 'text-[var(--text-muted)]'}>
                                                {isLast && <FileIcon fileName={seg} fileExtension={getFileExtension(seg)} languageId={getFileExtension(seg)} size={12} />}
                                                {seg}
                                            </span>
                                        </React.Fragment>
                                    );
                                })}
                            </div>

                            {/* Monaco Editor or Rich Preview / Loading Skeleton */}
                            <div className="flex-1 overflow-hidden relative">
                                {isLoadingFile ? (
                                    <EditorLoadingSkeleton fileName={activeFile.name} />
                                ) : isPreviewableFile(activeFile.name) ? (
                                    <FilePreviewDispatcher
                                        filePath={activeFile.path}
                                        fileName={activeFile.name}
                                        content={activeFile.content}
                                        rootPath={activeProject?.rootPath || ''}
                                        onChangeContent={(newVal) => updateFileContent(activeFile.path, newVal)}
                                    />
                                ) : (
                                    <CodeEditor
                                        value={activeFile.content}
                                        language={activeFile.language}
                                        onChange={(newVal) => updateFileContent(activeFile.path, newVal)}
                                        height="100%"
                                        className="h-full border-0 rounded-none shadow-none"
                                        showToolbar={false}
                                        onMount={(editor) => {
                                            editorInstanceRef.current = editor;
                                        }}
                                        onContextMenu={(coords) => {
                                            setContextMenu(coords);
                                        }}
                                    />
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="h-full w-full flex items-center justify-center text-[var(--text-muted)] font-mono text-xs">
                            Select a file from the explorer to view and edit
                        </div>
                    )}

                    {/* Bottom Integrated Terminal Panel */}
                    <WorkspaceTerminal
                        isOpen={isTerminalOpen}
                        onClose={() => setIsTerminalOpen(false)}
                        terminalTarget={terminalTarget}
                        files={activeProject.files}
                        projectName={activeProject.name}
                        rootPath={activeProject.rootPath}
                        onOpenFile={(path) => handleSelectFile(path)}
                    />
                </div>
            </div>

            {/* Custom Dark Rounded Context Menu */}
            {contextMenu && (
                <EditorContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    isOpen={!!contextMenu}
                    onClose={() => setContextMenu(null)}
                    editor={contextMenu.editor || editorInstanceRef.current}
                />
            )}

            {/* Editor Tab Right-Click Context Menu */}
            {tabContextMenu && (
                <EditorTabContextMenu
                    x={tabContextMenu.x}
                    y={tabContextMenu.y}
                    isOpen={!!tabContextMenu}
                    filePath={tabContextMenu.filePath}
                    fileName={tabContextMenu.fileName}
                    isPinned={pinnedFilePaths.includes(tabContextMenu.filePath)}
                    onClose={() => setTabContextMenu(null)}
                    onCloseTab={(p) => closeFile(p)}
                    onCloseOthers={handleCloseOthers}
                    onCloseAll={handleCloseAll}
                    onTogglePin={handleTogglePin}
                    onCopyPath={handleCopyTabPath}
                    onCopyRelativePath={handleCopyTabRelativePath}
                />
            )}
        </div>
    );
};


import React, { useState } from 'react';
import { Play, Maximize2, Minimize2, X, Download, FolderGit2 } from 'lucide-react';
import { useProjectStore } from '../store/useProjectStore';
import { WorkspaceFileTree } from './WorkspaceFileTree';
import { CodeEditor } from '../../../components/ui/CodeEditor/CodeEditor';
import { useLayoutStore } from '../../../store/ui/useLayoutStore';
import { Tooltip } from '../../../components/ui/tooltip';

export const WorkspaceEditorPane: React.FC = () => {
    const {
        projects,
        activeProjectId,
        setActiveFile,
        closeFile,
        updateFileContent,
        closeWorkspace,
        getActiveProject,
        getActiveFile
    } = useProjectStore();

    const { splitPaneWidth, setSplitPaneWidth } = useLayoutStore();
    const [isMaximized, setIsMaximized] = useState(false);
    const [isRunning, setIsRunning] = useState(false);

    const activeProject = getActiveProject();
    const activeFile = getActiveFile();

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

    const handleDownloadAll = () => {
        if (!activeProject) return;
        // Download all files as a combined text package or individual files
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(activeProject.files, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `${activeProject.name || 'project'}-files.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    };

    const handleRun = () => {
        if (!activeFile) return;
        setIsRunning(true);
        setTimeout(() => {
            setIsRunning(false);
        }, 1200);
    };

    if (!activeProject) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center bg-[var(--bg-secondary)] text-zinc-500 font-mono text-xs">
                <FolderGit2 className="w-10 h-10 mb-2 text-zinc-600 opacity-60" />
                <p>No active project open</p>
                <button
                    onClick={handleClose}
                    className="mt-3 px-3 py-1 rounded bg-white/5 hover:bg-white/10 text-zinc-300 transition-colors"
                >
                    Close Pane
                </button>
            </div>
        );
    }

    return (
        <div className="h-full w-full flex flex-col bg-[var(--bg-primary)] overflow-hidden font-mono select-none">
            {/* Top Workspace Header Bar */}
            <div className="h-10 border-b border-[var(--border-color)]/70 bg-[var(--bg-secondary)] flex items-center justify-between px-2 flex-shrink-0">
                {/* Left: Project title & Open File Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar flex-1 mr-2">
                    <span className="text-[11px] font-bold text-[var(--accent-color)] uppercase tracking-wider flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--accent-color)]/10 flex-shrink-0">
                        <FolderGit2 className="w-3.5 h-3.5" />
                        {activeProject.name}
                    </span>

                    <div className="h-4 w-px bg-white/10 mx-1 flex-shrink-0" />

                    {activeProject.openFilePaths.map((filePath) => {
                        const file = activeProject.files[filePath];
                        if (!file) return null;
                        const isActive = filePath === activeProject.activeFilePath;

                        return (
                            <div
                                key={filePath}
                                onClick={() => setActiveFile(filePath)}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono transition-all cursor-pointer flex-shrink-0 group/tab ${
                                    isActive
                                        ? 'bg-[var(--bg-primary)] text-white border border-[var(--border-color)] shadow-sm'
                                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                                }`}
                            >
                                <span className="truncate max-w-[130px]">{file.name}</span>
                                {file.isModified && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-color)]" />
                                )}
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        closeFile(filePath);
                                    }}
                                    className="p-0.5 rounded hover:bg-white/10 text-zinc-500 hover:text-zinc-300 opacity-60 group-hover/tab:opacity-100 transition-opacity"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        );
                    })}
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                    <Tooltip title="Run file">
                        <button
                            type="button"
                            onClick={handleRun}
                            disabled={isRunning || !activeFile}
                            className={`p-1.5 rounded hover:bg-white/10 text-zinc-400 hover:text-emerald-400 transition-colors ${
                                isRunning ? 'animate-pulse text-emerald-400' : ''
                            }`}
                        >
                            <Play className="w-3.5 h-3.5 fill-current" />
                        </button>
                    </Tooltip>

                    <Tooltip title="Export project files">
                        <button
                            type="button"
                            onClick={handleDownloadAll}
                            className="p-1.5 rounded hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition-colors"
                        >
                            <Download className="w-3.5 h-3.5" />
                        </button>
                    </Tooltip>

                    <Tooltip title={isMaximized ? "Restore split" : "Maximize editor"}>
                        <button
                            type="button"
                            onClick={toggleMaximize}
                            className="p-1.5 rounded hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition-colors"
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
                            className="p-1.5 rounded hover:bg-white/10 text-zinc-400 hover:text-rose-400 transition-colors"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </Tooltip>
                </div>
            </div>

            {/* Split Workspace Body: File Tree (Left) + Monaco CodeEditor (Right) */}
            <div className="flex-1 flex overflow-hidden">
                {/* Explorer File Tree Sub-Panel (210px) */}
                <div className="w-[210px] h-full border-r border-[var(--border-color)]/60 bg-[var(--bg-secondary)]/60 flex-shrink-0">
                    <WorkspaceFileTree
                        files={activeProject.files}
                        activeFilePath={activeProject.activeFilePath}
                        onSelectFile={(path) => setActiveFile(path)}
                    />
                </div>

                {/* Monaco Editor Container */}
                <div className="flex-1 h-full bg-[var(--bg-primary)] overflow-hidden relative">
                    {activeFile ? (
                        <CodeEditor
                            value={activeFile.content}
                            language={activeFile.language}
                            onChange={(newVal) => updateFileContent(activeFile.path, newVal)}
                            height="100%"
                            className="h-full border-0"
                        />
                    ) : (
                        <div className="h-full w-full flex items-center justify-center text-zinc-500 font-mono text-xs">
                            Select a file from the explorer to view and edit
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

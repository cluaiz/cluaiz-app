import React, { useState, useMemo } from 'react';
import { 
    ChevronDown, 
    ChevronRight, 
    FilePlus, 
    FolderPlus,
    Search,
    ChevronsDownUp,
    X,
    CaseSensitive,
    RefreshCw,
    Loader2
} from 'lucide-react';
import { FileIcon, FolderIcon } from 'react-material-icon-theme';
import { FileTreeNode, ProjectFile } from '../types';
import { FileTreeContextMenu, FileTreeContextTarget } from './FileTreeContextMenu';
import { resolveDiskPath } from '../../../utils/mediaResolver';
import { useProjectStore } from '../../../store/workspace/useProjectStore';

interface WorkspaceFileTreeProps {
    files: Record<string, ProjectFile>;
    folders?: string[];
    activeFilePath: string;
    workspaceName?: string;
    rootPath?: string;
    onSelectFile: (path: string, lineNumber?: number) => void;
    onCreateFile?: (path: string) => void;
    onCreateFolder?: (folderPath: string) => void;
    onDeleteFile?: (path: string) => void;
    onRenameFile?: (oldPath: string, newPath: string) => void;
    onCopyFile?: (srcPath: string, destPath: string) => void;
    onDownloadFile?: (path: string) => void;
    onOpenTerminal?: (path: string, type: 'folder' | 'file' | 'root') => void;
    onRefresh?: () => void;
    isSyncing?: boolean;
}

export const getFileExtension = (name?: string): string | undefined => {
    if (!name || !name.includes('.')) return undefined;
    return name.split('.').pop()?.toLowerCase();
};

function buildFileTree(files: Record<string, ProjectFile>, folders: string[] = []): FileTreeNode[] {
    const rootNodes: FileTreeNode[] = [];
    const folderMap = new Map<string, FileTreeNode>();

    const ensureFolder = (folderPath: string): FileTreeNode => {
        const norm = folderPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
        if (folderMap.has(norm)) return folderMap.get(norm)!;
        const parts = norm.split('/').filter(Boolean);
        let curr = '', parentNode: FileTreeNode | null = null;
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i], prev = curr;
            curr = curr ? `${curr}/${part}` : part;
            if (!folderMap.has(curr)) {
                const node: FileTreeNode = { id: curr, name: part, path: curr, isFolder: true, children: [] };
                folderMap.set(curr, node);
                if (prev && folderMap.has(prev)) folderMap.get(prev)!.children!.push(node);
                else if (!prev) rootNodes.push(node);
            }
            parentNode = folderMap.get(curr)!;
        }
        return parentNode!;
    };

    for (const f of folders) { if (f) ensureFolder(f); }

    for (const rawFilePath of Object.keys(files).sort()) {
        const filePath = rawFilePath.replace(/\\/g, '/');
        const parts = filePath.split('/').filter(Boolean);
        if (!parts.length) continue;
        const fileName = parts[parts.length - 1];
        const dirPath = parts.slice(0, -1).join('/');
        const fileNode: FileTreeNode = { id: filePath, name: fileName, path: filePath, isFolder: false, extension: fileName.split('.').pop()?.toLowerCase() };
        if (dirPath) ensureFolder(dirPath).children!.push(fileNode);
        else rootNodes.push(fileNode);
    }

    const sortNodes = (nodes: FileTreeNode[]) => {
        nodes.sort((a, b) => a.isFolder === b.isFolder ? a.name.localeCompare(b.name) : a.isFolder ? -1 : 1);
        for (const n of nodes) { if (n.children?.length) sortNodes(n.children); }
    };
    sortNodes(rootNodes);
    return rootNodes;
}

export const WorkspaceFileTree: React.FC<WorkspaceFileTreeProps> = ({
    files,
    folders = [],
    activeFilePath,
    workspaceName,
    rootPath,
    onSelectFile,
    onCreateFile,
    onCreateFolder,
    onDeleteFile,
    onRenameFile,
    onCopyFile,
    onDownloadFile,
    onOpenTerminal,
    onRefresh,
    isSyncing
}) => {
    const [clipboard, setClipboard] = useState<{
        action: 'cut' | 'copy';
        targetPath: string;
        isFolder: boolean;
        name: string;
    } | null>(null);
    const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
    const [loadingFolders, setLoadingFolders] = useState<Record<string, boolean>>({});
    const [isCreating, setIsCreating] = useState<'file' | 'folder' | null>(null);
    const [creationParentFolder, setCreationParentFolder] = useState<string>('');
    const [selectedFolderPath, setSelectedFolderPath] = useState<string>('');
    const [newItemName, setNewItemName] = useState('');
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; target: FileTreeContextTarget } | null>(null);
    const [renamingPath, setRenamingPath] = useState<string | null>(null);
    const [renameVal, setRenameVal] = useState('');

    // Global Workspace Search States
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isCaseSensitive, setIsCaseSensitive] = useState(false);
    const [collapsedSearchFiles, setCollapsedSearchFiles] = useState<Record<string, boolean>>({});

    const treeNodes = useMemo(() => buildFileTree(files, folders), [files, folders]);

    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const query = isCaseSensitive ? searchQuery : searchQuery.toLowerCase();
        const results: Array<{
            filePath: string;
            fileName: string;
            matches: Array<{
                filePath: string;
                lineNumber: number;
                lineContent: string;
            }>;
        }> = [];

        for (const [filePath, file] of Object.entries(files)) {
            if (!file.content) continue;
            const lines = file.content.split('\n');
            const fileMatches: Array<{
                filePath: string;
                lineNumber: number;
                lineContent: string;
            }> = [];

            lines.forEach((line, idx) => {
                const lineToCheck = isCaseSensitive ? line : line.toLowerCase();
                if (lineToCheck.includes(query)) {
                    fileMatches.push({
                        filePath,
                        lineNumber: idx + 1,
                        lineContent: line.trim()
                    });
                }
            });

            if (fileMatches.length > 0) {
                results.push({
                    filePath,
                    fileName: file.name,
                    matches: fileMatches
                });
            }
        }
        return results;
    }, [files, searchQuery, isCaseSensitive]);

    const totalMatches = useMemo(() => {
        return searchResults.reduce((acc, r) => acc + r.matches.length, 0);
    }, [searchResults]);

    // Expand directory path of active file only
    React.useEffect(() => {
        if (activeFilePath && activeFilePath.includes('/')) {
            const parts = activeFilePath.split('/');
            let acc = '';
            const toExpand: Record<string, boolean> = {};
            for (let i = 0; i < parts.length - 1; i++) {
                acc = acc ? `${acc}/${parts[i]}` : parts[i];
                toExpand[acc] = true;
            }
            setExpandedFolders(prev => ({ ...prev, ...toExpand }));
        }
    }, [activeFilePath]);

    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;

            const currentPath = activeFilePath || selectedFolderPath;
            if (!currentPath) return;

            const isFolder = !!folders.includes(currentPath);
            const fileName = currentPath.split('/').pop() || currentPath;

            if (e.ctrlKey && e.key.toLowerCase() === 'x') {
                e.preventDefault();
                setClipboard({ action: 'cut', targetPath: currentPath, isFolder, name: fileName });
            } else if (e.ctrlKey && e.key.toLowerCase() === 'c') {
                e.preventDefault();
                setClipboard({ action: 'copy', targetPath: currentPath, isFolder, name: fileName });
            } else if (e.ctrlKey && e.key.toLowerCase() === 'v') {
                if (!clipboard) return;
                e.preventDefault();
                const destFolder = isFolder 
                    ? currentPath 
                    : currentPath.includes('/') ? currentPath.substring(0, currentPath.lastIndexOf('/')) : '';
                const baseName = clipboard.name;
                const newPath = destFolder ? `${destFolder}/${baseName}` : baseName;

                if (newPath === clipboard.targetPath) {
                    if (clipboard.action === 'copy') {
                        const copyName = clipboard.isFolder
                            ? `${baseName}-copy`
                            : `${baseName.includes('.') ? baseName.substring(0, baseName.lastIndexOf('.')) : baseName}-copy${baseName.includes('.') ? `.${baseName.split('.').pop()}` : ''}`;
                        const copyPath = destFolder ? `${destFolder}/${copyName}` : copyName;
                        if (onCopyFile) onCopyFile(clipboard.targetPath, copyPath);
                        else onCreateFile?.(copyPath);
                    }
                    return;
                }

                if (clipboard.action === 'cut') {
                    onRenameFile?.(clipboard.targetPath, newPath);
                    setClipboard(null);
                } else if (clipboard.action === 'copy') {
                    if (onCopyFile) onCopyFile(clipboard.targetPath, newPath);
                    else onCreateFile?.(newPath);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeFilePath, selectedFolderPath, clipboard, folders, onRenameFile, onCopyFile, onCreateFile]);

    const toggleFolder = async (folderPath: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const nextState = !expandedFolders[folderPath];
        setExpandedFolders(prev => ({ ...prev, [folderPath]: nextState }));

        if (nextState) {
            setLoadingFolders(prev => ({ ...prev, [folderPath]: true }));
            try {
                await useProjectStore.getState().loadFolderChildren(folderPath);
            } finally {
                setLoadingFolders(prev => ({ ...prev, [folderPath]: false }));
            }
        }
    };

    const handleCollapseAll = () => {
        const allCollapsed: Record<string, boolean> = {};
        const markAll = (nodes: FileTreeNode[]) => {
            for (const n of nodes) {
                if (n.isFolder) {
                    allCollapsed[n.path] = false;
                    if (n.children) markAll(n.children);
                }
            }
        };
        markAll(treeNodes);
        setExpandedFolders(allCollapsed);
    };

    const renderNode = (node: FileTreeNode, depth = 0) => {
        const isExpanded = !!expandedFolders[node.path];
        const isLoading = !!loadingFolders[node.path];
        const isActive = node.path === activeFilePath;
        const isFolderSelected = selectedFolderPath === node.path;
        const isCut = clipboard?.action === 'cut' && (clipboard.targetPath === node.path || node.path.startsWith(`${clipboard.targetPath}/`));
        const isCopied = clipboard?.action === 'copy' && (clipboard.targetPath === node.path || node.path.startsWith(`${clipboard.targetPath}/`));

        if (node.isFolder) {
            return (
                <div key={node.id} className="select-none">
                    <div
                        onClick={(e) => {
                            toggleFolder(node.path, e);
                            setSelectedFolderPath(node.path);
                        }}
                        onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedFolderPath(node.path);
                            setContextMenu({
                                x: e.clientX,
                                y: e.clientY,
                                target: { type: 'folder', path: node.path, name: node.name }
                            });
                        }}
                        className={`flex items-center gap-1.5 py-1 px-2 rounded-md cursor-pointer transition-colors text-xs font-mono group select-none ${
                            isFolderSelected ? 'ui-tree-item-active' : 'ui-tree-item-inactive'
                        } ${isCut ? 'opacity-40 transition-opacity' : ''} ${isCopied && clipboard.targetPath === node.path ? 'ring-1 ring-cyan-500/50 bg-cyan-500/10' : ''}`}
                        style={{ paddingLeft: `${depth * 12 + 8}px` }}
                    >
                        <span className="text-zinc-500 group-hover:text-zinc-300 transition-colors flex items-center justify-center w-3.5 h-3.5">
                            {isLoading ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--accent-color)]" />
                            ) : isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                            )}
                        </span>
                        <FolderIcon folderName={node.name} isOpen={isExpanded} size={15} />
                        {renamingPath === node.path ? (
                            <input
                                type="text"
                                value={renameVal}
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => setRenameVal(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleRenameSubmit(node.path);
                                    else if (e.key === 'Escape') setRenamingPath(null);
                                }}
                                onBlur={() => handleRenameSubmit(node.path)}
                                className="bg-zinc-800 text-xs text-white border border-[var(--accent-color)]/60 rounded px-1 py-0.5 outline-none font-mono flex-1"
                            />
                        ) : (
                            <span className="truncate flex-1">{node.name}</span>
                        )}
                    </div>

                    {isExpanded && (
                        <div className="border-l border-[var(--border-color)]/50 ml-3">
                            {/* In-tree nested creation directly inside this folder */}
                            {isCreating && creationParentFolder === node.path && (
                                <div 
                                    className="my-1 mr-1 flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)]"
                                    style={{ paddingLeft: `${(depth + 1) * 12 + 6}px` }}
                                >
                                    {isCreating === 'file' ? (
                                        <FileIcon 
                                            fileName={newItemName || 'file'} 
                                            fileExtension={getFileExtension(newItemName)} 
                                            languageId={getFileExtension(newItemName)} 
                                            size={15} 
                                        />
                                    ) : (
                                        <FolderIcon folderName={newItemName || 'folder'} isOpen={false} size={15} />
                                    )}
                                    <input
                                        type="text"
                                        value={newItemName}
                                        autoFocus
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => setNewItemName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleCreateSubmit();
                                            else if (e.key === 'Escape') {
                                                setIsCreating(null);
                                                setCreationParentFolder('');
                                                setNewItemName('');
                                            }
                                        }}
                                        onBlur={handleCreateSubmit}
                                        placeholder={isCreating === 'file' ? 'filename.ext' : 'folder-name'}
                                        className="bg-transparent text-xs text-[var(--text-primary)] outline-none w-full font-mono placeholder:text-[var(--text-muted)]"
                                    />
                                </div>
                            )}
                            {isLoading && (!node.children || node.children.length === 0) && (
                                <div 
                                    className="flex items-center gap-1.5 py-1 px-2 text-[11px] text-zinc-400 font-mono italic animate-pulse"
                                    style={{ paddingLeft: `${(depth + 1) * 12 + 6}px` }}
                                >
                                    <Loader2 className="w-3 h-3 animate-spin text-[var(--accent-color)]" />
                                    <span>Loading folder...</span>
                                </div>
                            )}
                            {node.children && node.children.map(child => renderNode(child, depth + 1))}
                        </div>
                    )}
                </div>
            );
        }

        return (
            <div
                key={node.id}
                onClick={() => {
                    onSelectFile(node.path);
                    const parent = node.path.includes('/') ? node.path.substring(0, node.path.lastIndexOf('/')) : '';
                    setSelectedFolderPath(parent);
                }}
                onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const parent = node.path.includes('/') ? node.path.substring(0, node.path.lastIndexOf('/')) : '';
                    setSelectedFolderPath(parent);
                    setContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        target: { type: 'file', path: node.path, name: node.name }
                    });
                }}
                className={`flex items-center gap-1.5 py-1 px-2 rounded-md cursor-pointer transition-colors text-xs font-mono select-none group ${
                    isActive ? 'ui-tree-item-active' : 'ui-tree-item-inactive'
                } ${isCut ? 'opacity-40 transition-opacity' : ''} ${isCopied && clipboard.targetPath === node.path ? 'ring-1 ring-cyan-500/50 bg-cyan-500/10' : ''}`}
                style={{ paddingLeft: `${depth * 12 + 14}px` }}
            >
                <FileIcon 
                    fileName={node.name} 
                    fileExtension={getFileExtension(node.name)} 
                    languageId={getFileExtension(node.name)} 
                    size={15} 
                />
                {renamingPath === node.path ? (
                    <input
                        type="text"
                        value={renameVal}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setRenameVal(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameSubmit(node.path);
                            else if (e.key === 'Escape') setRenamingPath(null);
                        }}
                        onBlur={() => handleRenameSubmit(node.path)}
                        className="bg-[var(--bg-secondary)] text-xs text-[var(--text-primary)] border border-[var(--border-color)] focus:border-[var(--accent-color)] rounded px-1 py-0.5 outline-none font-mono flex-1"
                    />
                ) : (
                    <span className="truncate flex-1">{node.name}</span>
                )}
            </div>
        );
    };

    const handleCreateSubmit = () => {
        const name = newItemName.trim();
        if (name) {
            const targetPath = creationParentFolder ? `${creationParentFolder}/${name}` : name;
            if (isCreating === 'file') onCreateFile?.(targetPath);
            else if (isCreating === 'folder') onCreateFolder?.(targetPath);
        }
        setIsCreating(null);
        setCreationParentFolder('');
        setNewItemName('');
    };

    const handleRenameSubmit = (oldPath: string) => {
        const trimmed = renameVal.trim();
        if (trimmed && trimmed !== oldPath) {
            const parts = oldPath.split('/');
            parts[parts.length - 1] = trimmed;
            const newPath = parts.join('/');
            onRenameFile?.(oldPath, newPath);
        }
        setRenamingPath(null);
    };

    const handleContextMenuAction = (actionId: string, target: FileTreeContextTarget) => {
        switch (actionId) {
            case 'new_file': {
                const parent = target.type === 'folder' 
                    ? target.path 
                    : (target.path.includes('/') ? target.path.substring(0, target.path.lastIndexOf('/')) : '');
                setIsCreating('file');
                setCreationParentFolder(parent);
                setNewItemName('');
                if (parent) {
                    setExpandedFolders(prev => ({ ...prev, [parent]: true }));
                }
                break;
            }
            case 'new_folder': {
                const parent = target.type === 'folder' 
                    ? target.path 
                    : (target.path.includes('/') ? target.path.substring(0, target.path.lastIndexOf('/')) : '');
                setIsCreating('folder');
                setCreationParentFolder(parent);
                setNewItemName('');
                if (parent) {
                    setExpandedFolders(prev => ({ ...prev, [parent]: true }));
                }
                break;
            }
            case 'rename':
                setRenamingPath(target.path);
                setRenameVal(target.name);
                break;
            case 'delete':
                onDeleteFile?.(target.path);
                break;
            case 'copy_path': {
                const fullDisk = resolveDiskPath(rootPath || '', target.path);
                navigator.clipboard.writeText(fullDisk || target.path);
                break;
            }
            case 'copy_relative_path':
                navigator.clipboard.writeText(target.path);
                break;
            case 'cut':
                setClipboard({
                    action: 'cut',
                    targetPath: target.path,
                    isFolder: target.type === 'folder',
                    name: target.name
                });
                break;
            case 'copy':
                setClipboard({
                    action: 'copy',
                    targetPath: target.path,
                    isFolder: target.type === 'folder',
                    name: target.name
                });
                break;
            case 'paste': {
                if (!clipboard) break;
                const destFolder = target.type === 'folder' 
                    ? target.path 
                    : target.type === 'file' && target.path.includes('/')
                        ? target.path.substring(0, target.path.lastIndexOf('/'))
                        : '';
                const baseName = clipboard.name;
                const newPath = destFolder ? `${destFolder}/${baseName}` : baseName;

                if (newPath === clipboard.targetPath) {
                    if (clipboard.action === 'copy') {
                        const copyName = clipboard.isFolder
                            ? `${baseName}-copy`
                            : `${baseName.includes('.') ? baseName.substring(0, baseName.lastIndexOf('.')) : baseName}-copy${baseName.includes('.') ? `.${baseName.split('.').pop()}` : ''}`;
                        const copyPath = destFolder ? `${destFolder}/${copyName}` : copyName;
                        if (onCopyFile) onCopyFile(clipboard.targetPath, copyPath);
                        else onCreateFile?.(copyPath);
                    }
                    break;
                }

                if (clipboard.action === 'cut') {
                    onRenameFile?.(clipboard.targetPath, newPath);
                    setClipboard(null);
                } else if (clipboard.action === 'copy') {
                    if (onCopyFile) onCopyFile(clipboard.targetPath, newPath);
                    else onCreateFile?.(newPath);
                }
                break;
            }
            case 'open_terminal': {
                onOpenTerminal?.(target.path, target.type as 'folder' | 'file' | 'root');
                break;
            }
            default:
                break;
        }
    };

    return (
        <div 
            className="w-full h-full flex flex-col overflow-hidden select-none"
            onClick={() => setSelectedFolderPath('')}
            onContextMenu={(e) => {
                if (!e.defaultPrevented) {
                    e.preventDefault();
                    setSelectedFolderPath('');
                    setContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        target: { type: 'root', path: '', name: 'Workspace' }
                    });
                }
            }}
        >
            {/* Fixed Explorer Header (Never scrolls with file list) */}
            <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center justify-between border-b border-transparent flex-shrink-0 bg-[var(--bg-secondary)]/80 backdrop-blur-sm">
                <span className="truncate text-[var(--text-primary)] font-semibold" title={workspaceName || 'Explorer'}>
                    {selectedFolderPath 
                        ? `${(workspaceName || 'Explorer').toUpperCase()} · /${selectedFolderPath}` 
                        : (workspaceName || 'Explorer').toUpperCase()}
                </span>
                <div className="flex items-center gap-0.5">
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsCreating('file');
                            setCreationParentFolder(selectedFolderPath);
                            setNewItemName('');
                            if (selectedFolderPath) {
                                setExpandedFolders(prev => ({ ...prev, [selectedFolderPath]: true }));
                            }
                        }}
                        title={selectedFolderPath ? `New File in ${selectedFolderPath}` : "New File at root"}
                        className="ui-icon-btn"
                    >
                        <FilePlus className="w-3.5 h-3.5" />
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsCreating('folder');
                            setCreationParentFolder(selectedFolderPath);
                            setNewItemName('');
                            if (selectedFolderPath) {
                                setExpandedFolders(prev => ({ ...prev, [selectedFolderPath]: true }));
                            }
                        }}
                        title={selectedFolderPath ? `New Folder in ${selectedFolderPath}` : "New Folder at root"}
                        className="ui-icon-btn"
                    >
                        <FolderPlus className="w-3.5 h-3.5" />
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsSearchOpen(prev => !prev);
                        }}
                        title={isSearchOpen ? "Close Search" : "Search in Workspace (Global Search)"}
                        className={isSearchOpen ? "ui-icon-btn ui-icon-btn-active" : "ui-icon-btn"}
                    >
                        <Search className="w-3.5 h-3.5" />
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleCollapseAll();
                        }}
                        title="Collapse Folders in Explorer"
                        className="ui-icon-btn"
                    >
                        <ChevronsDownUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                        type="button"
                        onClick={async (e) => {
                            e.stopPropagation();
                            onRefresh?.();
                            const openDirs = Object.keys(expandedFolders).filter(f => expandedFolders[f]);
                            if (openDirs.length > 0) {
                                await Promise.all(openDirs.map(dir => useProjectStore.getState().loadFolderChildren(dir)));
                            }
                        }}
                        title="Sync & Refresh files from Disk"
                        className={`ui-icon-btn ${isSyncing ? 'animate-spin text-[var(--accent-color)]' : ''}`}
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Global Workspace Search Bar */}
            {isSearchOpen && (
                <div className="p-2 border-b border-[var(--border-color)]/60 bg-[var(--bg-secondary)] flex flex-col gap-1.5 flex-shrink-0">
                    <div className="flex items-center gap-1 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded px-2 py-1 focus-within:border-[var(--accent-color)] transition-colors">
                        <Search className="w-3 h-3 text-[var(--text-muted)] flex-shrink-0" />
                        <input
                            type="text"
                            autoFocus
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search across files..."
                            className="bg-transparent text-xs text-[var(--text-primary)] outline-none w-full font-mono placeholder:text-[var(--text-muted)]"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                            >
                                <X className="w-2.5 h-2.5" />
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setIsCaseSensitive(prev => !prev)}
                            title="Match Case"
                            className={`p-0.5 rounded text-[10px] font-bold ${
                                isCaseSensitive 
                                    ? 'text-[var(--accent-color)] bg-[var(--accent-color)]/10' 
                                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                            }`}
                        >
                            <CaseSensitive className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {searchQuery.trim() && (
                        <div className="text-[10px] text-[var(--text-muted)] font-mono px-0.5">
                            {totalMatches === 0 
                                ? 'No results found' 
                                : `${totalMatches} match${totalMatches > 1 ? 'es' : ''} across ${searchResults.length} file${searchResults.length > 1 ? 's' : ''}`
                            }
                        </div>
                    )}
                </div>
            )}

            {/* Scrollable File & Folder Tree List OR Search Results */}
            <div className="flex-1 overflow-y-auto custom-scrollbar py-1">
                {isSearchOpen && searchQuery.trim() ? (
                    <div className="space-y-1.5 py-1 px-1 font-mono text-xs">
                        {searchResults.map((result) => {
                            const isFileCollapsed = collapsedSearchFiles[result.filePath];
                            const ext = getFileExtension(result.fileName);
                            return (
                                <div key={result.filePath} className="select-none">
                                    <div 
                                        onClick={() => {
                                            setCollapsedSearchFiles(prev => ({
                                                ...prev,
                                                [result.filePath]: !prev[result.filePath]
                                            }));
                                        }}
                                        className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/[0.04] cursor-pointer text-zinc-300 font-medium"
                                    >
                                        {isFileCollapsed ? (
                                            <ChevronRight className="w-3 h-3 text-zinc-500 flex-shrink-0" />
                                        ) : (
                                            <ChevronDown className="w-3 h-3 text-zinc-500 flex-shrink-0" />
                                        )}
                                        <FileIcon fileName={result.fileName} fileExtension={ext} languageId={ext} size={14} />
                                        <span className="truncate flex-1">{result.fileName}</span>
                                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/10 text-zinc-400">
                                            {result.matches.length}
                                        </span>
                                    </div>

                                    {!isFileCollapsed && (
                                        <div className="border-l border-white/[0.06] ml-3 pl-1 space-y-0.5 mt-0.5">
                                            {result.matches.map((m, idx) => (
                                                <div
                                                    key={idx}
                                                    onClick={() => onSelectFile(m.filePath, m.lineNumber)}
                                                    className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/10 cursor-pointer text-zinc-400 hover:text-white transition-colors group"
                                                >
                                                    <span className="text-[10px] text-zinc-600 group-hover:text-zinc-400 w-6 text-right flex-shrink-0">
                                                        {m.lineNumber}
                                                    </span>
                                                    <span className="truncate text-xs font-mono">
                                                        {m.lineContent}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <>
                        {/* Inline New File / Folder Input at root */}
                        {isCreating && !creationParentFolder && (
                            <div className="mx-1 mb-1.5 flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                                {isCreating === 'file' ? (
                                    <FileIcon 
                                        fileName={newItemName || 'file'} 
                                        fileExtension={getFileExtension(newItemName)} 
                                        languageId={getFileExtension(newItemName)} 
                                        size={15} 
                                    />
                                ) : (
                                    <FolderIcon folderName={newItemName || 'folder'} isOpen={false} size={15} />
                                )}
                                <input
                                    type="text"
                                    value={newItemName}
                                    autoFocus
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => setNewItemName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleCreateSubmit();
                                        else if (e.key === 'Escape') {
                                            setIsCreating(null);
                                            setCreationParentFolder('');
                                            setNewItemName('');
                                        }
                                    }}
                                    onBlur={handleCreateSubmit}
                                    placeholder={isCreating === 'file' ? 'filename.ext' : 'folder-name'}
                                    className="bg-transparent text-xs text-[var(--text-primary)] outline-none w-full font-mono placeholder:text-[var(--text-muted)]"
                                />
                            </div>
                        )}

                        <div className="space-y-0.5 px-1">
                            {treeNodes.map(node => renderNode(node, 0))}
                        </div>
                    </>
                )}
            </div>

            {/* Right-click Context Menu */}
            {contextMenu && (
                <FileTreeContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    isOpen={!!contextMenu}
                    target={contextMenu.target}
                    canPaste={!!clipboard}
                    onClose={() => setContextMenu(null)}
                    onAction={handleContextMenuAction}
                />
            )}
        </div>
    );
};

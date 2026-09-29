import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Folder, FolderOpen, FileText, Code2, Braces, FileCode } from 'lucide-react';
import { FileTreeNode, ProjectFile } from '../types';

interface WorkspaceFileTreeProps {
    files: Record<string, ProjectFile>;
    activeFilePath: string;
    onSelectFile: (path: string) => void;
}

export function buildFileTree(files: Record<string, ProjectFile>): FileTreeNode[] {
    const rootNodes: FileTreeNode[] = [];
    const folderMap = new Map<string, FileTreeNode>();

    const sortedPaths = Object.keys(files).sort();

    for (const filePath of sortedPaths) {
        const parts = filePath.split('/').filter(Boolean);
        let currentPath = '';

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isLast = i === parts.length - 1;
            const prevPath = currentPath;
            currentPath = currentPath ? `${currentPath}/${part}` : part;

            if (isLast) {
                // It is a file
                const ext = part.split('.').pop()?.toLowerCase();
                const fileNode: FileTreeNode = {
                    id: currentPath,
                    name: part,
                    path: currentPath,
                    isFolder: false,
                    extension: ext
                };

                if (prevPath && folderMap.has(prevPath)) {
                    folderMap.get(prevPath)!.children!.push(fileNode);
                } else {
                    rootNodes.push(fileNode);
                }
            } else {
                // It is a folder
                if (!folderMap.has(currentPath)) {
                    const folderNode: FileTreeNode = {
                        id: currentPath,
                        name: part,
                        path: currentPath,
                        isFolder: true,
                        children: []
                    };
                    folderMap.set(currentPath, folderNode);

                    if (prevPath && folderMap.has(prevPath)) {
                        folderMap.get(prevPath)!.children!.push(folderNode);
                    } else {
                        rootNodes.push(folderNode);
                    }
                }
            }
        }
    }

    return rootNodes;
}

const getFileIcon = (ext?: string) => {
    switch (ext) {
        case 'ts':
        case 'tsx':
            return (
                <span className="w-3.5 h-3.5 rounded-sm bg-blue-500/20 text-blue-400 font-bold text-[9px] flex items-center justify-center font-mono select-none">
                    TS
                </span>
            );
        case 'js':
        case 'jsx':
            return (
                <span className="w-3.5 h-3.5 rounded-sm bg-amber-500/20 text-amber-400 font-bold text-[9px] flex items-center justify-center font-mono select-none">
                    JS
                </span>
            );
        case 'rs':
            return <Code2 className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />;
        case 'py':
            return <FileCode className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />;
        case 'json':
            return <Braces className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />;
        case 'md':
            return (
                <span className="w-3.5 h-3.5 rounded-sm bg-purple-500/20 text-purple-300 font-bold text-[9px] flex items-center justify-center font-mono select-none">
                    M↓
                </span>
            );
        default:
            return <FileText className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />;
    }
};

export const WorkspaceFileTree: React.FC<WorkspaceFileTreeProps> = ({
    files,
    activeFilePath,
    onSelectFile
}) => {
    const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

    const treeNodes = useMemo(() => buildFileTree(files), [files]);

    // Automatically expand top-level folders on initial load
    React.useEffect(() => {
        const initialExpanded: Record<string, boolean> = {};
        const expandAll = (nodes: FileTreeNode[]) => {
            for (const node of nodes) {
                if (node.isFolder) {
                    initialExpanded[node.path] = true;
                    if (node.children) expandAll(node.children);
                }
            }
        };
        expandAll(treeNodes);
        setExpandedFolders(prev => ({ ...initialExpanded, ...prev }));
    }, [treeNodes]);

    const toggleFolder = (folderPath: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedFolders(prev => ({
            ...prev,
            [folderPath]: !prev[folderPath]
        }));
    };

    const renderNode = (node: FileTreeNode, depth = 0) => {
        const isExpanded = expandedFolders[node.path] ?? true;
        const isActive = node.path === activeFilePath;

        if (node.isFolder) {
            return (
                <div key={node.id} className="select-none">
                    <div
                        onClick={(e) => toggleFolder(node.path, e)}
                        className="flex items-center gap-1.5 py-1 px-2 rounded-md hover:bg-white/[0.05] text-zinc-300 hover:text-white cursor-pointer transition-colors text-xs font-mono group"
                        style={{ paddingLeft: `${depth * 12 + 8}px` }}
                    >
                        <span className="text-zinc-500 group-hover:text-zinc-300 transition-colors">
                            {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                            )}
                        </span>
                        {isExpanded ? (
                            <FolderOpen className="w-3.5 h-3.5 text-amber-400/90" />
                        ) : (
                            <Folder className="w-3.5 h-3.5 text-amber-400/70" />
                        )}
                        <span className="truncate">{node.name}</span>
                    </div>

                    {isExpanded && node.children && (
                        <div className="border-l border-white/[0.06] ml-3">
                            {node.children.map(child => renderNode(child, depth + 1))}
                        </div>
                    )}
                </div>
            );
        }

        return (
            <div
                key={node.id}
                onClick={() => onSelectFile(node.path)}
                className={`flex items-center gap-1.5 py-1 px-2 rounded-md cursor-pointer transition-all text-xs font-mono select-none ${
                    isActive
                        ? 'bg-[var(--accent-color)]/15 text-[var(--accent-color)] font-medium border border-[var(--accent-color)]/30'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                }`}
                style={{ paddingLeft: `${depth * 12 + 14}px` }}
            >
                {getFileIcon(node.extension)}
                <span className="truncate">{node.name}</span>
            </div>
        );
    };

    return (
        <div className="w-full h-full flex flex-col py-1 overflow-y-auto custom-scrollbar">
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500 flex items-center justify-between border-b border-white/[0.05] mb-1">
                <span>Explorer</span>
                <span className="text-zinc-600 font-mono">{Object.keys(files).length} files</span>
            </div>
            <div className="flex-1 space-y-0.5 px-1">
                {treeNodes.map(node => renderNode(node, 0))}
            </div>
        </div>
    );
};

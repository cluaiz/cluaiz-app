import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Zap, Blocks, Cpu, Trash2, X, Folder, FolderOpen,
    FileText, FileCode, Image as ImageIcon, Palette, Eye, Code, 
    Copy, Check, ChevronRight, Loader2 
} from 'lucide-react';

export interface ToolComponent {
    id: string;
    name: string;
    category: 'skill' | 'plugin' | 'mcp' | string;
    description: string;
    version?: string;
    enabled: boolean;
    security_mode?: string;
    execution_mode?: 'auto' | 'manual' | string;
    semantic_triggers?: string[];
    tokens?: number;
    icon_svg?: string | null;
}

export interface ComponentFile {
    name: string;
    path: string;
    is_dir: boolean;
}

interface FileTreeNode {
    name: string;
    path: string;
    is_dir: boolean;
    children?: FileTreeNode[];
}

export interface CacheInfo {
    temp_bytes: number;
    all_bytes: number;
}

function formatBytes(bytes?: number | null) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function buildFileHierarchy(files: ComponentFile[]): FileTreeNode[] {
    const rootNodes: FileTreeNode[] = [];
    const nodeMap = new Map<string, FileTreeNode>();

    files.forEach(f => {
        nodeMap.set(f.path, {
            name: f.name,
            path: f.path,
            is_dir: f.is_dir,
            children: f.is_dir ? [] : undefined
        });
    });

    files.forEach(f => {
        const node = nodeMap.get(f.path)!;
        const lastSlash = f.path.lastIndexOf('/');
        if (lastSlash !== -1) {
            const parentPath = f.path.substring(0, lastSlash);
            let parentNode = nodeMap.get(parentPath);
            if (!parentNode) {
                const parentName = parentPath.split('/').pop() || parentPath;
                parentNode = { name: parentName, path: parentPath, is_dir: true, children: [] };
                nodeMap.set(parentPath, parentNode);
                rootNodes.push(parentNode);
            }
            if (parentNode.children && !parentNode.children.some(c => c.path === f.path)) {
                parentNode.children.push(node);
            }
            return;
        }
        if (!rootNodes.some(r => r.path === f.path)) {
            rootNodes.push(node);
        }
    });

    const sortNodes = (nodes: FileTreeNode[]) => {
        nodes.sort((a, b) => {
            if (a.is_dir && !b.is_dir) return -1;
            if (!a.is_dir && b.is_dir) return 1;
            return a.name.localeCompare(b.name);
        });
        nodes.forEach(n => {
            if (n.children) sortNodes(n.children);
        });
    };

    sortNodes(rootNodes);
    return rootNodes;
}

interface ToolInspectorModalProps {
    tool: ToolComponent | null;
    onClose: () => void;
    getBaseUrl: () => string;
}

export function ToolInspectorModal({ tool, onClose, getBaseUrl }: ToolInspectorModalProps) {
    const [files, setFiles] = useState<ComponentFile[]>([]);
    const [isLoadingFiles, setIsLoadingFiles] = useState(false);
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [selectedFile, setSelectedFile] = useState<ComponentFile | null>(null);
    const [fileContent, setFileContent] = useState<string>('');
    const [isLoadingContent, setIsLoadingContent] = useState(false);
    const [viewMode, setViewMode] = useState<'preview' | 'raw'>('preview');
    const [cacheInfo, setCacheInfo] = useState<CacheInfo>({ temp_bytes: 0, all_bytes: 0 });
    const [hasCopied, setHasCopied] = useState(false);

    useEffect(() => {
        if (!tool) return;
        setSelectedFile(null);
        setFileContent('');
        setIsLoadingFiles(true);

        const baseUrl = getBaseUrl();
        fetch(`${baseUrl}/api/components/files?component_type=${tool.category}&component_id=${encodeURIComponent(tool.id)}`)
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success' && Array.isArray(data.files)) {
                    setFiles(data.files);
                    if (data.cache) setCacheInfo(data.cache);

                    const initialExpanded = new Set<string>();
                    data.files.forEach((f: ComponentFile) => {
                        if (f.is_dir) initialExpanded.add(f.path);
                    });
                    setExpandedFolders(initialExpanded);

                    const rootSkillMd = data.files.find((f: ComponentFile) => !f.is_dir && f.name.toLowerCase() === 'skill.md');
                    const rootReadme = data.files.find((f: ComponentFile) => !f.is_dir && f.name.toLowerCase() === 'readme.md');
                    const firstFile = rootSkillMd || rootReadme || data.files.find((f: ComponentFile) => !f.is_dir);
                    if (firstFile) {
                        loadFileContent(tool, firstFile);
                    }
                }
            })
            .catch(err => console.error('[ToolInspector] Failed to fetch tool files:', err))
            .finally(() => setIsLoadingFiles(false));
    }, [tool, getBaseUrl]);

    const loadFileContent = async (currentTool: ToolComponent, file: ComponentFile) => {
        if (file.is_dir) return;
        setSelectedFile(file);
        setIsLoadingContent(true);

        const isMd = file.name.toLowerCase().endsWith('.md');
        const isAsset = file.name.toLowerCase().endsWith('.svg') || /\.(png|jpe?g|webp|gif)$/i.test(file.name);
        setViewMode(isMd || isAsset ? 'preview' : 'raw');

        const baseUrl = getBaseUrl();
        try {
            const res = await fetch(`${baseUrl}/api/components/file?component_type=${currentTool.category}&component_id=${encodeURIComponent(currentTool.id)}&file_path=${encodeURIComponent(file.path)}`);
            if (res.ok) {
                const data = await res.json();
                setFileContent(data.status === 'success' ? (data.content ?? '') : `Error: ${data.message || 'Could not load file'}`);
            } else {
                setFileContent('Error loading file content');
            }
        } catch (err) {
            setFileContent(`Error: ${(err as Error).message}`);
        } finally {
            setIsLoadingContent(false);
        }
    };

    const toggleFolder = (folderPath: string) => {
        setExpandedFolders(prev => {
            const next = new Set(prev);
            if (next.has(folderPath)) next.delete(folderPath);
            else next.add(folderPath);
            return next;
        });
    };

    const handleCopyContent = () => {
        if (!fileContent) return;
        navigator.clipboard.writeText(fileContent);
        setHasCopied(true);
        setTimeout(() => setHasCopied(false), 2000);
    };

    const handleClearCache = async (cacheType: 'temp' | 'all') => {
        if (!tool) return;
        const baseUrl = getBaseUrl();
        try {
            const res = await fetch(`${baseUrl}/api/components/cache`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    component_type: tool.category,
                    component_id: tool.id,
                    cache_type: cacheType
                })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.status === 'success' && data.freed_bytes !== undefined) {
                    setCacheInfo(prev => ({
                        ...prev,
                        temp_bytes: cacheType === 'temp' ? 0 : Math.max(0, prev.temp_bytes - data.freed_bytes),
                        all_bytes: Math.max(0, prev.all_bytes - data.freed_bytes)
                    }));
                }
            }
        } catch (err) {
            console.error('[ToolInspector] Cache clean failed:', err);
        }
    };

    if (!tool) return null;

    const fileHierarchy = buildFileHierarchy(files);
    const isCurrentFileMarkdown = selectedFile?.name.toLowerCase().endsWith('.md');
    const isCurrentFileSvg = selectedFile?.name.toLowerCase().endsWith('.svg');
    const isCurrentFileImage = selectedFile ? /\.(png|jpe?g|webp|gif)$/i.test(selectedFile.name) : false;

    const renderTreeNode = (node: FileTreeNode, depth = 0): React.ReactNode => {
        const isExpanded = expandedFolders.has(node.path);
        const isSelected = selectedFile?.path === node.path;
        const isSkillMd = !node.is_dir && node.name.toLowerCase() === 'skill.md';
        const isSvg = !node.is_dir && node.name.toLowerCase().endsWith('.svg');
        const isImage = !node.is_dir && /\.(png|jpe?g|webp|gif)$/i.test(node.name);

        if (node.is_dir) {
            return (
                <div key={node.path} className="space-y-0.5">
                    <button
                        type="button"
                        onClick={() => toggleFolder(node.path)}
                        style={{ paddingLeft: `${depth * 14 + 10}px` }}
                        className="w-full flex items-center gap-2 py-1.5 pr-2 rounded-xl text-left text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5 transition-all cursor-pointer"
                    >
                        <ChevronRight
                            size={13}
                            className={`shrink-0 text-[var(--text-muted)] transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                        />
                        {isExpanded ? (
                            <FolderOpen size={14} className="text-[var(--accent-color)] shrink-0" />
                        ) : (
                            <Folder size={14} className="text-[var(--text-muted)] shrink-0" />
                        )}
                        <span className="truncate">{node.name}</span>
                    </button>
                    {isExpanded && node.children && (
                        <div className="space-y-0.5">
                            {node.children.map(child => renderTreeNode(child, depth + 1))}
                        </div>
                    )}
                </div>
            );
        }

        return (
            <button
                key={node.path}
                type="button"
                onClick={() => loadFileContent(tool, node)}
                style={{ paddingLeft: `${depth * 14 + 14}px` }}
                className={`w-full flex items-center gap-2 py-1.5 pr-2 rounded-xl text-left text-xs transition-all cursor-pointer ${
                    isSelected
                        ? 'bg-[var(--accent-color)]/15 text-[var(--accent-color)] font-bold shadow-sm'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5'
                }`}
            >
                {isSkillMd ? (
                    <FileText size={14} className="text-emerald-400 shrink-0" />
                ) : isSvg ? (
                    <Palette size={14} className="text-purple-400 shrink-0" />
                ) : isImage ? (
                    <ImageIcon size={14} className="text-blue-400 shrink-0" />
                ) : node.name.endsWith('.md') ? (
                    <FileText size={14} className="text-emerald-400/80 shrink-0" />
                ) : (
                    <FileCode size={14} className="text-zinc-400 shrink-0" />
                )}
                <span className="truncate">{node.name}</span>
                {isSkillMd && (
                    <span className="ml-auto text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                        DOC
                    </span>
                )}
            </button>
        );
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6 overflow-hidden">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                />

                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 15 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 15 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                    className="relative bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden z-10 shadow-2xl"
                >
                    <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-tertiary)]/40 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-[var(--accent-color)]/10 text-[var(--accent-color)] flex items-center justify-center font-bold">
                                {tool.category === 'skill' ? <Zap size={18} /> : tool.category === 'plugin' ? <Blocks size={18} /> : <Cpu size={18} />}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-bold text-[var(--text-primary)]">{tool.name}</h3>
                                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--accent-color)]">
                                        {tool.category}
                                    </span>
                                </div>
                                <p className="text-[11px] text-[var(--text-muted)] line-clamp-1">{tool.description}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {cacheInfo.temp_bytes > 0 && (
                                <button
                                    type="button"
                                    onClick={() => handleClearCache('temp')}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-xs font-semibold transition-all cursor-pointer"
                                >
                                    <Trash2 size={13} /> Clear Temp ({formatBytes(cacheInfo.temp_bytes)})
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={onClose}
                                className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 flex overflow-hidden">
                        <div className="w-72 border-r border-[var(--border-color)] bg-[var(--bg-secondary)]/60 flex flex-col shrink-0">
                            <div className="p-3 border-b border-[var(--border-color)]/60 flex items-center justify-between">
                                <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider">Source Tree</span>
                                <span className="text-[10px] text-[var(--text-muted)]">{files.filter(f => !f.is_dir).length} files</span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
                                {isLoadingFiles ? (
                                    <div className="flex items-center justify-center p-8 text-[var(--text-muted)] gap-2 text-xs">
                                        <Loader2 size={15} className="animate-spin text-[var(--accent-color)]" /> Scanning directory...
                                    </div>
                                ) : files.length === 0 ? (
                                    <div className="p-6 text-center text-xs text-[var(--text-muted)]">No files detected</div>
                                ) : (
                                    fileHierarchy.map(node => renderTreeNode(node))
                                )}
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col bg-[var(--bg-primary)]/40 overflow-hidden">
                            <div className="px-5 py-3 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-secondary)]/30 shrink-0">
                                <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] font-mono truncate">
                                    <FileCode size={14} className="text-[var(--text-muted)] shrink-0" />
                                    <span className="truncate">{selectedFile?.path || 'No file selected'}</span>
                                </div>
                                {selectedFile && (
                                    <div className="flex items-center gap-2">
                                        {(isCurrentFileMarkdown || isCurrentFileSvg || isCurrentFileImage) && (
                                            <div className="flex items-center bg-[var(--bg-tertiary)]/70 p-0.5 rounded-lg border border-[var(--border-color)]">
                                                <button
                                                    type="button"
                                                    onClick={() => setViewMode('preview')}
                                                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase transition-all cursor-pointer flex items-center gap-1 ${
                                                        viewMode === 'preview'
                                                            ? 'bg-[var(--accent-color)] text-[var(--bg-primary)] shadow-sm'
                                                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                                    }`}
                                                >
                                                    <Eye size={12} /> Preview
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setViewMode('raw')}
                                                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase transition-all cursor-pointer flex items-center gap-1 ${
                                                        viewMode === 'raw'
                                                            ? 'bg-[var(--accent-color)] text-[var(--bg-primary)] shadow-sm'
                                                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                                    }`}
                                                >
                                                    <Code size={12} /> Source
                                                </button>
                                            </div>
                                        )}
                                        <button
                                            type="button"
                                            onClick={handleCopyContent}
                                            className="flex items-center gap-1.5 px-3 py-1 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
                                        >
                                            {hasCopied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                            {hasCopied ? 'Copied' : 'Copy'}
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                                {isLoadingContent ? (
                                    <div className="flex items-center justify-center h-full text-[var(--text-muted)] gap-2 text-xs">
                                        <Loader2 size={16} className="animate-spin text-[var(--accent-color)]" /> Loading content...
                                    </div>
                                ) : selectedFile ? (
                                    isCurrentFileMarkdown && viewMode === 'preview' ? (
                                        <div className="prose prose-invert max-w-none prose-sm leading-relaxed">
                                            <ReactMarkdown>{fileContent}</ReactMarkdown>
                                        </div>
                                    ) : (
                                        <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap break-words select-text bg-[var(--bg-secondary)]/40 p-4 rounded-xl border border-[var(--border-color)] text-[var(--text-primary)]">
                                            {fileContent}
                                        </pre>
                                    )
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] gap-2">
                                        <FileText size={32} className="opacity-40" />
                                        <span className="text-xs">Select a file from the directory tree to inspect.</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}

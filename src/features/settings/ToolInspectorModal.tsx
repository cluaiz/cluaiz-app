import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { componentsApi } from '../../api';
import { toast } from '../../components/ui/toast';
import { MarkdownRenderer } from '../../components/ui/MarkdownRenderer';
import { 
    Zap, Blocks, Cpu, Trash2, X, Folder, FolderOpen,
    FileText, FileCode, Image as ImageIcon, Palette, Eye, Code, 
    Copy, Check, ChevronRight, Loader2, AlertTriangle
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

interface ParsedSkillMetadata {
    name?: string;
    version?: string;
    description?: string;
    author?: string;
    triggers?: string[];
    allowedTools?: string[];
    [key: string]: any;
}

function parseMarkdownWithFrontmatter(text: string): {
    metadata: ParsedSkillMetadata | null;
    cleanBody: string;
} {
    const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    if (!match) {
        return { metadata: null, cleanBody: text };
    }

    const rawYaml = match[1];
    const cleanBody = text.slice(match[0].length).trim();

    const metadata: ParsedSkillMetadata = {};
    const lines = rawYaml.split(/\r?\n/);
    let currentListKey = '';

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;

        if (line.startsWith('- ') && currentListKey) {
            const item = line.slice(2).trim().replace(/^["']|["']$/g, '');
            if (!Array.isArray(metadata[currentListKey])) {
                metadata[currentListKey] = [];
            }
            metadata[currentListKey].push(item);
            continue;
        }

        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) {
            const rawKey = line.slice(0, colonIdx).trim();
            const val = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
            const key = rawKey === 'allowed-tools' ? 'allowedTools' : 
                        rawKey === 'semantic' || rawKey === 'triggers' ? 'triggers' : rawKey;
            currentListKey = key;
            if (val) {
                metadata[key] = val;
            } else {
                metadata[key] = [];
            }
        }
    }

    return { metadata, cleanBody };
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
    onDeleteTool?: (tool: ToolComponent) => Promise<void> | void;
    getBaseUrl?: () => string;
}

export function ToolInspectorModal({ tool, onClose, onDeleteTool }: ToolInspectorModalProps) {
    const [files, setFiles] = useState<ComponentFile[]>([]);
    const [isLoadingFiles, setIsLoadingFiles] = useState(false);
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [selectedFile, setSelectedFile] = useState<ComponentFile | null>(null);
    const [fileContent, setFileContent] = useState<string>('');
    const [isLoadingContent, setIsLoadingContent] = useState(false);
    const [viewMode, setViewMode] = useState<'preview' | 'raw'>('preview');
    const [cacheInfo, setCacheInfo] = useState<CacheInfo>({ temp_bytes: 0, all_bytes: 0 });
    const [hasCopied, setHasCopied] = useState(false);
    const [realIconSvg, setRealIconSvg] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const toolId = tool?.id;
    const toolCategory = tool?.category;

    useEffect(() => {
        if (!toolId || !toolCategory) {
            setFiles([]);
            setSelectedFile(null);
            setFileContent('');
            setRealIconSvg(null);
            return;
        }

        setSelectedFile(null);
        setFileContent('');
        setRealIconSvg(tool?.icon_svg || null);
        setIsLoadingFiles(true);
        setShowDeleteConfirm(false);

        let isSubscribed = true;

        componentsApi.getFiles(toolCategory, toolId)
            .then(async data => {
                if (!isSubscribed) return;
                if (data?.status === 'success' && Array.isArray(data.files)) {
                    setFiles(data.files);
                    if (data.cache) setCacheInfo(data.cache);

                    // Check for real icon SVG if not already populated
                    const iconFile = data.files.find((f: ComponentFile) => 
                        !f.is_dir && (f.path.toLowerCase().includes('icon.svg') || f.name.toLowerCase() === 'icon.svg')
                    );
                    if (iconFile && !tool?.icon_svg) {
                        try {
                            const iconData = await componentsApi.getFile(toolCategory, toolId, iconFile.path);
                            if (isSubscribed && iconData?.status === 'success' && iconData.content) {
                                setRealIconSvg(iconData.content);
                            }
                        } catch {}
                    }

                    const initialExpanded = new Set<string>();
                    data.files.forEach((f: ComponentFile) => {
                        if (f.is_dir) initialExpanded.add(f.path);
                    });
                    setExpandedFolders(initialExpanded);

                    const rootSkillMd = data.files.find((f: ComponentFile) => !f.is_dir && f.name.toLowerCase() === 'skill.md');
                    const rootReadme = data.files.find((f: ComponentFile) => !f.is_dir && f.name.toLowerCase() === 'readme.md');
                    const firstFile = rootSkillMd || rootReadme || data.files.find((f: ComponentFile) => !f.is_dir);
                    if (firstFile && isSubscribed) {
                        loadFileContent(firstFile);
                    }
                }
            })
            .catch(err => console.error('[ToolInspector] Failed to fetch tool files:', err))
            .finally(() => {
                if (isSubscribed) setIsLoadingFiles(false);
            });

        return () => {
            isSubscribed = false;
        };
    }, [toolId, toolCategory]);

    const loadFileContent = async (file: ComponentFile) => {
        if (file.is_dir || !toolId || !toolCategory) return;
        setSelectedFile(file);
        setIsLoadingContent(true);

        const isMd = file.name.toLowerCase().endsWith('.md');
        const isAsset = file.name.toLowerCase().endsWith('.svg') || /\.(png|jpe?g|webp|gif)$/i.test(file.name);
        setViewMode(isMd || isAsset ? 'preview' : 'raw');

        try {
            const data = await componentsApi.getFile(toolCategory, toolId, file.path);
            setFileContent(data?.status === 'success' ? (data.content ?? '') : `Error: ${data?.message || 'Could not load file'}`);
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
        await toast.promise(
            async () => {
                const data = await componentsApi.clearCache({
                    component_type: tool.category,
                    component_id: tool.id,
                    component_name: tool.id
                });
                if (data?.status === 'success' && data.freed_bytes !== undefined) {
                    setCacheInfo(prev => ({
                        ...prev,
                        temp_bytes: cacheType === 'temp' ? 0 : Math.max(0, prev.temp_bytes - data.freed_bytes),
                        all_bytes: Math.max(0, prev.all_bytes - data.freed_bytes)
                    }));
                }
            },
            {
                loading: `Clearing cache for ${tool.name}...`,
                success: `Cache cleared for ${tool.name}`,
                error: (err: any) => `Cache clean failed: ${err?.message || 'Unknown error'}`
            }
        ).catch(() => {});
    };

    const handleConfirmDelete = async () => {
        if (!tool || !onDeleteTool) return;
        setIsDeleting(true);
        try {
            await onDeleteTool(tool);
            onClose();
        } catch {} finally {
            setIsDeleting(false);
            setShowDeleteConfirm(false);
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
                onClick={() => loadFileContent(node)}
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
                    className="relative bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl w-full max-w-5xl h-[82vh] flex flex-col overflow-hidden z-10 shadow-2xl"
                >
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-tertiary)]/40 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center justify-center font-bold text-[var(--accent-color)] shrink-0 overflow-hidden p-1.5 shadow-sm">
                                {(realIconSvg || tool.icon_svg) ? (
                                    <div 
                                        className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:object-contain"
                                        dangerouslySetInnerHTML={{ __html: (realIconSvg || tool.icon_svg)! }}
                                    />
                                ) : tool.category === 'skill' ? (
                                    <Zap size={20} />
                                ) : tool.category === 'plugin' ? (
                                    <Blocks size={20} />
                                ) : (
                                    <Cpu size={20} />
                                )}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-bold text-[var(--text-primary)]">{tool.name}</h3>
                                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--accent-color)]">
                                        {tool.category}
                                    </span>
                                    <span className="text-[9px] font-mono text-[var(--text-muted)] bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded border border-[var(--border-color)]/50">
                                        v{tool.version || '1.0.0'}
                                    </span>
                                </div>
                                <p className="text-[11px] text-[var(--text-muted)] line-clamp-1">{tool.description}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2.5">
                            {cacheInfo.temp_bytes > 0 && (
                                <button
                                    type="button"
                                    onClick={() => handleClearCache('temp')}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-xs font-semibold transition-all cursor-pointer"
                                >
                                    <Trash2 size={13} /> Clear Temp ({formatBytes(cacheInfo.temp_bytes)})
                                </button>
                            )}

                            {onDeleteTool && (
                                <button
                                    type="button"
                                    disabled={isDeleting}
                                    onClick={() => setShowDeleteConfirm(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                                    title={`Uninstall ${tool.name}`}
                                >
                                    {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                    Uninstall
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

                    {/* Delete Confirmation Banner */}
                    <AnimatePresence>
                        {showDeleteConfirm && (
                            <motion.div 
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="bg-rose-950/40 border-b border-rose-500/30 px-6 py-3 flex items-center justify-between gap-4 overflow-hidden shrink-0"
                            >
                                <div className="flex items-center gap-2.5 text-xs text-rose-200">
                                    <AlertTriangle size={16} className="text-rose-400 shrink-0" />
                                    <span>
                                        Are you sure you want to uninstall <strong>{tool.name}</strong>? This will remove its files from the system.
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setShowDeleteConfirm(false)}
                                        className="px-3 py-1 rounded-lg text-xs font-semibold bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-color)] transition-all cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        disabled={isDeleting}
                                        onClick={handleConfirmDelete}
                                        className="px-3 py-1 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
                                    >
                                        {isDeleting && <Loader2 size={12} className="animate-spin" />}
                                        Confirm Uninstall
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Body */}
                    <div className="flex-1 flex overflow-hidden">
                        {/* Source Tree */}
                        <div className="w-72 border-r border-[var(--border-color)] bg-[var(--bg-secondary)]/60 flex flex-col shrink-0">
                            <div className="p-3 border-b border-[var(--border-color)]/60 flex items-center justify-between">
                                <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider">Source Tree</span>
                                <span className="text-[10px] text-[var(--text-muted)] font-mono">{files.filter(f => !f.is_dir).length} files</span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
                                {isLoadingFiles ? (
                                    <div className="flex items-center justify-center p-8 text-[var(--text-muted)] gap-2 text-xs">
                                        <Loader2 size={15} className="animate-spin text-[var(--accent-color)]" /> Scanning directory...
                                    </div>
                                ) : files.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center p-8 text-[var(--text-muted)] gap-2">
                                        <Folder size={24} className="opacity-30" />
                                        <span className="text-xs">No files found.</span>
                                    </div>
                                ) : (
                                    fileHierarchy.map(node => renderTreeNode(node))
                                )}
                            </div>
                        </div>

                        {/* File Content Preview */}
                        <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-primary)]">
                            <div className="px-6 py-2.5 border-b border-[var(--border-color)]/60 flex items-center justify-between bg-[var(--bg-secondary)]/30 shrink-0">
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
                                        <div className="space-y-6">
                                            {(() => {
                                                const { metadata, cleanBody } = parseMarkdownWithFrontmatter(fileContent);
                                                return (
                                                    <>
                                                        {metadata && (
                                                            <div className="p-4 rounded-xl bg-[var(--bg-secondary)]/60 border border-[var(--border-color)] space-y-3 select-text shadow-sm">
                                                                <div className="flex items-center justify-between gap-2 border-b border-[var(--border-color)]/60 pb-2.5">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs font-bold text-[var(--text-primary)]">
                                                                            {metadata.name || tool.name}
                                                                        </span>
                                                                        {metadata.version && (
                                                                            <span className="text-[10px] font-mono text-[var(--accent-color)] bg-[var(--accent-color)]/10 px-2 py-0.5 rounded border border-[var(--accent-color)]/20 font-bold">
                                                                                v{metadata.version}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {metadata.author && (
                                                                        <span className="text-[10px] text-[var(--text-muted)] font-mono">
                                                                            author: {metadata.author}
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                {metadata.description && (
                                                                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                                                                        {metadata.description}
                                                                    </p>
                                                                )}

                                                                {metadata.triggers && Array.isArray(metadata.triggers) && metadata.triggers.length > 0 && (
                                                                    <div className="space-y-1.5 pt-1">
                                                                        <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                                                                            Semantic Triggers ({metadata.triggers.length})
                                                                        </span>
                                                                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                                                                            {metadata.triggers.map((t: string, idx: number) => (
                                                                                <span 
                                                                                    key={idx} 
                                                                                    className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-color)]/60"
                                                                                >
                                                                                    {t}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {metadata.allowedTools && Array.isArray(metadata.allowedTools) && metadata.allowedTools.length > 0 && (
                                                                    <div className="space-y-1.5 pt-1 border-t border-[var(--border-color)]/40">
                                                                        <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                                                                            Allowed Capabilities
                                                                        </span>
                                                                        <div className="flex flex-wrap gap-1.5">
                                                                            {metadata.allowedTools.map((t: string, idx: number) => (
                                                                                <span 
                                                                                    key={idx} 
                                                                                    className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold"
                                                                                >
                                                                                    ✓ {t}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        <MarkdownRenderer content={cleanBody} />
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    ) : isCurrentFileSvg && viewMode === 'preview' ? (
                                        <div className="flex flex-col items-center justify-center min-h-[360px] p-8 bg-[var(--bg-secondary)]/30 rounded-2xl border border-[var(--border-color)] text-center">
                                            <div 
                                                className="w-40 h-40 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:object-contain filter drop-shadow-lg p-2"
                                                dangerouslySetInnerHTML={{ __html: fileContent }}
                                            />
                                            <div className="mt-4 flex items-center gap-2">
                                                <span className="text-xs font-mono font-bold text-[var(--text-primary)]">{selectedFile.name}</span>
                                                <span className="text-[10px] font-mono text-[var(--text-muted)]">({formatBytes(new Blob([fileContent]).size)})</span>
                                            </div>
                                            <span className="text-[10px] font-mono text-[var(--text-muted)] mt-1">{selectedFile.path}</span>
                                        </div>
                                    ) : isCurrentFileImage && viewMode === 'preview' ? (
                                        <div className="flex flex-col items-center justify-center min-h-[360px] p-8 bg-[var(--bg-secondary)]/30 rounded-2xl border border-[var(--border-color)] text-center">
                                            <img 
                                                src={fileContent.startsWith('data:') ? fileContent : `data:image/png;base64,${fileContent}`} 
                                                alt={selectedFile.name} 
                                                className="max-h-64 object-contain rounded-xl shadow-md" 
                                            />
                                            <span className="text-[11px] font-mono text-[var(--text-muted)] mt-4">{selectedFile.path}</span>
                                        </div>
                                    ) : (
                                        <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap break-words select-text bg-[var(--bg-secondary)]/40 p-4 rounded-xl border border-[var(--border-color)] text-[var(--text-primary)] custom-scrollbar">
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

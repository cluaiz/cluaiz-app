import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { SettingSection, SettingItem } from './SharedComponents';
import { useConnectionStore } from '../../store/engine/useConnectionStore';
import { 
    Zap, Blocks, Cpu, Trash2, CheckCircle2, X, Folder, FolderOpen,
    FileText, FileCode, Image as ImageIcon, Palette, Eye, Code, 
    Copy, Check, ExternalLink, RefreshCw, ChevronRight, Loader2 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ToolComponent {
    id: string;
    name: string;
    category: 'skill' | 'plugin' | 'mcp' | string;
    description: string;
    enabled: boolean;
    security_mode?: string;
    tokens?: number;
    icon_svg?: string | null;
}

interface ComponentFile {
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

interface CacheInfo {
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

// Build nested hierarchical tree from flat files
function buildFileHierarchy(files: ComponentFile[]): FileTreeNode[] {
    const rootNodes: FileTreeNode[] = [];
    const nodeMap = new Map<string, FileTreeNode>();

    // 1. Create a node for every item
    files.forEach(f => {
        nodeMap.set(f.path, {
            name: f.name,
            path: f.path,
            is_dir: f.is_dir,
            children: f.is_dir ? [] : undefined
        });
    });

    // 2. Link children to their parent
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

    // 3. Sort: directories first, then alphabetical
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

export function ToolsSettings() {
    const { getBaseUrl } = useConnectionStore();
    const [filter, setFilter] = useState<'all' | 'skill' | 'plugin' | 'mcp'>('all');
    const [tools, setTools] = useState<ToolComponent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [cacheMessage, setCacheMessage] = useState<string | null>(null);

    // Modal state for Tool Inspector / File Reader
    const [selectedTool, setSelectedTool] = useState<ToolComponent | null>(null);
    const [files, setFiles] = useState<ComponentFile[]>([]);
    const [isLoadingFiles, setIsLoadingFiles] = useState(false);
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [selectedFile, setSelectedFile] = useState<ComponentFile | null>(null);
    const [fileContent, setFileContent] = useState<string>('');
    const [isLoadingContent, setIsLoadingContent] = useState(false);
    const [viewMode, setViewMode] = useState<'preview' | 'raw'>('preview');
    const [cacheInfo, setCacheInfo] = useState<CacheInfo>({ temp_bytes: 0, all_bytes: 0 });
    const [hasCopied, setHasCopied] = useState(false);

    // Fetch tools list from engine backend
    const loadTools = useCallback(async () => {
        setIsLoading(true);
        const baseUrl = getBaseUrl();
        try {
            const res = await fetch(`${baseUrl}/api/components/list`);
            if (res.ok) {
                const data = await res.json();
                let loaded: ToolComponent[] = [];

                if (data.rich) {
                    for (const [_, items] of Object.entries(data.rich)) {
                        if (Array.isArray(items)) {
                            loaded.push(...items);
                        }
                    }
                } else {
                    for (const cat of ['skill', 'plugin', 'mcp']) {
                        if (Array.isArray(data[cat])) {
                            for (const id of data[cat]) {
                                loaded.push({
                                    id,
                                    name: id,
                                    category: cat,
                                    description: `Installed ${cat} component.`,
                                    enabled: true
                                });
                            }
                        }
                    }
                }
                setTools(loaded);
            }
        } catch (err) {
            console.error('[ToolsSettings] Failed to fetch tools from backend:', err);
        } finally {
            setIsLoading(false);
        }
    }, [getBaseUrl]);

    useEffect(() => {
        loadTools();
    }, [loadTools]);

    // Toggle tool enabled state
    const handleToggleTool = async (tool: ToolComponent, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const newEnabled = !tool.enabled;

        // Optimistic UI update
        setTools(prev => prev.map(t => t.id === tool.id ? { ...t, enabled: newEnabled } : t));
        if (selectedTool && selectedTool.id === tool.id) {
            setSelectedTool(prev => prev ? { ...prev, enabled: newEnabled } : null);
        }

        const baseUrl = getBaseUrl();
        try {
            await fetch(`${baseUrl}/api/components/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    component_type: tool.category,
                    component_id: tool.id,
                    settings: { enabled: newEnabled }
                })
            });
        } catch (err) {
            console.error('[ToolsSettings] Failed to sync component toggle:', err);
            // Revert state on network failure
            setTools(prev => prev.map(t => t.id === tool.id ? { ...t, enabled: !newEnabled } : t));
            if (selectedTool && selectedTool.id === tool.id) {
                setSelectedTool(prev => prev ? { ...prev, enabled: !newEnabled } : null);
            }
        }
    };

    // Load file content for right pane reader
    const loadFileContent = async (tool: ToolComponent, file: ComponentFile) => {
        if (file.is_dir) return;
        setSelectedFile(file);
        setIsLoadingContent(true);

        // Auto-switch view mode depending on file extension
        const isMd = file.name.toLowerCase().endsWith('.md');
        const isAsset = file.name.toLowerCase().endsWith('.svg') || /\.(png|jpe?g|webp|gif)$/i.test(file.name);
        setViewMode(isMd || isAsset ? 'preview' : 'raw');

        const baseUrl = getBaseUrl();
        try {
            const res = await fetch(`${baseUrl}/api/components/file?component_type=${tool.category}&component_id=${encodeURIComponent(tool.id)}&file_path=${encodeURIComponent(file.path)}`);
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

    // Toggle folder expansion in tree
    const toggleFolder = (folderPath: string) => {
        setExpandedFolders(prev => {
            const next = new Set(prev);
            if (next.has(folderPath)) next.delete(folderPath);
            else next.add(folderPath);
            return next;
        });
    };

    // Open tool inspector modal
    const handleOpenInspector = async (tool: ToolComponent) => {
        setSelectedTool(tool);
        setSelectedFile(null);
        setFileContent('');
        setIsLoadingFiles(true);
        const baseUrl = getBaseUrl();

        try {
            const res = await fetch(`${baseUrl}/api/components/files?component_type=${tool.category}&component_id=${encodeURIComponent(tool.id)}`);
            if (res.ok) {
                const data = await res.json();
                if (data.status === 'success' && Array.isArray(data.files)) {
                    setFiles(data.files);
                    setCacheInfo({
                        temp_bytes: data.cache?.temp_bytes || 0,
                        all_bytes: data.cache?.all_bytes || 0
                    });

                    // Expand all directories by default
                    const allDirs = new Set<string>();
                    data.files.forEach((f: ComponentFile) => {
                        if (f.is_dir) allDirs.add(f.path);
                        const parts = f.path.split('/');
                        if (parts.length > 1) {
                            allDirs.add(parts.slice(0, -1).join('/'));
                        }
                    });
                    setExpandedFolders(allDirs);

                    // Auto-open SKILL.md or the first readable file
                    const skillMd = data.files.find((f: ComponentFile) => !f.is_dir && f.name.toLowerCase() === 'skill.md');
                    const defaultFile = skillMd || data.files.find((f: ComponentFile) => !f.is_dir);
                    if (defaultFile) {
                        loadFileContent(tool, defaultFile);
                    }
                }
            }
        } catch (err) {
            console.error('[ToolsSettings] Failed to fetch component files:', err);
        } finally {
            setIsLoadingFiles(false);
        }
    };

    // Clear cache action (temp or all)
    const handleClearComponentCache = async (tool: ToolComponent, clearAll: boolean) => {
        const baseUrl = getBaseUrl();
        try {
            const res = await fetch(`${baseUrl}/api/components/cache`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    component_type: tool.category,
                    component_id: tool.id,
                    clear_all: clearAll
                })
            });
            if (res.ok) {
                setCacheMessage(clearAll ? `Purged all cache for ${tool.name}!` : `Purged temporary cache for ${tool.name}!`);
                setTimeout(() => setCacheMessage(null), 2500);
                // Refresh modal files and cache metrics
                handleOpenInspector(tool);
            }
        } catch (err) {
            console.error('[ToolsSettings] Failed to clear cache:', err);
        }
    };

    const handleCopyContent = () => {
        if (!fileContent) return;
        navigator.clipboard.writeText(fileContent);
        setHasCopied(true);
        setTimeout(() => setHasCopied(false), 2000);
    };

    const filteredTools = tools.filter(t => filter === 'all' || t.category === filter);
    const fileTreeNodes = useMemo(() => buildFileHierarchy(files), [files]);

    // Recursive Tree Node Renderer
    const renderTreeNode = (node: FileTreeNode, depth = 0) => {
        const isDir = node.is_dir;
        const isExpanded = expandedFolders.has(node.path);
        const isSelected = selectedFile?.path === node.path;
        const isSkillMd = node.name.toLowerCase() === 'skill.md';
        const isSvg = node.name.toLowerCase().endsWith('.svg');
        const isImage = /\.(png|jpe?g|webp|gif)$/i.test(node.name);

        if (isDir) {
            return (
                <div key={node.path} className="space-y-0.5">
                    <button
                        type="button"
                        onClick={() => toggleFolder(node.path)}
                        style={{ paddingLeft: `${depth * 14 + 10}px` }}
                        className="w-full flex items-center gap-2 py-1.5 pr-2 rounded-xl text-left text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5 transition-colors cursor-pointer group"
                    >
                        <ChevronRight
                            size={13}
                            className={`text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-transform duration-200 shrink-0 ${
                                isExpanded ? 'rotate-90 text-[var(--accent-color)]' : ''
                            }`}
                        />
                        {isExpanded ? (
                            <FolderOpen size={14} className="text-[var(--accent-color)] shrink-0" />
                        ) : (
                            <Folder size={14} className="text-[var(--accent-color)]/80 shrink-0" />
                        )}
                        <span className="truncate">{node.name}</span>
                        {node.children && node.children.length > 0 && (
                            <span className="ml-auto text-[9px] font-mono text-[var(--text-muted)]">
                                {node.children.length}
                            </span>
                        )}
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
                onClick={() => selectedTool && loadFileContent(selectedTool, node)}
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
                {isSvg && (
                    <span className="ml-auto text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
                        SVG
                    </span>
                )}
            </button>
        );
    };

    const isCurrentFileMarkdown = selectedFile?.name.toLowerCase().endsWith('.md');
    const isCurrentFileSvg = selectedFile?.name.toLowerCase().endsWith('.svg');
    const isCurrentFileImage = selectedFile ? /\.(png|jpe?g|webp|gif)$/i.test(selectedFile.name) : false;

    return (
        <div className="space-y-8 select-none">
            {/* Filter Tabs & Refresh Header */}
            <div className="flex items-center justify-between">
                <div className="flex gap-2 p-1 bg-[var(--bg-secondary)]/80 border border-[var(--border-color)] rounded-xl w-fit">
                    {(['all', 'skill', 'plugin', 'mcp'] as const).map((tab) => (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => setFilter(tab)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                                filter === tab
                                    ? 'bg-[var(--accent-color)] text-[var(--bg-primary)] shadow-sm'
                                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                            }`}
                        >
                            {tab === 'all' ? 'All Tools' : tab === 'mcp' ? 'MCP Servers' : `${tab}s`}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={loadTools}
                        title="Reload tools and skills"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
                    >
                        <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>
            </div>

            {cacheMessage && (
                <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 font-semibold animate-in fade-in">
                    <CheckCircle2 size={15} />
                    <span>{cacheMessage}</span>
                </div>
            )}

            {/* Tools List */}
            {isLoading ? (
                <div className="flex items-center justify-center p-12 text-[var(--text-muted)] gap-3 text-sm">
                    <Loader2 size={18} className="animate-spin text-[var(--accent-color)]" />
                    Scanning installed tools & skills...
                </div>
            ) : filteredTools.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 border border-dashed border-[var(--border-color)] rounded-2xl gap-3 text-center">
                    <span className="text-sm font-semibold text-[var(--text-secondary)]">
                        No {filter === 'all' ? 'tools or skills' : `${filter}s`} installed.
                    </span>
                    <a
                        href="https://github.com"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--accent-color)] text-[var(--bg-primary)] rounded-xl text-xs font-bold hover:opacity-90 transition-opacity"
                    >
                        <ExternalLink size={13} /> Discover on Hub
                    </a>
                </div>
            ) : (
                <SettingSection title="Installed Tools, Skills & Plugins">
                    {filteredTools.map((tool) => {
                        const Icon = tool.category === 'skill' ? Zap : tool.category === 'plugin' ? Blocks : Cpu;

                        return (
                            <SettingItem
                                key={tool.id}
                                icon={Icon}
                                label={tool.name}
                                description={tool.description || `Installed ${tool.category} module.`}
                                dynamicDescription={`Type: ${tool.category.toUpperCase()} • Status: ${tool.enabled ? 'Active' : 'Disabled'}`}
                                toggle
                                active={tool.enabled}
                                onToggle={() => handleToggleTool(tool)}
                                onClick={() => handleOpenInspector(tool)}
                            />
                        );
                    })}
                </SettingSection>
            )}

            {/* Tool Inspector & File Reader Modal */}
            <AnimatePresence>
                {selectedTool && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 overflow-hidden">
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedTool(null)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        />

                        {/* Modal Window */}
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 15 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 15 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                            className="relative bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden z-10 shadow-2xl"
                        >
                            {/* Modal Header */}
                            <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-tertiary)]/40 shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-[var(--accent-color)]/10 text-[var(--accent-color)] flex items-center justify-center font-bold">
                                        {selectedTool.category === 'skill' ? <Zap size={18} /> : selectedTool.category === 'plugin' ? <Blocks size={18} /> : <Cpu size={18} />}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-sm font-bold text-[var(--text-primary)]">
                                                {selectedTool.name}
                                            </h3>
                                            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--accent-color)]">
                                                {selectedTool.category}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-[var(--text-muted)] truncate max-w-md">
                                            {selectedTool.description}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    {/* Enable / Disable Switch */}
                                    <div
                                        onClick={(e) => handleToggleTool(selectedTool, e)}
                                        className={`w-[44px] h-[24px] rounded-full p-[3px] flex items-center transition-all duration-200 shrink-0 cursor-pointer select-none ${
                                            selectedTool.enabled
                                                ? 'bg-[var(--accent-color)] border border-[var(--accent-color)]/30'
                                                : 'bg-white/10 border border-white/10'
                                        }`}
                                    >
                                        <div
                                            className={`w-[18px] h-[18px] rounded-full shadow-md transition-transform duration-200 ${
                                                selectedTool.enabled ? 'translate-x-[20px] bg-[var(--bg-primary)]' : 'translate-x-0 bg-zinc-400'
                                            }`}
                                        />
                                    </div>

                                    {/* Close Button */}
                                    <button
                                        type="button"
                                        onClick={() => setSelectedTool(null)}
                                        className="w-8 h-8 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors cursor-pointer"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Modal Body: Left File Tree & Right Viewer */}
                            <div className="flex flex-1 overflow-hidden">
                                {/* Left Pane: Expandable File Tree & Cache Actions */}
                                <div className="w-72 border-r border-[var(--border-color)] bg-[var(--bg-primary)]/40 flex flex-col justify-between shrink-0">
                                    {/* File Tree Header */}
                                    <div className="p-3 border-b border-[var(--border-color)] flex items-center justify-between text-xs font-bold text-[var(--text-primary)]">
                                        <span className="flex items-center gap-2">
                                            <Folder size={14} className="text-[var(--accent-color)]" /> Directory Tree
                                        </span>
                                        <span className="text-[10px] text-[var(--text-muted)] font-mono">
                                            {files.filter(f => !f.is_dir).length} files
                                        </span>
                                    </div>

                                    {/* Expandable Hierarchy List */}
                                    <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
                                        {isLoadingFiles ? (
                                            <div className="flex items-center justify-center p-8 text-xs text-[var(--text-muted)] gap-2">
                                                <Loader2 size={14} className="animate-spin text-[var(--accent-color)]" />
                                                Scanning directory...
                                            </div>
                                        ) : fileTreeNodes.length === 0 ? (
                                            <div className="text-center p-8 text-xs text-[var(--text-muted)]">
                                                No files found in component.
                                            </div>
                                        ) : (
                                            fileTreeNodes.map(node => renderTreeNode(node, 0))
                                        )}
                                    </div>

                                    {/* Cache Cleaner Footer Actions */}
                                    <div className="p-3 border-t border-[var(--border-color)] bg-[var(--bg-secondary)]/50 space-y-2">
                                        <button
                                            type="button"
                                            onClick={() => handleClearComponentCache(selectedTool, false)}
                                            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-[var(--bg-tertiary)]/70 hover:bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
                                        >
                                            <span className="flex items-center gap-2">
                                                <Trash2 size={13} className="text-[var(--accent-color)]" /> Clear Temp Cache
                                            </span>
                                            <span className="text-[10px] font-mono text-[var(--text-muted)]">
                                                {formatBytes(cacheInfo.temp_bytes)}
                                            </span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleClearComponentCache(selectedTool, true)}
                                            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-xs font-semibold text-red-400 transition-all cursor-pointer"
                                        >
                                            <span className="flex items-center gap-2">
                                                <Trash2 size={13} /> Purge All Cache
                                            </span>
                                            <span className="text-[10px] font-mono opacity-80">
                                                {formatBytes(cacheInfo.all_bytes)}
                                            </span>
                                        </button>
                                    </div>
                                </div>

                                {/* Right Pane: Interactive File Content & Asset Viewer */}
                                <div className="flex-1 flex flex-col bg-[var(--bg-primary)]/60 overflow-hidden">
                                    {/* Reader Top Bar */}
                                    <div className="px-5 py-3 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-secondary)]/40 shrink-0">
                                        <div className="flex items-center gap-2 text-xs font-mono text-[var(--text-primary)] truncate">
                                            {isCurrentFileMarkdown ? (
                                                <FileText size={14} className="text-emerald-400 shrink-0" />
                                            ) : isCurrentFileSvg ? (
                                                <Palette size={14} className="text-purple-400 shrink-0" />
                                            ) : isCurrentFileImage ? (
                                                <ImageIcon size={14} className="text-blue-400 shrink-0" />
                                            ) : (
                                                <FileCode size={14} className="text-[var(--accent-color)] shrink-0" />
                                            )}
                                            <span className="truncate">{selectedFile ? selectedFile.path : 'No file selected'}</span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {/* Preview vs Raw Code Toggle for Markdown & SVG */}
                                            {(isCurrentFileMarkdown || isCurrentFileSvg) && (
                                                <div className="flex p-0.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg">
                                                    <button
                                                        type="button"
                                                        onClick={() => setViewMode('preview')}
                                                        className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
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
                                                        className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                                                            viewMode === 'raw'
                                                                ? 'bg-[var(--accent-color)] text-[var(--bg-primary)] shadow-sm'
                                                                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                                        }`}
                                                    >
                                                        <Code size={12} /> Raw Code
                                                    </button>
                                                </div>
                                            )}

                                            {selectedFile && fileContent && (
                                                <button
                                                    type="button"
                                                    onClick={handleCopyContent}
                                                    className="flex items-center gap-1.5 px-3 py-1 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
                                                >
                                                    {hasCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                                                    <span>{hasCopied ? 'Copied' : 'Copy'}</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Reader Content Body */}
                                    <div className="flex-1 p-6 overflow-auto custom-scrollbar leading-relaxed text-[var(--text-primary)]">
                                        {isLoadingContent ? (
                                            <div className="flex items-center justify-center h-full text-[var(--text-muted)] gap-2 text-xs">
                                                <Loader2 size={18} className="animate-spin text-[var(--accent-color)]" />
                                                Loading file stream...
                                            </div>
                                        ) : selectedFile ? (
                                            isCurrentFileSvg && viewMode === 'preview' ? (
                                                /* Visual SVG Asset Preview */
                                                <div className="flex flex-col items-center justify-center p-8 bg-[var(--bg-secondary)]/50 rounded-2xl border border-[var(--border-color)] gap-6 my-auto max-w-lg mx-auto">
                                                    <div 
                                                        className="w-36 h-36 flex items-center justify-center text-[var(--accent-color)] p-4 bg-black/20 rounded-2xl border border-[var(--border-color)] shadow-inner"
                                                        dangerouslySetInnerHTML={{ __html: fileContent }}
                                                    />
                                                    <div className="text-center">
                                                        <span className="text-xs font-bold text-[var(--text-primary)] block">
                                                            {selectedFile.name}
                                                        </span>
                                                        <span className="text-[10px] font-mono text-[var(--text-muted)] block mt-1">
                                                            Vector Asset • SVG Format
                                                        </span>
                                                    </div>
                                                </div>
                                            ) : isCurrentFileImage && viewMode === 'preview' ? (
                                                /* Image Asset Preview */
                                                <div className="flex flex-col items-center justify-center p-8 bg-[var(--bg-secondary)]/50 rounded-2xl border border-[var(--border-color)] gap-4 my-auto max-w-lg mx-auto">
                                                    <img 
                                                        src={`${getBaseUrl()}/api/components/file?component_type=${selectedTool.category}&component_id=${encodeURIComponent(selectedTool.id)}&file_path=${encodeURIComponent(selectedFile.path)}`}
                                                        alt={selectedFile.name}
                                                        className="max-h-64 object-contain rounded-xl shadow-lg border border-[var(--border-color)]"
                                                    />
                                                    <span className="text-xs font-mono text-[var(--text-muted)]">{selectedFile.name}</span>
                                                </div>
                                            ) : isCurrentFileMarkdown && viewMode === 'preview' ? (
                                                /* Rich Markdown Preview using App Typography */
                                                <div className="prose dark:prose-invert max-w-none text-xs leading-relaxed text-[var(--text-primary)]
                                                    prose-headings:text-[var(--text-primary)] prose-headings:font-bold
                                                    prose-h1:text-xl prose-h1:border-b prose-h1:border-[var(--border-color)] prose-h1:pb-2 prose-h1:mb-4
                                                    prose-h2:text-base prose-h2:mt-6 prose-h2:mb-3
                                                    prose-h3:text-sm prose-h3:mt-4 prose-h3:mb-2
                                                    prose-p:text-[var(--text-secondary)] prose-p:my-2
                                                    prose-strong:text-[var(--text-primary)]
                                                    prose-code:text-[var(--accent-color)] prose-code:bg-[var(--bg-secondary)] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none
                                                    prose-pre:bg-[var(--bg-secondary)] prose-pre:border prose-pre:border-[var(--border-color)] prose-pre:p-4 prose-pre:rounded-xl
                                                    prose-ul:list-disc prose-ul:pl-5 prose-ul:my-2
                                                    prose-ol:list-decimal prose-ol:pl-5 prose-ol:my-2
                                                    prose-li:text-[var(--text-secondary)] prose-li:my-1
                                                    prose-table:border-collapse prose-table:w-full prose-table:my-4
                                                    prose-th:border prose-th:border-[var(--border-color)] prose-th:p-2 prose-th:bg-[var(--bg-secondary)] prose-th:text-left
                                                    prose-td:border prose-td:border-[var(--border-color)] prose-td:p-2
                                                ">
                                                    <ReactMarkdown>{fileContent}</ReactMarkdown>
                                                </div>
                                            ) : (
                                                /* Raw Code View */
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
                )}
            </AnimatePresence>
        </div>
    );
}

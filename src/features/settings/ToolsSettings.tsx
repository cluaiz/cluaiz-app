import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ToggleSwitch } from './SharedComponents';
import { componentsApi, skillsApi, pluginsApi, mcpApi } from '../../api';
import { toast } from '../../components/ui/toast';
import { 
    Zap, Blocks, Cpu, CheckCircle2, ExternalLink, RefreshCw, Loader2, 
    Search, X, Bot, UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ToolComponent, ToolInspectorModal } from './ToolInspectorModal';
import { CustomDropdown, DropdownOption } from '../../components/ui/dropdown/CustomDropdown';

const PAGE_SIZE = 20;

const SECURITY_POLICY_OPTIONS: DropdownOption[] = [
    { value: 'inherit', label: 'Inherit Global', description: 'Follows system security mode defined in Permissions' },
    { value: 'require_approval', label: 'Require Approval', description: 'Always prompt for user confirmation before execution' },
    { value: 'always_allow', label: 'Always Allow', description: 'Bypass confirmation prompts and execute directly' },
];

export function ToolsSettings() {
    const [filter, setFilter] = useState<'all' | 'skill' | 'plugin' | 'mcp'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [tools, setTools] = useState<ToolComponent[]>([]);
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const [isLoading, setIsLoading] = useState(true);
    const [cacheMessage, setCacheMessage] = useState<string | null>(null);
    const [selectedTool, setSelectedTool] = useState<ToolComponent | null>(null);
    const [pendingTools, setPendingTools] = useState<Record<string, boolean>>({});
    const [pendingExecTarget, setPendingExecTarget] = useState<Record<string, 'auto' | 'manual'>>({});

    // Fetch tools list from engine backend (100% single source of truth from tools_registry.json)
    const loadTools = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await componentsApi.listComponents();
            let loaded: ToolComponent[] = [];

            if (data?.rich) {
                for (const [_, items] of Object.entries(data.rich)) {
                    if (Array.isArray(items)) {
                        loaded.push(...(items as ToolComponent[]));
                    }
                }
            } else if (data) {
                for (const cat of ['skill', 'plugin', 'mcp']) {
                    if (Array.isArray(data[cat])) {
                        for (const id of data[cat]) {
                            loaded.push({
                                id,
                                name: id,
                                category: cat,
                                version: '1.0.0',
                                description: `Installed ${cat} component.`,
                                enabled: true,
                                execution_mode: 'auto'
                            });
                        }
                    }
                }
            }

            setTools(loaded);
        } catch (err) {
            console.error('[ToolsSettings] Failed to fetch tools from backend:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadTools();
    }, [loadTools]);

    // Reset pagination when filter or search changes
    useEffect(() => {
        setVisibleCount(PAGE_SIZE);
    }, [filter, searchQuery]);

    // Toggle tool enabled state
    const handleToggleTool = async (tool: ToolComponent, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const newEnabled = !tool.enabled;
        setPendingTools(prev => ({ ...prev, [`${tool.id}_toggle`]: true }));

        try {
            await toast.promise(
                componentsApi.updateSettings({
                    component_type: tool.category,
                    component_id: tool.id,
                    settings: { enabled: newEnabled }
                }),
                {
                    loading: `${newEnabled ? 'Enabling' : 'Disabling'} ${tool.name}...`,
                    success: `${tool.name} ${newEnabled ? 'Enabled' : 'Disabled'}`,
                    error: (err: any) => `Failed to update ${tool.name}: ${err?.message || 'Error'}`
                }
            );

            // Only update UI state after backend confirms successful disk write
            setTools(prev => prev.map(t => t.id === tool.id ? { ...t, enabled: newEnabled } : t));
            if (selectedTool && selectedTool.id === tool.id) {
                setSelectedTool(prev => prev ? { ...prev, enabled: newEnabled } : null);
            }
        } catch (err) {
            console.error('[ToolsSettings] Failed to sync component toggle to engine:', err);
        } finally {
            setPendingTools(prev => ({ ...prev, [`${tool.id}_toggle`]: false }));
        }
    };

    // Update specific tool's execution mode (Auto / Manual)
    const handleUpdateToolExecutionMode = async (tool: ToolComponent, mode: 'auto' | 'manual', e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (tool.execution_mode === mode) return;

        setPendingTools(prev => ({ ...prev, [`${tool.id}_exec`]: true }));
        setPendingExecTarget(prev => ({ ...prev, [tool.id]: mode }));

        try {
            await toast.promise(
                componentsApi.updateSettings({
                    component_type: tool.category,
                    component_id: tool.id,
                    settings: { execution_mode: mode }
                }),
                {
                    loading: `Setting ${tool.name} trigger mode to ${mode.toUpperCase()}...`,
                    success: `${tool.name} trigger set to ${mode.toUpperCase()}`,
                    error: (err: any) => `Failed to update trigger mode for ${tool.name}: ${err?.message || 'Error'}`
                }
            );

            // Only update UI state after backend confirms successful disk write
            setTools(prev => prev.map(t => t.id === tool.id ? { ...t, execution_mode: mode } : t));
            if (selectedTool && selectedTool.id === tool.id) {
                setSelectedTool(prev => prev ? { ...prev, execution_mode: mode } : null);
            }
        } catch (err) {
            console.error('[ToolsSettings] Failed to update tool execution mode:', err);
        } finally {
            setPendingTools(prev => ({ ...prev, [`${tool.id}_exec`]: false }));
            setPendingExecTarget(prev => {
                const next = { ...prev };
                delete next[tool.id];
                return next;
            });
        }
    };

    // Update specific tool's security mode override (inherit / require_approval / always_allow)
    const handleUpdateToolSecurityMode = async (tool: ToolComponent, mode: 'inherit' | 'require_approval' | 'always_allow', e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (tool.security_mode === mode) return;

        setPendingTools(prev => ({ ...prev, [`${tool.id}_sec`]: true }));

        const labelMap: Record<string, string> = {
            inherit: 'Inherit Global',
            require_approval: 'Require Approval',
            always_allow: 'Always Allow'
        };

        try {
            await toast.promise(
                componentsApi.updateSettings({
                    component_type: tool.category,
                    component_id: tool.id,
                    settings: { security_mode: mode }
                }),
                {
                    loading: `Updating policy for ${tool.name}...`,
                    success: `${tool.name} policy set to "${labelMap[mode] || mode}"`,
                    error: (err: any) => `Failed to update policy for ${tool.name}: ${err?.message || 'Error'}`
                }
            );

            // Only update UI state after backend confirms successful disk write
            setTools(prev => prev.map(t => t.id === tool.id ? { ...t, security_mode: mode } : t));
            if (selectedTool && selectedTool.id === tool.id) {
                setSelectedTool(prev => prev ? { ...prev, security_mode: mode } : null);
            }
        } catch (err) {
            console.error('[ToolsSettings] Failed to update tool security mode:', err);
        } finally {
            setPendingTools(prev => ({ ...prev, [`${tool.id}_sec`]: false }));
        }
    };

    // Delete / Uninstall tool from engine (called from ToolInspectorModal after in-app confirmation)
    const handleDeleteTool = async (tool: ToolComponent) => {
        setPendingTools(prev => ({ ...prev, [`${tool.id}_delete`]: true }));

        try {
            await toast.promise(
                async () => {
                    if (tool.category === 'skill') {
                        await skillsApi.removeSkill(tool.id);
                    } else if (tool.category === 'plugin') {
                        await pluginsApi.removePlugin(tool.id);
                    } else if (tool.category === 'mcp') {
                        await mcpApi.removeMcp(tool.id);
                    } else {
                        await skillsApi.removeSkill(tool.id);
                    }
                },
                {
                    loading: `Uninstalling ${tool.name}...`,
                    success: `${tool.name} successfully uninstalled`,
                    error: (err: any) => `Failed to uninstall ${tool.name}: ${err?.message || 'Error'}`
                }
            );

            // Remove from local tools list
            setTools(prev => prev.filter(t => t.id !== tool.id));
            if (selectedTool && selectedTool.id === tool.id) {
                setSelectedTool(null);
            }
        } catch (err) {
            console.error('[ToolsSettings] Failed to delete tool:', err);
        } finally {
            setPendingTools(prev => ({ ...prev, [`${tool.id}_delete`]: false }));
        }
    };

    // Filter tools based on category tab & search query
    const filteredTools = useMemo(() => {
        return tools.filter(t => {
            const matchesTab = filter === 'all' || t.category === filter;
            if (!matchesTab) return false;
            if (!searchQuery.trim()) return true;

            const q = searchQuery.toLowerCase();
            const matchName = t.name.toLowerCase().includes(q);
            const matchDesc = t.description?.toLowerCase().includes(q);
            const matchCat = t.category?.toLowerCase().includes(q);
            const matchTriggers = t.semantic_triggers?.some(tr => tr.toLowerCase().includes(q));
            return matchName || matchDesc || matchCat || matchTriggers;
        });
    }, [tools, filter, searchQuery]);

    // Progressive 20-by-20 pagination slice
    const paginatedTools = useMemo(() => {
        return filteredTools.slice(0, visibleCount);
    }, [filteredTools, visibleCount]);

    return (
        <div className="space-y-6 select-none pb-12">
            {/* Unified Responsive Toolbar: Tabs + Search + Actions */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-1.5 bg-[var(--bg-secondary)]/40 border border-[var(--border-color)]/70 rounded-2xl shadow-sm">
                {/* Left: Category Filter Tabs */}
                <div className="flex items-center gap-1 p-1 bg-[var(--bg-secondary)]/90 border border-[var(--border-color)]/50 rounded-xl overflow-x-auto custom-scrollbar shrink-0">
                    {(['all', 'skill', 'plugin', 'mcp'] as const).map((tab) => (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => setFilter(tab)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                                filter === tab
                                    ? 'bg-[var(--accent-color)] text-[var(--bg-primary)] shadow-sm'
                                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.04]'
                            }`}
                        >
                            {tab === 'all' ? 'All' : tab === 'mcp' ? 'MCP' : `${tab}s`}
                        </button>
                    ))}
                    <div className="h-4 w-px bg-[var(--border-color)]/60 my-auto mx-1 shrink-0" />
                    <span className="text-[10px] text-[var(--text-muted)] font-mono font-bold px-2 py-0.5 rounded bg-[var(--bg-tertiary)]/70 whitespace-nowrap shrink-0">
                        {filteredTools.length} {filteredTools.length === 1 ? 'item' : 'items'}
                    </span>
                </div>

                {/* Right: Search Input + Refresh Button */}
                <div className="flex items-center gap-2 flex-1 lg:max-w-md justify-end">
                    {/* Search Input */}
                    <div className="relative flex-1">
                        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search tools, skills, or triggers..."
                            className="w-full bg-[var(--bg-secondary)]/90 border border-[var(--border-color)]/70 rounded-xl pl-9 pr-9 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-color)] transition-colors shadow-sm placeholder:text-[var(--text-muted)]"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                            >
                                <X size={13} />
                            </button>
                        )}
                    </div>

                    {/* Refresh Button */}
                    <button
                        type="button"
                        onClick={loadTools}
                        title="Reload tools and skills"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-secondary)]/90 hover:bg-[var(--bg-tertiary)] border border-[var(--border-color)]/70 rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer shadow-sm shrink-0"
                    >
                        <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>
                </div>
            </div>

            {/* Tools List */}
            {isLoading ? (
                <div className="flex items-center justify-center p-12 text-[var(--text-muted)] gap-3 text-sm">
                    <Loader2 size={18} className="animate-spin text-[var(--accent-color)]" />
                    Scanning installed tools & skills...
                </div>
            ) : filteredTools.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 border border-dashed border-[var(--border-color)] rounded-2xl gap-3 text-center">
                    <span className="text-sm font-semibold text-[var(--text-secondary)]">
                        No tools found matching &quot;{searchQuery || filter}&quot;.
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
                <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider">
                            Installed Components ({paginatedTools.length} of {filteredTools.length})
                        </span>
                    </div>

                    <div className="space-y-2">
                        {paginatedTools.map((tool) => {
                            const isAuto = (tool.execution_mode || 'auto') === 'auto';
                            const activeSecMode = tool.security_mode || 'inherit';
                            const isExecPending = Boolean(pendingTools[`${tool.id}_exec`]);
                            const execTarget = pendingExecTarget[tool.id];
                            const isSecPending = Boolean(pendingTools[`${tool.id}_sec`]);
                            const isTogglePending = Boolean(pendingTools[`${tool.id}_toggle`]);
                            const isAnyPending = isExecPending || isSecPending || isTogglePending;

                            return (
                                <div
                                    key={tool.id}
                                    onClick={() => setSelectedTool(tool)}
                                    className="p-4 bg-[var(--bg-secondary)]/50 hover:bg-[var(--bg-secondary)]/80 border border-[var(--border-color)] hover:border-[var(--accent-color)]/30 rounded-2xl transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                                >
                                    {/* Left: Icon + Metadata */}
                                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                                        <div className="w-10 h-10 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] flex items-center justify-center font-bold text-[var(--accent-color)] shrink-0 group-hover:border-[var(--accent-color)]/40 transition-colors overflow-hidden p-1.5">
                                            {tool.icon_svg ? (
                                                <img 
                                                    src={`data:image/svg+xml;utf8,${encodeURIComponent(tool.icon_svg)}`}
                                                    alt={tool.name}
                                                    className="w-full h-full object-contain"
                                                />
                                            ) : tool.category === 'skill' ? (
                                                <Zap size={18} />
                                            ) : tool.category === 'plugin' ? (
                                                <Blocks size={18} />
                                            ) : (
                                                <Cpu size={18} />
                                            )}
                                        </div>

                                        <div className="space-y-1 min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h4 className="text-xs font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-color)] transition-colors truncate">
                                                    {tool.name}
                                                </h4>
                                                <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--accent-color)]">
                                                    {tool.category}
                                                </span>
                                                <span className="text-[9px] font-mono text-[var(--text-muted)] bg-[var(--bg-tertiary)]/60 px-1.5 py-0.5 rounded border border-[var(--border-color)]/40">
                                                    v{tool.version || '1.0.0'}
                                                </span>
                                            </div>

                                            <p className="text-[11px] text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
                                                {tool.description || `Installed ${tool.category} component.`}
                                            </p>

                                            {/* Triggers Preview */}
                                            {tool.semantic_triggers && tool.semantic_triggers.length > 0 && (
                                                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                                    <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Triggers:</span>
                                                    {tool.semantic_triggers.slice(0, 4).map((trigger, idx) => (
                                                        <span
                                                            key={idx}
                                                            className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-color)]/50"
                                                        >
                                                            {trigger}
                                                        </span>
                                                    ))}
                                                    {tool.semantic_triggers.length > 4 && (
                                                        <span className="text-[9px] font-mono text-[var(--text-muted)]">
                                                            +{tool.semantic_triggers.length - 4} more
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right Controls: Execution Mode + Security Override + Active Switch */}
                                    <div 
                                        className="flex items-center gap-2.5 shrink-0 self-end md:self-center"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {/* Execution Mode (Auto vs Manual) */}
                                        <div 
                                            className="flex items-center p-0.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl"
                                            title="Auto: AI executes autonomously on trigger. Manual: Requires explicit command."
                                        >
                                            <button
                                                type="button"
                                                disabled={isExecPending}
                                                onClick={(e) => handleUpdateToolExecutionMode(tool, 'auto', e)}
                                                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer disabled:opacity-50 ${
                                                    isAuto
                                                        ? 'bg-[var(--accent-color)] text-[var(--bg-primary)] shadow-sm'
                                                        : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                                                }`}
                                            >
                                                {isExecPending && execTarget === 'auto' ? (
                                                    <Loader2 size={11} className={`animate-spin ${isAuto ? 'text-[var(--bg-primary)]' : 'text-[var(--accent-color)]'}`} />
                                                ) : (
                                                    <Bot size={11} />
                                                )} Auto
                                            </button>
                                            <button
                                                type="button"
                                                disabled={isExecPending}
                                                onClick={(e) => handleUpdateToolExecutionMode(tool, 'manual', e)}
                                                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer disabled:opacity-50 ${
                                                    !isAuto
                                                        ? 'bg-[var(--accent-color)] text-[var(--bg-primary)] shadow-sm'
                                                        : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                                                }`}
                                            >
                                                {isExecPending && execTarget === 'manual' ? (
                                                    <Loader2 size={11} className={`animate-spin ${!isAuto ? 'text-[var(--bg-primary)]' : 'text-[var(--accent-color)]'}`} />
                                                ) : (
                                                    <UserCheck size={11} />
                                                )} Manual
                                            </button>
                                        </div>

                                        {/* Security Policy Override (Market Standard CustomDropdown) */}
                                        <CustomDropdown
                                            value={activeSecMode}
                                            options={SECURITY_POLICY_OPTIONS}
                                            onChange={(val) => handleUpdateToolSecurityMode(tool, val as 'inherit' | 'require_approval' | 'always_allow')}
                                            className="w-44"
                                            loading={isSecPending}
                                            disabled={isSecPending}
                                        />

                                        {/* On / Off Toggle Switch */}
                                        <ToggleSwitch 
                                            active={tool.enabled} 
                                            onToggle={() => handleToggleTool(tool)}
                                            loading={isTogglePending}
                                            disabled={isTogglePending}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* 20-by-20 Progressive Loading Button */}
                    {visibleCount < filteredTools.length && (
                        <div className="flex justify-center pt-3">
                            <button
                                type="button"
                                onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
                                className="px-5 py-2 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-xs font-bold text-[var(--text-primary)] hover:border-[var(--accent-color)]/40 transition-all cursor-pointer flex items-center gap-2 shadow-sm"
                            >
                                Load 20 More ({filteredTools.length - visibleCount} remaining)
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Tool Inspector & File Reader Modal */}
            <ToolInspectorModal
                tool={selectedTool}
                onClose={() => setSelectedTool(null)}
                onDeleteTool={handleDeleteTool}
            />

            {/* Floating Toast Notification (Zero Layout Shift) */}
            <AnimatePresence>
                {cacheMessage && (
                    <motion.div
                        initial={{ opacity: 0, y: 16, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 16, scale: 0.95 }}
                        transition={{ duration: 0.18 }}
                        className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-[var(--bg-secondary)]/95 backdrop-blur-xl border border-emerald-500/30 text-emerald-400 rounded-2xl shadow-2xl text-xs font-semibold pointer-events-none"
                    >
                        <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                        <span>{cacheMessage}</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

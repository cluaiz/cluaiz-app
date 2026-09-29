import React, { useState } from 'react';
import { ContextBreakdown, formatTokensK, formatDuration, ComponentTelemetryItem } from '../hooks/useChatTelemetry';

interface ContextWindowPopoverProps {
    isOpen: boolean;
    onClose: () => void;
    breakdown: ContextBreakdown | null;
    isPinned?: boolean;
}

export const ContextWindowPopover: React.FC<ContextWindowPopoverProps> = ({
    isOpen,
    onClose,
    breakdown,
    isPinned = false
}) => {
    const [openCategory, setOpenCategory] = useState<'skills' | 'plugins' | 'mcp' | null>(null);

    if (!isOpen) return null;

    const totalLimit = breakdown?.total_context_limit || 32768;
    const modelMax = breakdown?.model_native_context || 131072;
    const totalActive = breakdown?.total_active_tokens || 0;
    const activePct = breakdown?.active_percentage || (totalLimit > 0 ? Math.round((totalActive / totalLimit) * 100) : 0);

    const isItemActive = (i: ComponentTelemetryItem) => 
        i.status === 'active' || i.status === 'running' || i.status === 'completed' || Boolean(i.execution_latency_ms && i.execution_latency_ms > 0);

    const allActiveItems: ComponentTelemetryItem[] = [
        ...(breakdown?.skills?.items || []),
        ...(breakdown?.plugins?.items || []),
        ...(breakdown?.mcp_tools?.items || [])
    ].filter(isItemActive);

    const skillsCount = (breakdown?.skills?.items || []).filter(isItemActive).length;
    const pluginsCount = (breakdown?.plugins?.items || []).filter(isItemActive).length;
    const mcpCount = (breakdown?.mcp_tools?.items || []).filter(isItemActive).length;

    const getCategoryTokens = (items?: ComponentTelemetryItem[], categoryTokens?: number, topLevelTokens?: number) => {
        if (topLevelTokens !== undefined && topLevelTokens > 0) return topLevelTokens;
        if (categoryTokens !== undefined && categoryTokens > 0) return categoryTokens;
        const itemsActiveTokens = (items || [])
            .filter(i => i.status === 'active' || i.status === 'completed' || i.status === 'running')
            .reduce((sum, item) => sum + (item.tokens || 0), 0);
        return itemsActiveTokens;
    };

    const getCategoryPercent = (tokens: number, categoryPct?: number, topLevelPct?: number) => {
        if (tokens > 0 && totalLimit > 0) {
            return Number(((tokens / totalLimit) * 100).toFixed(1));
        }
        return Math.max(topLevelPct || 0, categoryPct || 0);
    };

    const skillsTokens = getCategoryTokens(breakdown?.skills?.items, breakdown?.skills?.tokens, breakdown?.skills_tokens);
    const skillsPct = getCategoryPercent(skillsTokens, breakdown?.skills?.percent, breakdown?.skills_percentage);

    const pluginsTokens = getCategoryTokens(breakdown?.plugins?.items, breakdown?.plugins?.tokens, breakdown?.plugins_tokens);
    const pluginsPct = getCategoryPercent(pluginsTokens, breakdown?.plugins?.percent, breakdown?.plugins_percentage);

    const mcpTokens = getCategoryTokens(breakdown?.mcp_tools?.items, breakdown?.mcp_tools?.tokens, breakdown?.mcp_tools_tokens);
    const mcpPct = getCategoryPercent(mcpTokens, breakdown?.mcp_tools?.percent, breakdown?.mcp_tools_percentage);

    const toggleCategory = (cat: 'skills' | 'plugins' | 'mcp') => {
        setOpenCategory(prev => prev === cat ? null : cat);
    };

    const renderTreeItems = (items: ComponentTelemetryItem[] = [], type: string, extraNote?: React.ReactNode) => {
        const activeItems = (items || []).filter(isItemActive);

        if (activeItems.length === 0) {
            return (
                <div className="text-[10.5px] text-[var(--text-muted)] italic py-1 px-1">
                    No active {type} executed in this turn
                </div>
            );
        }

        return (
            <div className="flex flex-col gap-0.5">
                {extraNote && <div className="text-[9.5px] text-[var(--text-muted)] pb-1">{extraNote}</div>}
                {activeItems.map((item, idx) => {
                    const isLast = idx === activeItems.length - 1;
                    const prefix = isLast ? '└──' : '├──';

                    return (
                        <div key={item.id || idx} className="flex items-center gap-1.5 py-0.5 text-[11px] font-mono">
                            <span className="text-[var(--text-muted)] opacity-60">{prefix}</span>
                            <span className="font-semibold text-emerald-300">
                                {item.name || item.id}
                            </span>
                            {item.execution_latency_ms ? (
                                <span className="text-[9px] text-emerald-400 font-mono">
                                    ({formatDuration(item.execution_latency_ms)})
                                </span>
                            ) : null}
                            <span className="ml-auto flex items-center gap-1.5 text-[10px] font-mono">
                                {item.tokens && item.tokens > 0 ? (
                                    <span className="text-[9px] text-[var(--text-muted)] font-mono">
                                        {item.tokens} tok
                                    </span>
                                ) : null}
                                <span className="px-1 py-0.2 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[9px] font-bold">
                                    {item.status === 'running' ? 'Running' : (item.execution_latency_ms || item.status === 'completed' ? 'Completed' : 'Active')}
                                </span>
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <>
            {/* Backdrop: only active when pinned so outside click can close it */}
            {isPinned && <div className="fixed inset-0 z-[80]" onClick={onClose} />}

            {/* Popover Card */}
            <div 
                className="absolute bottom-full right-0 mb-1.5 w-[310px] sm:w-[340px] max-h-[480px] overflow-y-auto z-[90] rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-3 shadow-2xl custom-scrollbar text-[11px] text-[var(--text-primary)] select-none"
                style={{
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.7), 0 10px 10px -5px rgba(0, 0, 0, 0.5)'
                }}
            >
                {/* Header */}
                <div className="flex justify-between items-center mb-1 text-[11px] font-semibold text-[var(--text-muted)]">
                    <span className="text-[var(--text-primary)] font-bold">Context Window</span>
                    <span className="text-[10px] text-[var(--text-muted)]">
                        Model Max: <b className="text-[var(--text-primary)] font-bold">{formatTokensK(modelMax)}</b>
                    </span>
                </div>

                {/* Active Safe Allocation Row */}
                <div className="flex justify-between items-center mb-0.5 text-[10px]">
                    <span className="text-[var(--text-muted)] flex items-center gap-1">
                        <span>Active Safe Allocation</span>
                        <span className="text-[8.5px] px-1 py-0.2 rounded bg-blue-500/20 text-blue-300 font-mono font-bold">
                            Safe VRAM
                        </span>
                    </span>
                    <span className="text-[var(--text-primary)] font-bold font-mono text-[10px]">
                        {formatTokensK(totalActive)} / {formatTokensK(totalLimit)} ({activePct}%)
                    </span>
                </div>

                {/* 5-Pillar Progress Multi-bar */}
                <div className="flex h-1.5 rounded-full overflow-hidden bg-[var(--bg-tertiary)] border border-[var(--border-color)]/40 mb-2">
                    <div style={{ width: `${breakdown?.messages_percentage || 0}%`, background: '#3b82f6' }} title="Messages" />
                    <div style={{ width: `${breakdown?.system_prompt_percentage || 0}%`, background: '#eab308' }} title="System Prompt" />
                    <div style={{ width: `${skillsPct || 0}%`, background: '#ec4899' }} title="Skills" />
                    <div style={{ width: `${pluginsPct || 0}%`, background: '#ea580c' }} title="Plugins" />
                    <div style={{ width: `${mcpPct || 0}%`, background: '#10b981' }} title="MCP tools" />
                </div>

                {/* Breakdown Items List */}
                <div className="flex flex-col gap-1.5 text-[10.5px]">
                    {/* Messages (Thread History in KV-Cache) */}
                    <div className="flex justify-between items-center py-0.5">
                        <span className="flex items-center gap-1.5" title="Total conversation thread turns accumulated in KV-cache">
                            <span className="w-1.5 h-1.5 rounded-sm bg-[#3b82f6]" />
                            <span className="text-[var(--text-secondary)]">Thread Messages</span>
                            <span className="text-[8.5px] text-[var(--text-muted)] font-mono opacity-80">(KV-Cache)</span>
                        </span>
                        <span className="font-mono text-[var(--text-primary)] text-[10px]">
                            <b>{formatTokensK(breakdown?.messages_tokens || 0)}</b>{' '}
                            <span className="text-[var(--text-muted)] text-[9.5px]">{breakdown?.messages_percentage || 0}%</span>
                        </span>
                    </div>

                    {/* System Prompt Baseline */}
                    <div className="flex justify-between items-center py-0.5">
                        <span className="flex items-center gap-1.5" title="Base identity directives and safety baseline">
                            <span className="w-1.5 h-1.5 rounded-sm bg-[#eab308]" />
                            <span className="text-[var(--text-secondary)]">System prompt</span>
                            <span className="text-[8.5px] text-[var(--text-muted)] font-mono opacity-80">(Baseline)</span>
                        </span>
                        <span className="font-mono text-[var(--text-primary)] text-[10px]">
                            <b>{formatTokensK(breakdown?.system_prompt_tokens || 0)}</b>{' '}
                            <span className="text-[var(--text-muted)] text-[9.5px]">{breakdown?.system_prompt_percentage || 0}%</span>
                        </span>
                    </div>

                    {/* Skills Category */}
                    <div className="flex flex-col border-t border-[var(--border-color)]/40 pt-1">
                        <div className="flex justify-between items-center">
                            <span className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-sm bg-[#ec4899]" />
                                <span className="text-[var(--text-secondary)]">
                                    Skills ( {skillsCount} )
                                </span>
                            </span>
                            <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[var(--text-primary)] text-[10px]">
                                    <b>{formatTokensK(skillsTokens)}</b>{' '}
                                    <span className="text-[var(--text-muted)] text-[9.5px]">{skillsPct}%</span>
                                </span>
                                <button
                                    type="button"
                                    onClick={() => toggleCategory('skills')}
                                    className="bg-pink-500/15 text-pink-400 hover:bg-pink-500/25 border border-pink-500/30 rounded px-1 py-0.2 text-[8.5px] font-medium transition-colors cursor-pointer"
                                >
                                    {openCategory === 'skills' ? '▴ Close' : '▾ Open'}
                                </button>
                            </div>
                        </div>
                        {openCategory === 'skills' && (
                            <div className="pl-3 pt-1 pb-0.5 flex flex-col gap-0.5">
                                {renderTreeItems(
                                    breakdown?.skills?.items,
                                    'skills',
                                    <span className="italic">Guidance instructions with 0-token idle deferral footprint.</span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Plugins Category */}
                    <div className="flex flex-col border-t border-[var(--border-color)]/40 pt-1">
                        <div className="flex justify-between items-center">
                            <span className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-sm bg-[#ea580c]" />
                                <span className="text-[var(--text-secondary)]">
                                    Plugins ( {pluginsCount} )
                                </span>
                            </span>
                            <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[var(--text-primary)] text-[10px]">
                                    <b>{formatTokensK(pluginsTokens)}</b>{' '}
                                    <span className="text-[var(--text-muted)] text-[9.5px]">{pluginsPct}%</span>
                                </span>
                                <button
                                    type="button"
                                    onClick={() => toggleCategory('plugins')}
                                    className="bg-orange-500/15 text-orange-400 hover:bg-orange-500/25 border border-orange-500/30 rounded px-1 py-0.2 text-[8.5px] font-medium transition-colors cursor-pointer"
                                >
                                    {openCategory === 'plugins' ? '▴ Close' : '▾ Open'}
                                </button>
                            </div>
                        </div>
                        {openCategory === 'plugins' && (
                            <div className="pl-3 pt-1 pb-0.5 flex flex-col gap-0.5">
                                {renderTreeItems(
                                    breakdown?.plugins?.items,
                                    'plugins',
                                    <div>• Sandbox: Wasmtime fuel cap (1,000,000 instrs), 16MB RAM cap.</div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* MCP Tools Category */}
                    <div className="flex flex-col border-t border-[var(--border-color)]/40 pt-1">
                        <div className="flex justify-between items-center">
                            <span className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-sm bg-[#10b981]" />
                                <span className="text-[var(--text-secondary)]">
                                    MCP tools ( {mcpCount} )
                                </span>
                            </span>
                            <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[var(--text-primary)] text-[10px]">
                                    <b>{formatTokensK(mcpTokens)}</b>{' '}
                                    <span className="text-[var(--text-muted)] text-[9.5px]">{mcpPct}%</span>
                                </span>
                                <button
                                    type="button"
                                    onClick={() => toggleCategory('mcp')}
                                    className="bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 rounded px-1 py-0.2 text-[8.5px] font-medium transition-colors cursor-pointer"
                                >
                                    {openCategory === 'mcp' ? '▴ Close' : '▾ Open'}
                                </button>
                            </div>
                        </div>
                        {openCategory === 'mcp' && (
                            <div className="pl-3 pt-1 pb-0.5 flex flex-col gap-0.5">
                                {renderTreeItems(
                                    breakdown?.mcp_tools?.items,
                                    'MCP tools',
                                    <span className="italic">JSON-RPC 2.0 stdio pipes. Dynamic discovery via tools/list.</span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Free Space */}
                    <div className="flex justify-between items-center border-t border-[var(--border-color)]/40 pt-1">
                        <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
                            <span className="w-1.5 h-1.5 rounded-sm bg-[var(--text-muted)]/40" />
                            <span>Free space</span>
                        </span>
                        <span className="font-mono text-[var(--text-primary)] text-[10px]">
                            <b>{formatTokensK(breakdown?.free_space_tokens || totalLimit - totalActive)}</b>{' '}
                            <span className="text-[var(--text-muted)] text-[9.5px]">{breakdown?.free_space_percentage || Math.max(0, 100 - activePct)}%</span>
                        </span>
                    </div>
                </div>
            </div>
        </>
    );
};

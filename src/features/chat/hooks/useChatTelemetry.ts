import { useState, useCallback, useRef, useEffect } from 'react';
import { useConnectionStore } from '../../../store/engine/useConnectionStore';
import { chatApi } from '../../../api/engine/chat/chat.api';
import { componentsApi } from '../../../api/engine/tools/components/components.api';
import type { ToolKind } from '../../../api/engine/tools/catalog';
import type { ComponentTelemetryItem, CategoryTelemetryGroup, ContextBreakdown } from '../../../api/engine/chat/chat.types';
export type { ComponentTelemetryItem, CategoryTelemetryGroup, ContextBreakdown } from '../../../api/engine/chat/chat.types';

export interface LivePerformanceStats {
    tps: string;
    ttft: string;
    elapsed: string;
    tokens: number;
    isStreaming: boolean;
}

export function formatTokensK(n?: number): string {
    if (!n && n !== 0) return '0';
    if (n >= 1048576) {
        const m = n / 1048576;
        return m % 1 === 0 ? `${m}M` : `${m.toFixed(1)}M`;
    }
    if (n >= 1024) {
        const k = n / 1024;
        // One decimal, never rounded up: 15872 tokens is 15.5k, not 16k
        return k % 1 === 0 ? `${k}k` : `${(Math.floor(k * 10) / 10).toFixed(1)}k`;
    }
    return n.toString();
}

/**
 * Formats a duration in milliseconds into a dynamic human-friendly unit:
 * - < 1000ms: 'XXXms' (e.g. 795ms)
 * - < 60s: 'X.Xs' or 'Xs' (e.g. 1.8s, 2s)
 * - < 60m: 'Xm Ys' (e.g. 1m 24s)
 * - >= 60m: 'Xh Ym' (e.g. 1h 12m)
 */
export function formatDuration(ms?: number): string {
    if (ms === undefined || ms === null || isNaN(ms)) return 'Completed';
    const rounded = Math.round(ms);
    if (rounded < 1000) {
        return `${rounded}ms`;
    }
    if (rounded < 60000) {
        const sec = (ms / 1000).toFixed(1);
        return `${sec.endsWith('.0') ? sec.slice(0, -2) : sec}s`;
    }
    if (rounded < 3600000) {
        const m = Math.floor(rounded / 60000);
        const s = Math.floor((rounded % 60000) / 1000);
        return s > 0 ? `${m}m ${s}s` : `${m}m`;
    }
    const h = Math.floor(rounded / 3600000);
    const m = Math.floor((rounded % 3600000) / 60000);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function useChatTelemetry() {
    const connection = useConnectionStore(state => `${state.protocol}:${state.getBaseUrl()}`);
    const contextRead = useRef<AbortController | null>(null);
    const contextVersion = useRef(0);
    const snapshotVersion = useRef(0);
    const contextScope = useRef('');
    const [breakdown, setBreakdownState] = useState<ContextBreakdown | null>(null);
    const [liveStats, setLiveStats] = useState<LivePerformanceStats>({
        tps: '0.00',
        ttft: '0.00',
        elapsed: '0.00',
        tokens: 0,
        isStreaming: false
    });

    const streamStartTime = useRef<number>(0);
    const firstTokenTime = useRef<number | null>(null);
    const tokenCount = useRef<number>(0);
    const pendingTokensRef = useRef<number>(0);
    const lastUiUpdateRef = useRef<number>(0);

    const catalogRef = useRef<{ skill: ComponentTelemetryItem[]; plugin: ComponentTelemetryItem[]; mcp: ComponentTelemetryItem[] }>({
        skill: [],
        plugin: [],
        mcp: []
    });
    const executedToolsRef = useRef<Map<string, { latency_ms?: number; status: string; tokens?: number }>>(new Map());

    const resolveCategory = useCallback((tName: string, hint?: string): 'skills' | 'plugins' | 'mcp_tools' => {
        const h = hint?.toLowerCase() || '';
        if (h.includes('skill')) return 'skills';
        if (h.includes('mcp')) return 'mcp_tools';
        if (h.includes('plugin')) return 'plugins';

        const clean = tName.toLowerCase();
        if (catalogRef.current.plugin.some(p => p.name.toLowerCase() === clean || p.id.toLowerCase() === clean)) {
            return 'plugins';
        }
        if (catalogRef.current.mcp.some(m => m.name.toLowerCase() === clean || m.id.toLowerCase() === clean)) {
            return 'mcp_tools';
        }
        if (catalogRef.current.skill.some(s => s.name.toLowerCase() === clean || s.id.toLowerCase() === clean)) {
            return 'skills';
        }
        return 'skills';
    }, []);

    const mergeCategory = useCallback((
        categoryName: string,
        backendGroup: any,
        catalogItems: ComponentTelemetryItem[],
        activeToolNames: string[] = []
    ): CategoryTelemetryGroup => {
        const rawItems: any[] = backendGroup?.items || [];
        const backendTokens = backendGroup?.tokens ?? backendGroup?.total_tokens ?? 0;
        const backendPercent = backendGroup?.percent ?? 0;

        const consumedToolKeys = new Set<string>();

        const mergedItems: ComponentTelemetryItem[] = catalogItems.map(catItem => {
            const catIdLower = catItem.id.toLowerCase();
            const catNameLower = catItem.name.toLowerCase();

            let isExecuted: { latency_ms?: number; status: string; tokens?: number } | undefined;

            for (const [toolKey, exec] of executedToolsRef.current.entries()) {
                const keyLower = toolKey.toLowerCase();
                const isMatch = (
                    keyLower === catIdLower ||
                    keyLower === catNameLower ||
                    (categoryName === 'skills' && (catIdLower.includes('code') || catNameLower.includes('code')) && keyLower.includes('code'))
                );
                if (isMatch) {
                    isExecuted = exec;
                    consumedToolKeys.add(toolKey);
                    break;
                }
            }

            const isExplicitlyActive = activeToolNames.some(t => 
                t.toLowerCase() === catItem.id.toLowerCase() || 
                t.toLowerCase() === catItem.name.toLowerCase() ||
                catItem.id.toLowerCase().includes(t.toLowerCase()) ||
                t.toLowerCase().includes(catItem.id.toLowerCase())
            );

            const backendMatch = rawItems.find(r => r.name === catItem.name || r.name === catItem.id || r.id === catItem.id);
            const isActiveInContext = isExplicitlyActive || backendMatch?.status === 'active';
            const itemTokens = (backendMatch?.tokens && backendMatch.tokens > 0)
                ? backendMatch.tokens
                : (catItem.tokens || 0);
            const realTokens = (isActiveInContext || isExecuted) 
                ? itemTokens 
                : 0;

            if (isExecuted) {
                return {
                    ...catItem,
                    status: isActiveInContext ? 'active' : (isExecuted.status || 'completed'),
                    execution_latency_ms: isExecuted.latency_ms ?? catItem.execution_latency_ms,
                    tokens: realTokens
                };
            }
            if (backendMatch && backendMatch.execution_latency_ms) {
                return {
                    ...catItem,
                    status: isActiveInContext ? 'active' : (backendMatch.status || 'completed'),
                    execution_latency_ms: backendMatch.execution_latency_ms ?? catItem.execution_latency_ms,
                    tokens: realTokens
                };
            }
            if (isActiveInContext) {
                return {
                    ...catItem,
                    status: 'active',
                    tokens: realTokens
                };
            }
            return {
                ...catItem,
                status: 'idle',
                tokens: 0
            };
        });

        // Add any backend items that weren't in catalog
        rawItems.forEach(r => {
            if (!mergedItems.some(m => m.id === r.id || m.name === r.name)) {
                const isActive = r.status === 'active';
                mergedItems.push({
                    id: r.id || r.name,
                    name: r.name || r.id,
                    status: isActive ? 'active' : (r.execution_latency_ms ? (r.status || 'completed') : (r.status || 'idle')),
                    tokens: isActive ? (r.tokens || 0) : 0,
                    icon_svg: r.icon_svg,
                    security_mode: r.security_mode,
                    execution_latency_ms: r.execution_latency_ms
                });
            }
        });

        // Add any executed tools that weren't in catalog or backend rawItems
        executedToolsRef.current.forEach((execData, toolKey) => {
            if (consumedToolKeys.has(toolKey)) return;
            const targetCat = resolveCategory(toolKey);
            if (categoryName === targetCat && !mergedItems.some(m => m.id === toolKey || m.name === toolKey)) {
                mergedItems.push({
                    id: toolKey,
                    name: toolKey,
                    category: targetCat === 'skills' ? 'skill' : (targetCat === 'mcp_tools' ? 'mcp' : 'plugin'),
                    status: execData.status || 'completed',
                    security_mode: 'sandboxed',
                    tokens: execData.tokens || 0,
                    execution_latency_ms: execData.latency_ms ?? 0
                });
            }
        });

        const isItemVisible = (i: ComponentTelemetryItem) => 
            i.status === 'active' || i.status === 'running' || i.status === 'completed' || Boolean(i.execution_latency_ms && i.execution_latency_ms > 0);

        const count = mergedItems.filter(isItemVisible).length;
        const activeTokens = backendTokens > 0 
            ? backendTokens 
            : mergedItems
                .filter(i => i.status === 'active' || i.status === 'running' || i.status === 'completed')
                .reduce((acc, i) => acc + (i.tokens || 0), 0);

        return {
            name: categoryName,
            count: backendGroup?.count ? Math.max(backendGroup.count, count) : count,
            active_count: count,
            tokens: activeTokens,
            total_tokens: activeTokens,
            percent: backendPercent,
            items: mergedItems
        };
    }, []);

    const setBreakdown = useCallback((updater: ContextBreakdown | ((prev: ContextBreakdown | null) => ContextBreakdown | null)) => {
        if (typeof updater !== 'function') snapshotVersion.current++;
        setBreakdownState(prev => {
            const next = typeof updater === 'function' ? updater(prev) : updater;
            if (!next) return next;

            const activeTools = next.active_tools || [];
            const mergedSkills = mergeCategory('skills', next.skills || prev?.skills, catalogRef.current.skill, activeTools);
            const mergedPlugins = mergeCategory('plugins', next.plugins || prev?.plugins, catalogRef.current.plugin, activeTools);
            const mergedMcp = mergeCategory('mcp_tools', next.mcp_tools || prev?.mcp_tools, catalogRef.current.mcp, activeTools);

            const totalLimit = next.total_context_limit ?? prev?.total_context_limit ?? 0;
            const pct = (t: number) => totalLimit > 0 ? Number(((t / totalLimit) * 100).toFixed(1)) : 0;

            const skillsTok = next.skills_tokens ?? mergedSkills.tokens ?? 0;
            const pluginsTok = next.plugins_tokens ?? mergedPlugins.tokens ?? 0;
            const mcpTok = next.mcp_tools_tokens ?? mergedMcp.tokens ?? 0;

            const activeToolsTok = skillsTok + pluginsTok + mcpTok;
            const sysPromptTok = next.system_prompt_tokens ?? prev?.system_prompt_tokens ?? 0;
            const msgTok = next.messages_tokens ?? prev?.messages_tokens ?? 0;
            const totalActive = Math.min(totalLimit, sysPromptTok + msgTok + activeToolsTok);

            // Explicit SSE snapshots retain their measured totals; functional updates derive local estimates.
            const derived = typeof updater !== 'function' || next === prev ? next : {
                ...next,
                skills_tokens: skillsTok,
                skills_percentage: pct(skillsTok),
                plugins_tokens: pluginsTok,
                plugins_percentage: pct(pluginsTok),
                mcp_tools_tokens: mcpTok,
                mcp_tools_percentage: pct(mcpTok),
                total_active_tokens: totalActive,
                active_percentage: pct(totalActive),
                free_space_tokens: Math.max(0, totalLimit - totalActive),
                free_space_percentage: pct(Math.max(0, totalLimit - totalActive)),
            };
            return { ...derived,
                skills: { ...mergedSkills, tokens: derived.skills_tokens, percent: derived.skills_percentage },
                plugins: { ...mergedPlugins, tokens: derived.plugins_tokens, percent: derived.plugins_percentage },
                mcp_tools: { ...mergedMcp, tokens: derived.mcp_tools_tokens, percent: derived.mcp_tools_percentage },
            };
        });
    }, [mergeCategory]);

    const recordToolExecution = useCallback((
        toolName: string, 
        latencyMs?: number, 
        status: 'running' | 'completed' | 'failed' = 'completed',
        categoryHint?: string
    ) => {
        const targetCategoryName = resolveCategory(toolName, categoryHint);
        const catList = targetCategoryName === 'skills' 
            ? catalogRef.current.skill 
            : (targetCategoryName === 'mcp_tools' ? catalogRef.current.mcp : catalogRef.current.plugin);
        const catMatch = catList.find(c => 
            c.id.toLowerCase() === toolName.toLowerCase() || 
            c.name.toLowerCase() === toolName.toLowerCase() ||
            (targetCategoryName === 'skills' && toolName.toLowerCase().includes('code') && (c.id.includes('code') || c.name.toLowerCase().includes('code')))
        );
        const itemTokens = catMatch?.tokens || 0;

        executedToolsRef.current.set(toolName, {
            latency_ms: latencyMs,
            status,
            tokens: itemTokens
        });

        setBreakdownState(prev => {
            if (!prev) return prev;

            const grp = targetCategoryName === 'skills' 
                ? prev.skills 
                : (targetCategoryName === 'mcp_tools' ? prev.mcp_tools : prev.plugins);

            const updateCategory = (existingGrp?: CategoryTelemetryGroup): CategoryTelemetryGroup => {
                const currentItems = existingGrp?.items ? [...existingGrp.items] : [];
                const idx = currentItems.findIndex(it => 
                    it.name.toLowerCase() === toolName.toLowerCase() || 
                    toolName.toLowerCase().includes(it.name.toLowerCase()) || 
                    it.id.toLowerCase() === toolName.toLowerCase() || 
                    toolName.toLowerCase().includes(it.id.toLowerCase())
                );

                if (idx >= 0) {
                    currentItems[idx] = {
                        ...currentItems[idx],
                        status: status === 'running' ? 'running' : status,
                        execution_latency_ms: latencyMs ?? currentItems[idx].execution_latency_ms,
                        tokens: (currentItems[idx].tokens && currentItems[idx].tokens > 0) ? currentItems[idx].tokens : itemTokens
                    };
                } else {
                    currentItems.push({
                        id: toolName,
                        name: toolName,
                        category: targetCategoryName === 'skills' ? 'skill' : (targetCategoryName === 'mcp_tools' ? 'mcp' : 'plugin'),
                        status: status === 'running' ? 'running' : status,
                        security_mode: 'sandboxed',
                        tokens: itemTokens,
                        execution_latency_ms: latencyMs ?? 0
                    });
                }

                const count = currentItems.filter(i => 
                    i.status === 'active' || i.status === 'running' || i.status === 'completed' || Boolean(i.execution_latency_ms && i.execution_latency_ms > 0)
                ).length;

                const categoryTokens = currentItems
                    .filter(i => i.status === 'active' || i.status === 'running' || i.status === 'completed')
                    .reduce((sum, it) => sum + (it.tokens || 0), 0);

                const totalLimit = prev.total_context_limit ?? 0;
                const pct = totalLimit > 0 ? Number(((categoryTokens / totalLimit) * 100).toFixed(1)) : 0;

                return {
                    name: targetCategoryName,
                    count,
                    active_count: count,
                    tokens: categoryTokens,
                    total_tokens: categoryTokens,
                    percent: pct,
                    items: currentItems
                };
            };

            const updatedGroup = updateCategory(grp);
            const totalLimit = prev.total_context_limit ?? 0;
            const pct = (t: number) => totalLimit > 0 ? Number(((t / totalLimit) * 100).toFixed(1)) : 0;

            const skillsGroup = targetCategoryName === 'skills' ? updatedGroup : prev.skills;
            const pluginsGroup = targetCategoryName === 'plugins' ? updatedGroup : prev.plugins;
            const mcpGroup = targetCategoryName === 'mcp_tools' ? updatedGroup : prev.mcp_tools;

            const skillsTok = skillsGroup?.tokens || 0;
            const pluginsTok = pluginsGroup?.tokens || 0;
            const mcpTok = mcpGroup?.tokens || 0;

            const activeToolsTok = skillsTok + pluginsTok + mcpTok;
            const sysPromptTok = prev.system_prompt_tokens ?? 0;
            const msgTok = prev.messages_tokens || 0;
            const totalActive = Math.min(totalLimit, sysPromptTok + msgTok + activeToolsTok);

            return {
                ...prev,
                skills_tokens: skillsTok,
                skills_percentage: pct(skillsTok),
                plugins_tokens: pluginsTok,
                plugins_percentage: pct(pluginsTok),
                mcp_tools_tokens: mcpTok,
                mcp_tools_percentage: pct(mcpTok),
                total_active_tokens: totalActive,
                active_percentage: pct(totalActive),
                free_space_tokens: Math.max(0, totalLimit - totalActive),
                free_space_percentage: pct(Math.max(0, totalLimit - totalActive)),
                skills: skillsGroup,
                plugins: pluginsGroup,
                mcp_tools: mcpGroup,
            };
        });
    }, [resolveCategory]);

    const syncSessionTokens = useCallback((messages: Array<{ text?: string; thinking?: string }>) => {
        if (!messages || messages.length === 0) return;
        const estimatedMessagesTokens = messages.reduce((acc, m) => {
            const textLen = (m.text ? m.text.length : 0) + (m.thinking ? m.thinking.length : 0);
            if (textLen === 0) return acc;
            return acc + Math.max(1, Math.round(textLen / 3.8));
        }, 0);

        setBreakdown(prev => {
            const totalLimit = prev?.total_context_limit || 0;
            const modelNative = prev?.model_native_context || 0;
            const sysTokens = prev?.system_prompt_tokens ?? 0;
            const skillsTokens = prev?.skills_tokens || 0;
            const pluginsTokens = prev?.plugins_tokens || 0;
            const mcpTokens = prev?.mcp_tools_tokens || 0;
            const activeToolsTokens = skillsTokens + pluginsTokens + mcpTokens;

            const finalMessagesTokens = liveStatsRef.current.isStreaming
                ? Math.max(estimatedMessagesTokens, prev?.messages_tokens || 0)
                : estimatedMessagesTokens;
            const totalActive = Math.min(totalLimit, sysTokens + finalMessagesTokens + activeToolsTokens);
            const pct = (t: number) => totalLimit > 0 ? Math.min(100, Number(((t / totalLimit) * 100).toFixed(1))) : 0;

            return {
                total_context_limit: totalLimit,
                model_native_context: modelNative,
                total_active_tokens: totalActive,
                active_percentage: pct(totalActive),
                messages_tokens: finalMessagesTokens,
                messages_percentage: pct(finalMessagesTokens),
                system_prompt_tokens: sysTokens,
                system_prompt_percentage: pct(sysTokens),
                skills_tokens: skillsTokens,
                skills_percentage: pct(skillsTokens),
                plugins_tokens: pluginsTokens,
                plugins_percentage: pct(pluginsTokens),
                mcp_tools_tokens: mcpTokens,
                mcp_tools_percentage: pct(mcpTokens),
                free_space_tokens: Math.max(0, totalLimit - totalActive),
                free_space_percentage: pct(Math.max(0, totalLimit - totalActive)),
                skills: prev?.skills,
                plugins: prev?.plugins,
                mcp_tools: prev?.mcp_tools,
            };
        });
    }, []);

    useEffect(() => () => { contextRead.current?.abort(); contextVersion.current++; }, [connection]);

    const fetchContextTelemetry = useCallback(async (model = 'default', sessionId = 'default') => {
        contextRead.current?.abort();
        const controller = new AbortController();
        contextRead.current = controller;
        const version = ++contextVersion.current;
        const snapshot = snapshotVersion.current;
        const scope = JSON.stringify([connection, model, sessionId]);
        if (scope !== contextScope.current) { contextScope.current = scope; setBreakdownState(null); }
        try {
            const data = await chatApi.getContextTelemetry({ model, session_id: sessionId }, controller.signal);
            if (controller.signal.aborted || version !== contextVersion.current || snapshot !== snapshotVersion.current) return;
            // This query counts tools; local message estimates and later measured SSE snapshots have their own owner.
            setBreakdown(prev => ({ ...data.telemetry.context_breakdown,
                messages_tokens: prev?.messages_tokens ?? data.telemetry.context_breakdown.messages_tokens,
                system_prompt_tokens: prev?.system_prompt_tokens ?? data.telemetry.context_breakdown.system_prompt_tokens,
            }));
        } catch (e) {
            if (!controller.signal.aborted && version === contextVersion.current) console.warn('[Telemetry] Failed to refresh context telemetry:', e);
        }
    }, [connection, setBreakdown]);

    const startStreaming = useCallback(() => {
        streamStartTime.current = performance.now();
        firstTokenTime.current = null;
        tokenCount.current = 0;
        pendingTokensRef.current = 0;
        lastUiUpdateRef.current = 0;
        setLiveStats({
            tps: '0.00',
            ttft: '0.00',
            elapsed: '0.00',
            tokens: 0,
            isStreaming: true
        });
    }, []);

    const recordToken = useCallback(() => {
        const now = performance.now();
        tokenCount.current += 1;
        pendingTokensRef.current += 1;

        if (firstTokenTime.current === null) {
            firstTokenTime.current = now;
        }

        // Throttle UI re-renders to ~20 FPS (50ms) to prevent UI thread freezing during high-speed inference
        if (now - lastUiUpdateRef.current >= 48 || tokenCount.current === 1) {
            lastUiUpdateRef.current = now;
            const tokensToAdd = pendingTokensRef.current;
            pendingTokensRef.current = 0;

            const ttftSec = firstTokenTime.current ? ((firstTokenTime.current - streamStartTime.current) / 1000).toFixed(2) : '0.00';
            const elapsedSec = ((now - streamStartTime.current) / 1000).toFixed(2);
            
            let tps = '0.00';
            const genElapsed = (now - (firstTokenTime.current || now)) / 1000;
            if (genElapsed > 0.05) {
                tps = (tokenCount.current / genElapsed).toFixed(2);
            }

            setLiveStats({
                tps,
                ttft: ttftSec,
                elapsed: elapsedSec,
                tokens: tokenCount.current,
                isStreaming: true
            });

            // Lightweight streaming context allocation without re-running heavy category merges
            setBreakdownState(prev => {
                if (!prev) return prev;
                const newMessagesTokens = prev.messages_tokens + tokensToAdd;
                const totalLimit = prev.total_context_limit || 4096;
                const activeTools = (prev.skills_tokens || 0) + (prev.plugins_tokens || 0) + (prev.mcp_tools_tokens || 0);
                const newTotalActive = Math.min(totalLimit, (prev.system_prompt_tokens || 0) + newMessagesTokens + activeTools);
                const pct = (t: number) => totalLimit > 0 ? Number(((t / totalLimit) * 100).toFixed(1)) : 0;

                return {
                    ...prev,
                    messages_tokens: newMessagesTokens,
                    messages_percentage: pct(newMessagesTokens),
                    total_active_tokens: newTotalActive,
                    active_percentage: pct(newTotalActive),
                    free_space_tokens: Math.max(0, totalLimit - newTotalActive),
                    free_space_percentage: pct(Math.max(0, totalLimit - newTotalActive))
                };
            });
        }
    }, []);

    const liveStatsRef = useRef(liveStats);
    useEffect(() => {
        liveStatsRef.current = liveStats;
    }, [liveStats]);

    const endStreaming = useCallback(() => {
        const now = performance.now();
        const ttftSec = firstTokenTime.current ? ((firstTokenTime.current - streamStartTime.current) / 1000).toFixed(2) : '0.00';
        const elapsedSec = ((now - streamStartTime.current) / 1000).toFixed(2);
        let tps = '0.00';
        const genElapsed = (now - (firstTokenTime.current || now)) / 1000;
        if (genElapsed > 0.05) {
            tps = (tokenCount.current / genElapsed).toFixed(2);
        }

        // Flush any remaining tokens
        if (pendingTokensRef.current > 0) {
            const remaining = pendingTokensRef.current;
            pendingTokensRef.current = 0;
            setBreakdownState(prev => {
                if (!prev) return prev;
                const newMessagesTokens = prev.messages_tokens + remaining;
                const totalLimit = prev.total_context_limit || 0;
                const activeTools = (prev.skills_tokens || 0) + (prev.plugins_tokens || 0) + (prev.mcp_tools_tokens || 0);
                const newTotalActive = Math.min(totalLimit, (prev.system_prompt_tokens || 0) + newMessagesTokens + activeTools);
                const pct = (t: number) => totalLimit > 0 ? Number(((t / totalLimit) * 100).toFixed(1)) : 0;
                return {
                    ...prev,
                    messages_tokens: newMessagesTokens,
                    messages_percentage: pct(newMessagesTokens),
                    total_active_tokens: newTotalActive,
                    active_percentage: pct(newTotalActive),
                    free_space_tokens: Math.max(0, totalLimit - newTotalActive),
                    free_space_percentage: pct(Math.max(0, totalLimit - newTotalActive))
                };
            });
        }

        const finalSnapshot = {
            tps,
            elapsed: elapsedSec,
            ttft: ttftSec,
            tokens: tokenCount.current
        };
        setLiveStats(prev => ({
            ...prev,
            ...finalSnapshot,
            isStreaming: false
        }));
        return finalSnapshot;
    }, []);

    // Load registered tools/skills/plugins so popover can inspect categories
    useEffect(() => {
        const controller = new AbortController();
        catalogRef.current = { skill: [], plugin: [], mcp: [] };
        const fetchComponents = async () => {
            try {
                const data = await componentsApi.listComponents(undefined, controller.signal);
                if (controller.signal.aborted) return;
                const toItems = (cat: ToolKind): ComponentTelemetryItem[] => data.rich[cat].map(item => ({
                    id: item.id, name: item.name, status: item.enabled ? 'deferred' : 'disabled',
                    tokens: item.tokens ?? 0, icon_svg: item.icon_svg ?? undefined, security_mode: item.security_mode,
                }));
                catalogRef.current = { skill: toItems('skill'), plugin: toItems('plugin'), mcp: toItems('mcp') };
                setBreakdown(prev => prev);
            } catch (error) {
                if (!controller.signal.aborted) console.warn('[Telemetry] Tool catalog unavailable:', error);
            }
        };
        fetchComponents();
        return () => controller.abort();
    }, [connection, setBreakdown]);

    return {
        breakdown,
        setBreakdown,
        liveStats,
        fetchContextTelemetry,
        syncSessionTokens,
        startStreaming,
        recordToken,
        endStreaming,
        recordToolExecution
    };
}

import { useState, useCallback, useRef, useEffect } from 'react';
import { useConnectionStore } from '../../../store/engine/useConnectionStore';

export interface ComponentTelemetryItem {
    id: string;
    name: string;
    status: string;
    category?: string;
    tokens?: number;
    icon_svg?: string;
    security_mode?: string;
    memory_cap_mb?: number;
    execution_latency_ms?: number;
    logs?: string[];
}

export interface CategoryTelemetryGroup {
    name?: string;
    count?: number;
    active_count?: number;
    tokens?: number;
    total_tokens?: number;
    percent?: number;
    items: ComponentTelemetryItem[];
}

export interface ContextBreakdown {
    total_context_limit: number;
    model_native_context: number;
    total_active_tokens: number;
    active_percentage: number;
    
    messages_tokens: number;
    messages_percentage: number;
    
    system_prompt_tokens: number;
    system_prompt_percentage: number;
    
    skills_tokens: number;
    skills_percentage: number;
    
    plugins_tokens: number;
    plugins_percentage: number;
    
    mcp_tools_tokens: number;
    mcp_tools_percentage: number;
    
    free_space_tokens: number;
    free_space_percentage: number;

    active_tools?: string[];
    active_tools_count?: number;
    active_tools_tokens?: number;

    skills?: CategoryTelemetryGroup;
    plugins?: CategoryTelemetryGroup;
    mcp_tools?: CategoryTelemetryGroup;
}

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
        return k % 1 === 0 ? `${k}k` : (n >= 10000 ? `${Math.round(k)}k` : `${k.toFixed(1)}k`);
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
        setBreakdownState(prev => {
            const next = typeof updater === 'function' ? updater(prev) : updater;
            if (!next) return next;

            const activeTools = next.active_tools || [];
            const mergedSkills = mergeCategory('skills', next.skills || prev?.skills, catalogRef.current.skill, activeTools);
            const mergedPlugins = mergeCategory('plugins', next.plugins || prev?.plugins, catalogRef.current.plugin, activeTools);
            const mergedMcp = mergeCategory('mcp_tools', next.mcp_tools || prev?.mcp_tools, catalogRef.current.mcp, activeTools);

            const totalLimit = next.total_context_limit || prev?.total_context_limit || 4096;
            const pct = (t: number) => totalLimit > 0 ? Number(((t / totalLimit) * 100).toFixed(1)) : 0;

            const skillsTok = Math.max(next.skills_tokens || 0, mergedSkills.tokens || 0);
            const pluginsTok = Math.max(next.plugins_tokens || 0, mergedPlugins.tokens || 0);
            const mcpTok = Math.max(next.mcp_tools_tokens || 0, mergedMcp.tokens || 0);

            const activeToolsTok = skillsTok + pluginsTok + mcpTok;
            const sysPromptTok = (next.system_prompt_tokens && next.system_prompt_tokens > 0)
                ? next.system_prompt_tokens
                : (prev?.system_prompt_tokens || 32);
            const msgTok = (next.messages_tokens && next.messages_tokens > 0)
                ? next.messages_tokens
                : (prev?.messages_tokens || 0);
            const totalActive = Math.min(totalLimit, sysPromptTok + msgTok + activeToolsTok);

            return {
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
                skills: { ...mergedSkills, tokens: skillsTok, percent: pct(skillsTok) },
                plugins: { ...mergedPlugins, tokens: pluginsTok, percent: pct(pluginsTok) },
                mcp_tools: { ...mergedMcp, tokens: mcpTok, percent: pct(mcpTok) },
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

                const totalLimit = prev.total_context_limit || 4096;
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
            const totalLimit = prev.total_context_limit || 4096;
            const pct = (t: number) => totalLimit > 0 ? Number(((t / totalLimit) * 100).toFixed(1)) : 0;

            const skillsGroup = targetCategoryName === 'skills' ? updatedGroup : prev.skills;
            const pluginsGroup = targetCategoryName === 'plugins' ? updatedGroup : prev.plugins;
            const mcpGroup = targetCategoryName === 'mcp_tools' ? updatedGroup : prev.mcp_tools;

            const skillsTok = skillsGroup?.tokens || 0;
            const pluginsTok = pluginsGroup?.tokens || 0;
            const mcpTok = mcpGroup?.tokens || 0;

            const activeToolsTok = skillsTok + pluginsTok + mcpTok;
            const sysPromptTok = prev.system_prompt_tokens || 32;
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
            const sysTokens = prev?.system_prompt_tokens && prev.system_prompt_tokens > 0 ? prev.system_prompt_tokens : 32;
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

    const fetchContextTelemetry = useCallback(async (model = 'default', sessionId = 'default', activeTools: string[] = []) => {
        try {
            const baseUrl = useConnectionStore.getState().getBaseUrl();
            const toolsParam = encodeURIComponent(JSON.stringify(activeTools));
            const url = `${baseUrl}/v1/chat/context_telemetry?model=${encodeURIComponent(model)}&session_id=${encodeURIComponent(sessionId)}&tools=${toolsParam}`;
            const res = await fetch(url).catch(() => null);
            if (res && res.ok) {
                const data = await res.json();
                const telemetry = data.context_telemetry?.context_breakdown || data.context_telemetry;
                if (telemetry) {
                    setBreakdown(prev => {
                        const safeMessagesTokens = telemetry.messages_tokens > 0 
                            ? telemetry.messages_tokens 
                            : (prev?.messages_tokens || 0);
                        const safeSysPrompt = (telemetry.system_prompt_tokens && telemetry.system_prompt_tokens > 0)
                            ? telemetry.system_prompt_tokens
                            : (prev?.system_prompt_tokens || 32);
                        const safeTotalLimit = telemetry.total_context_limit || prev?.total_context_limit || 4096;
                        const activeTools = (telemetry.skills_tokens || 0) + (telemetry.plugins_tokens || 0) + (telemetry.mcp_tools_tokens || 0);
                        const newTotalActive = Math.min(safeTotalLimit, safeSysPrompt + safeMessagesTokens + activeTools);
                        const pct = (t: number) => safeTotalLimit > 0 ? Number(((t / safeTotalLimit) * 100).toFixed(1)) : 0;

                        return {
                            ...telemetry,
                            messages_tokens: safeMessagesTokens,
                            messages_percentage: pct(safeMessagesTokens),
                            system_prompt_tokens: safeSysPrompt,
                            system_prompt_percentage: pct(safeSysPrompt),
                            total_active_tokens: newTotalActive,
                            active_percentage: pct(newTotalActive),
                            free_space_tokens: Math.max(0, safeTotalLimit - newTotalActive),
                            free_space_percentage: pct(Math.max(0, safeTotalLimit - newTotalActive))
                        };
                    });
                }
            }
        } catch (e) {
            console.warn('[Telemetry] Failed to refresh context telemetry:', e);
        }
    }, []);

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
        const fetchComponents = async () => {
            try {
                const baseUrl = useConnectionStore.getState().getBaseUrl();
                const res = await fetch(`${baseUrl}/api/components/list`).catch(() => null);
                if (res && res.ok) {
                    const data = await res.json();
                    const rich = data.rich || {};
                    const toItems = (cat: string): ComponentTelemetryItem[] => {
                        return (rich[cat] || []).map((it: any) => ({
                            id: it.id || it.name,
                            name: it.name || it.id,
                            status: it.enabled ? 'deferred' : 'disabled',
                            tokens: it.tokens || 0,
                            icon_svg: it.icon_svg,
                            security_mode: it.security_mode
                        }));
                    };

                    catalogRef.current = {
                        skill: toItems('skill'),
                        plugin: toItems('plugin'),
                        mcp: toItems('mcp')
                    };

                    setBreakdown(prev => prev);
                }
            } catch {}
        };
        fetchComponents();
    }, [mergeCategory]);

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

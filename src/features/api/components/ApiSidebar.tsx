import { catalogPillars } from '../utils/catalogGroups';
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useApiStore } from '../../../store/api/useApiStore';
import { ApiEndpoint, HttpMethod } from '../types';
import {
    Search,
    ChevronDown,
    ChevronRight,
    X,
    ChevronsDownUp,
    ChevronsUpDown
} from 'lucide-react';
import { Input } from '../../../components/ui/Input';

// Storage keys for persistent state across page reloads
const LS_PILLARS_COLLAPSED = 'cluaiz_api_collapsed_pillars';
const LS_SUBGROUPS_COLLAPSED = 'cluaiz_api_collapsed_subgroups';
const LS_LAST_ENDPOINT = 'cluaiz_api_last_endpoint';

interface SubGroup {
    id: string;
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    iconColor: string;
    endpoints: ApiEndpoint[];
}

interface PillarGroup {
    id: string;
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    iconColor: string;
    badgeStyle: string;
    subgroups: SubGroup[];
    totalEndpoints: number;
}

export const ApiSidebar: React.FC = () => {
    const {
        apiData,
        isLoadingData,
        activeEndpoint,
        searchQuery,
        setSearchQuery,
        selectEndpoint
    } = useApiStore();

    // Persistent collapsed state for pillars and nested subgroups
    const [collapsedPillars, setCollapsedPillars] = useState<Record<string, boolean>>(() => {
        try {
            const saved = localStorage.getItem(LS_PILLARS_COLLAPSED);
            return saved ? JSON.parse(saved) : {};
        } catch {
            return {};
        }
    });

    const [collapsedSubgroups, setCollapsedSubgroups] = useState<Record<string, boolean>>(() => {
        try {
            const saved = localStorage.getItem(LS_SUBGROUPS_COLLAPSED);
            return saved ? JSON.parse(saved) : {};
        } catch {
            return {};
        }
    });

    // Save states to localStorage whenever changed
    useEffect(() => {
        try {
            localStorage.setItem(LS_PILLARS_COLLAPSED, JSON.stringify(collapsedPillars));
        } catch {}
    }, [collapsedPillars]);

    useEffect(() => {
        try {
            localStorage.setItem(LS_SUBGROUPS_COLLAPSED, JSON.stringify(collapsedSubgroups));
        } catch {}
    }, [collapsedSubgroups]);

    // Save active endpoint selection to localStorage
    const handleSelectEndpoint = useCallback((ep: ApiEndpoint) => {
        selectEndpoint(ep);
        try {
            localStorage.setItem(LS_LAST_ENDPOINT, `${ep.method}:${ep.path}`);
        } catch {}
    }, [selectEndpoint]);

    /**
     * Map flat 11 JSON groups into 5 structured, nested architectural pillars.
     * Prevents flat sprawl and organizes endpoints into clean sub-groups of 3-10 items.
     */
    const pillars = useMemo<PillarGroup[]>(() => catalogPillars(apiData), [apiData]);

    // Restore last visited endpoint on initial data load if activeEndpoint is null
    useEffect(() => {
        if (!activeEndpoint && pillars.length > 0) {
            try {
                const saved = localStorage.getItem(LS_LAST_ENDPOINT);
                if (saved) {
                    const [method, ...pathParts] = saved.split(':');
                    const path = pathParts.join(':');
                    for (const p of pillars) {
                        for (const sub of p.subgroups) {
                            const found = sub.endpoints.find(
                                (ep) => ep.method === method && ep.path === path
                            );
                            if (found) {
                                selectEndpoint(found);
                                // Ensure its parent pillar and subgroup are expanded
                                setCollapsedPillars((prev) => ({ ...prev, [p.id]: false }));
                                setCollapsedSubgroups((prev) => ({ ...prev, [sub.id]: false }));
                                return;
                            }
                        }
                    }
                }
            } catch {}
        }
    }, [activeEndpoint, pillars, selectEndpoint]);

    // Filter pillars and nested subgroups based on user search query
    const filteredPillars = useMemo(() => {
        if (!searchQuery.trim()) return pillars;
        const q = searchQuery.toLowerCase().trim();

        return pillars
            .map((pillar) => {
                const matchedSubgroups = pillar.subgroups
                    .map((sub) => {
                        const matchedEndpoints = sub.endpoints.filter(
                            (ep) =>
                                ep.path.toLowerCase().includes(q) ||
                                ep.method.toLowerCase().includes(q) ||
                                (ep.desc && ep.desc.toLowerCase().includes(q)) ||
                                sub.title.toLowerCase().includes(q)
                        );
                        return {
                            ...sub,
                            endpoints: matchedEndpoints
                        };
                    })
                    .filter((sub) => sub.endpoints.length > 0);

                const totalMatched = matchedSubgroups.reduce(
                    (acc, sub) => acc + sub.endpoints.length,
                    0
                );

                return {
                    ...pillar,
                    subgroups: matchedSubgroups,
                    totalEndpoints: totalMatched
                };
            })
            .filter((p) => p.totalEndpoints > 0);
    }, [pillars, searchQuery]);

    // Toggle pillar collapse/expand
    const togglePillar = (pillarId: string) => {
        setCollapsedPillars((prev) => ({
            ...prev,
            [pillarId]: prev[pillarId] === undefined ? false : !prev[pillarId]
        }));
    };

    // Toggle subgroup collapse/expand
    const toggleSubgroup = (subgroupId: string) => {
        setCollapsedSubgroups((prev) => ({
            ...prev,
            [subgroupId]: prev[subgroupId] === undefined ? false : !prev[subgroupId]
        }));
    };

    // Determine whether all pillars are collapsed for the single 2-state smart toggle
    const isAllCollapsed = useMemo(() => {
        if (pillars.length === 0) return true;
        return pillars.every((p) => collapsedPillars[p.id] === true);
    }, [pillars, collapsedPillars]);

    // Single Smart Toggle action: one click collapses all, next click expands all
    const handleToggleAll = () => {
        if (isAllCollapsed) {
            // Expand All
            setCollapsedPillars({});
            setCollapsedSubgroups({});
        } else {
            // Collapse All
            const allPillars: Record<string, boolean> = {};
            const allSubgroups: Record<string, boolean> = {};
            pillars.forEach((p) => {
                allPillars[p.id] = true;
                p.subgroups.forEach((s) => {
                    allSubgroups[s.id] = true;
                });
            });
            setCollapsedPillars(allPillars);
            setCollapsedSubgroups(allSubgroups);
        }
    };

    // Method badge style helper
    const getMethodBadgeStyle = (method: HttpMethod) => {
        switch (method) {
            case 'GET':
                return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
            case 'POST':
                return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
            case 'PUT':
                return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
            case 'DELETE':
                return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
            default:
                return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
        }
    };

    const totalEndpointsCount = useMemo(() => {
        return pillars.reduce((acc, p) => acc + p.totalEndpoints, 0);
    }, [pillars]);

    return (
        <div className="flex flex-col h-full w-full bg-transparent select-none">
            {/* Header / Search Controls */}
            <div
                className="p-3 border-b border-[var(--border-color)] space-y-2"
                style={{ borderStyle: 'var(--border-style)' }}
            >
                <div className="flex items-center justify-between">
                    <button
                        type="button"
                        onClick={() => selectEndpoint(null)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)] hover:text-[var(--accent-color)] transition-colors cursor-pointer group"
                        title="Switch to Architecture Overview"
                    >
                        <span className="group-hover:underline">API Explorer</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/[0.06] text-[var(--text-muted)] font-mono">
                            {totalEndpointsCount}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={handleToggleAll}
                        className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.05] border border-white/[0.06] transition-colors cursor-pointer text-[10px] font-mono"
                        title={isAllCollapsed ? 'Expand all pillars' : 'Collapse all pillars'}
                    >
                        {isAllCollapsed ? (
                            <>
                                <ChevronsUpDown className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                                <span>Expand</span>
                            </>
                        ) : (
                            <>
                                <ChevronsDownUp className="w-3.5 h-3.5" />
                                <span>Compact</span>
                            </>
                        )}
                    </button>
                </div>

                <Input
                    placeholder="Search endpoints, methods, groups..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    sizeVariant="sm"
                    leftIcon={<Search className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
                    rightElement={
                        searchQuery ? (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                                title="Clear search"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        ) : undefined
                    }
                />
            </div>

            {/* Endpoints Nested Tree List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                {isLoadingData && (
                    <div className="p-4 text-center text-xs text-[var(--text-muted)] animate-pulse">
                        Loading API Specifications...
                    </div>
                )}

                {!isLoadingData && filteredPillars.length === 0 && (
                    <div className="p-6 text-center text-xs text-[var(--text-muted)]">
                        No endpoints match &quot;{searchQuery}&quot;
                    </div>
                )}

                {filteredPillars.map((pillar, pillarIndex) => {
                    const PillarIcon = pillar.icon;
                    // Default behavior: when search active -> auto-expand; otherwise check persistent state (default first pillar open, others closed)
                    const isPillarCollapsed = searchQuery
                        ? false
                        : collapsedPillars[pillar.id] !== undefined
                        ? collapsedPillars[pillar.id]
                        : pillarIndex !== 0;

                    return (
                        <div
                            key={pillar.id}
                            className="rounded-lg border border-[var(--border-color)]/40 bg-white/[0.015] overflow-hidden transition-all shadow-sm"
                        >
                            {/* Level 1: Main Pillar Accordion Header */}
                            <button
                                type="button"
                                onClick={() => togglePillar(pillar.id)}
                                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-white/[0.04] transition-colors cursor-pointer"
                            >
                                <div className="flex items-center gap-2 truncate">
                                    <PillarIcon className={`w-4 h-4 shrink-0 ${pillar.iconColor}`} />
                                    <span className="truncate tracking-wide">{pillar.title}</span>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                    <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono font-medium opacity-70 bg-white/[0.06] text-[var(--text-secondary)]">
                                        {pillar.totalEndpoints}
                                    </span>
                                    {isPillarCollapsed ? (
                                        <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                                    ) : (
                                        <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                                    )}
                                </div>
                            </button>

                            {/* Level 2: Nested Sub-Categories */}
                            {!isPillarCollapsed && (
                                <div className="border-t border-[var(--border-color)]/30 p-1.5 space-y-1.5 bg-black/10">
                                    {pillar.subgroups.map((sub, subIndex) => {
                                        const SubIcon = sub.icon;
                                        // Default behavior: when search active -> auto-expand; otherwise persistent state (default first subgroup open, others closed)
                                        const isSubCollapsed = searchQuery
                                            ? false
                                            : collapsedSubgroups[sub.id] !== undefined
                                            ? collapsedSubgroups[sub.id]
                                            : subIndex !== 0;

                                        return (
                                            <div
                                                key={sub.id}
                                                className="rounded-md border border-[var(--border-color)]/25 bg-white/[0.01] overflow-hidden"
                                            >
                                                {/* Subgroup Header */}
                                                <button
                                                    type="button"
                                                    onClick={() => toggleSubgroup(sub.id)}
                                                    className="w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.03] transition-colors cursor-pointer"
                                                >
                                                    <div className="flex items-center gap-1.5 truncate">
                                                        <SubIcon className={`w-3.5 h-3.5 shrink-0 ${sub.iconColor}`} />
                                                        <span className="truncate">{sub.title}</span>
                                                    </div>

                                                    <div className="flex items-center gap-1 shrink-0 ml-1.5">
                                                        <span className="text-[9px] font-mono opacity-60">
                                                            {sub.endpoints.length}
                                                        </span>
                                                        {isSubCollapsed ? (
                                                            <ChevronRight className="w-3 h-3 text-[var(--text-muted)]" />
                                                        ) : (
                                                            <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
                                                        )}
                                                    </div>
                                                </button>

                                                {/* Level 3: Individual Endpoints List */}
                                                {!isSubCollapsed && (
                                                    <div className="p-1 space-y-0.5 border-t border-[var(--border-color)]/20 bg-black/20">
                                                        {sub.endpoints.map((ep: ApiEndpoint) => {
                                                            const isSelected =
                                                                activeEndpoint?.path === ep.path &&
                                                                activeEndpoint?.method === ep.method;

                                                            return (
                                                                <button
                                                                    key={`${ep.method}-${ep.path}`}
                                                                    type="button"
                                                                    onClick={() => handleSelectEndpoint(ep)}
                                                                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition-all cursor-pointer ${
                                                                        isSelected
                                                                            ? 'bg-[var(--accent-color)]/15 border border-[var(--accent-color)]/40 text-[var(--text-primary)] font-medium shadow-sm'
                                                                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.04]'
                                                                    }`}
                                                                    title={ep.desc || ep.path}
                                                                >
                                                                    <span
                                                                        className={`px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase rounded border shrink-0 ${getMethodBadgeStyle(
                                                                            ep.method
                                                                        )}`}
                                                                    >
                                                                        {ep.method}
                                                                    </span>
                                                                    <span className="truncate font-mono text-[11px] leading-tight">
                                                                        {ep.path}
                                                                    </span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>


        </div>
    );
};

import React, { useMemo, useState } from 'react';
import { useApiStore } from '../../../store/api/useApiStore';
import { ApiEndpoint, HttpMethod } from '../types';
import { Search, ChevronDown, ChevronRight, X, Layers } from 'lucide-react';

export const ApiSidebar: React.FC = () => {
    const {
        apiData,
        isLoadingData,
        activeEndpoint,
        searchQuery,
        setSearchQuery,
        selectEndpoint
    } = useApiStore();

    // Track open state for each category group
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

    const toggleGroup = (groupName: string) => {
        setCollapsedGroups((prev) => ({
            ...prev,
            [groupName]: !prev[groupName]
        }));
    };

    const filteredGroups = useMemo(() => {
        if (!searchQuery.trim()) return apiData;
        const q = searchQuery.toLowerCase().trim();

        return apiData
            .map((group) => {
                const matchedEndpoints = group.endpoints.filter(
                    (ep) =>
                        ep.path.toLowerCase().includes(q) ||
                        ep.method.toLowerCase().includes(q) ||
                        (ep.desc && ep.desc.toLowerCase().includes(q))
                );
                return {
                    ...group,
                    endpoints: matchedEndpoints
                };
            })
            .filter((group) => group.endpoints.length > 0);
    }, [apiData, searchQuery]);

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

    return (
        <div className="flex flex-col h-full w-full bg-transparent select-none">
            {/* Search Bar */}
            <div className="px-4 py-2 border-b border-[var(--border-color)]" style={{ borderStyle: 'var(--border-style)' }}>
                <div className="relative flex items-center">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 text-[var(--text-muted)] pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search endpoints..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-color)] transition-colors"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Endpoints List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                {isLoadingData && (
                    <div className="p-4 text-center text-xs text-[var(--text-muted)] animate-pulse">
                        Loading API Specifications...
                    </div>
                )}

                {!isLoadingData && filteredGroups.length === 0 && (
                    <div className="p-4 text-center text-xs text-[var(--text-muted)]">
                        No endpoints match &quot;{searchQuery}&quot;
                    </div>
                )}

                {filteredGroups.map((group) => {
                    const isCollapsed = !!collapsedGroups[group.group];

                    return (
                        <div key={group.group} className="rounded-lg overflow-hidden">
                            {/* Group Header Accordion */}
                            <button
                                type="button"
                                onClick={() => toggleGroup(group.group)}
                                className="w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.03] rounded transition-colors cursor-pointer"
                            >
                                <span className="truncate">{group.group}</span>
                                <div className="flex items-center gap-1.5 text-[10px]">
                                    <span className="opacity-60">{group.endpoints.length}</span>
                                    {isCollapsed ? (
                                        <ChevronRight className="w-3 h-3" />
                                    ) : (
                                        <ChevronDown className="w-3 h-3" />
                                    )}
                                </div>
                            </button>

                            {/* Group Endpoints */}
                            {!isCollapsed && (
                                <div className="mt-1 space-y-0.5 pl-1">
                                    {group.endpoints.map((ep: ApiEndpoint) => {
                                        const isSelected =
                                            activeEndpoint?.path === ep.path &&
                                            activeEndpoint?.method === ep.method;

                                        return (
                                            <button
                                                key={`${ep.method}-${ep.path}`}
                                                type="button"
                                                onClick={() => selectEndpoint(ep)}
                                                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs transition-all cursor-pointer ${
                                                    isSelected
                                                        ? 'bg-[var(--accent-color)]/15 border border-[var(--accent-color)]/30 text-[var(--text-primary)] font-medium shadow-sm'
                                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.04]'
                                                }`}
                                            >
                                                <span
                                                    className={`px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase rounded border ${getMethodBadgeStyle(
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
        </div>
    );
};

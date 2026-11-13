import { Search, Palette, X, Box, Type, Maximize2 } from 'lucide-react';
import Logo3D from '../ui/Logo3D';
import { useThemeStore } from '../../store/ui/useThemeStore';
import { COMPONENT_GROUPS } from './catalog';
import { filterGroups, useShowcaseSelection } from './selection';

/** The design system's directory: search and the component list (beside the stage, or in the Toolkit sidebar) */
export function ShowcaseDirectory({ className = '' }: { className?: string }) {
    const theme = useThemeStore(state => state.theme);
    const { selectedId, setSelectedId, searchQuery, setSearchQuery } = useShowcaseSelection();
    const filteredGroups = filterGroups(searchQuery);
    return (
            <aside className={`flex flex-col h-full min-h-0 select-none ${className}`}>
                {/* Sidebar Header */}
                <div className="p-4 border-b border-[var(--border-color)] space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {/* <div className="p-1.5 rounded-lg bg-[var(--accent-color)]/10 text-[var(--accent-color)] border border-[var(--accent-color)]/20 shadow-sm">
                                <Layers className="w-4 h-4" />
                            </div> */}
                            <div className="w-24 h-24">
                                <Logo3D />
                            </div>
                            <div>
                                <span className="text-xs font-black uppercase tracking-wider text-[var(--text-primary)] block">
                                    Cluaiz Design System
                                </span>
                                <span className="text-[10px] text-[var(--text-muted)] font-mono">Component reference</span>
                            </div>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--accent-color)]/15 text-[var(--accent-color)] font-bold">
                            {COMPONENT_GROUPS.flatMap(group => group.items).length} components
                        </span>
                    </div>

                    {/* Search Field */}
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
                        <input
                            type="text"
                            placeholder="Search tokens & components..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-color)] transition-colors"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Sidebar Scrollable Nav List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-5 scrollbar-thin">
                    {filteredGroups.map((grp) => (
                        <div key={grp.group} className="space-y-1">
                            <div className="px-2 pb-1 text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] flex items-center justify-between">
                                <span>{grp.group}</span>
                                <span className="text-[9px] font-mono opacity-60">{grp.items.length}</span>
                            </div>

                            <div className="space-y-0.5">
                                {grp.items.map((item) => {
                                    const isSelected = selectedId === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => setSelectedId(item.id)}
                                            className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-between group ${isSelected
                                                ? 'bg-[var(--accent-color)] text-[var(--accent-contrast)] shadow-sm font-semibold'
                                                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)]/70'
                                                }`}
                                        >
                                            <div className="flex items-center gap-2 truncate">
                                                {item.id === 'typography' ? (
                                                    <Type className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[var(--accent-contrast)]' : 'text-[var(--text-muted)] group-hover:text-[var(--accent-color)]'}`} />
                                                ) : item.id === 'radius' ? (
                                                    <Maximize2 className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[var(--accent-contrast)]' : 'text-[var(--text-muted)] group-hover:text-[var(--accent-color)]'}`} />
                                                ) : item.id === 'colors' || item.id === 'themestudio' ? (
                                                    <Palette className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[var(--accent-contrast)]' : 'text-[var(--text-muted)] group-hover:text-[var(--accent-color)]'}`} />
                                                ) : (
                                                    <Box className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[var(--accent-contrast)]' : 'text-[var(--text-muted)] group-hover:text-[var(--accent-color)]'}`} />
                                                )}
                                                <span className="truncate">{item.label}</span>
                                            </div>

                                            {item.tag && (
                                                <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${isSelected
                                                    ? 'bg-black/10 border-current/20 text-[var(--accent-contrast)]'
                                                    : 'bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-muted)]'
                                                    }`}>
                                                    {item.tag}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Sidebar Footer Theme Status & Quick Switch */}
                <div className="p-3 border-t border-[var(--border-color)] bg-[var(--bg-primary)]/50 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                    <div className="flex items-center gap-1.5">
                        <Palette className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                        <span className="capitalize font-medium">{theme} Mode</span>
                    </div>
                    <button
                        onClick={() => setSelectedId('themestudio')}
                        className="px-2 py-0.5 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[10px] text-[var(--accent-color)] hover:bg-[var(--accent-color)]/10 transition-colors"
                    >
                        Tweak
                    </button>
                </div>
            </aside>
    );
}

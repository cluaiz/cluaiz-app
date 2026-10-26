import { Search, Copy, Palette, X, Box, Type, Maximize2 } from 'lucide-react';
import { ToastContainer } from '../ui/toast/ToastContainer';
import Logo3D from '../ui/Logo3D';
import { useShowcaseState } from './state';
import { FoundationDemos } from './FoundationDemos';
import { PrimitiveDemos } from './PrimitiveDemos';
import { DropdownDemos } from './DropdownDemos';
import { OverlayDemos } from './OverlayDemos';
import { EffectDemos } from './EffectDemos';
import { FeedbackDemos } from './FeedbackDemos';
import { MediaDemos } from './MediaDemos';
import { COMPONENT_GROUPS } from './catalog';
import { ComponentReference } from './ComponentReference';
import { DeveloperGuide } from './DeveloperGuide';
export function ShowcaseShell(){
const state=useShowcaseState();
const {theme, selectedId, setSelectedId, searchQuery, setSearchQuery, copiedText, copyToClipboard, filteredGroups, activeItem}=state;
return (
        <div className="flex h-full w-full bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden font-sans">
            {/* Dedicated Toast Container for interactive testing */}
            <ToastContainer />

            {/* LEFT SIDEBAR: DESIGN SYSTEM & COMPONENT DIRECTORY */}
            <aside className="w-72 md:w-80 shrink-0 border-r border-[var(--border-color)] bg-[var(--bg-secondary)]/40 flex flex-col h-full select-none">
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

            {/* RIGHT MAIN PANEL: LIVE DESIGN STAGE */}
            <main className="flex-1 h-full overflow-y-auto flex flex-col">
                {/* Header Canvas Banner */}
                <div className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/20 px-8 py-5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h1 className="text-xl font-black text-[var(--text-primary)] tracking-tight">
                                    {activeItem.label}
                                </h1>
                                <span className="font-mono text-[10px] text-[var(--accent-color)] bg-[var(--accent-color)]/10 px-2 py-0.5 rounded-md border border-[var(--accent-color)]/20">
                                    {activeItem.path}
                                </span>
                            </div>
                            <p className="text-xs text-[var(--text-muted)] mt-1">
                                {activeItem.description}
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => copyToClipboard(activeItem.path)}
                                className="px-3 py-1.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1.5 transition-colors"
                            >
                                <Copy className="w-3.5 h-3.5" />
                                <span>{copiedText === activeItem.path ? 'Copied Path!' : 'Copy Path'}</span>
                            </button>
                        </div>
                    </div>
                </div>

                <DeveloperGuide onCopy={copyToClipboard} copiedText={copiedText} />
                <ComponentReference id={selectedId} onCopy={copyToClipboard} copiedText={copiedText} />
                {state.copyError && <p role="alert" className="p-3 text-sm text-[var(--text-primary)]">{state.copyError}</p>}
                {/* Preview Playground Stage */}
                <div className="flex-1 p-8 max-w-5xl space-y-8">
                    {/* 0A. TYPOGRAPHY FOUNDATIONS */}
                    <FoundationDemos {...state}/>
<PrimitiveDemos {...state}/>
<DropdownDemos {...state}/>
<OverlayDemos {...state}/>
<EffectDemos {...state}/>
<FeedbackDemos {...state}/>
<MediaDemos {...state}/>

                </div>
            </main>
        </div>
    );
}

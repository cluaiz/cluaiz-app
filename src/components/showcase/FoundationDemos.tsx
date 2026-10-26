import { Check, Copy, CheckCircle2, X } from 'lucide-react';

import { toast } from '../ui/toast';
import type { ShowcaseDemoState } from './state';
export function FoundationDemos(state: ShowcaseDemoState){
const {theme, setTheme, darkAccent, setDarkAccent, setLightAccent, fontFamily, setFontFamily, borderRadius, setBorderRadius, selectedId, copyToClipboard, accentOptions, themeModes}=state;
return <>
{selectedId === 'typography' && (
                        <div className="space-y-8">
                            {/* Font Family & Live Scale Controls */}
                            <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-5">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                                            Font Families & Typographic Scale
                                        </h3>
                                        <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                                            Active Family: <code className="text-[var(--accent-color)]">{fontFamily}</code> · Unified optical scaling
                                        </p>
                                    </div>

                                    {/* Font Family Switcher */}
                                    <div className="flex items-center gap-2">
                                        {['Inter', 'JetBrains Mono', 'Fira Code', 'Press Start 2P'].map((font) => (
                                            <button
                                                key={font}
                                                onClick={() => setFontFamily(font)}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${fontFamily === font
                                                    ? 'bg-[var(--accent-color)] text-[var(--accent-contrast)] font-bold'
                                                    : 'bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                                    }`}
                                            >
                                                {font}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Type Scale Hierarchy Table */}
                            <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-6">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                                    Type Scale Hierarchy (Pixels & Line Heights)
                                </h3>

                                <div className="space-y-5 divide-y divide-[var(--border-color)]">
                                    {/* Display H1 */}
                                    <div className="pt-4 first:pt-0 flex flex-col md:flex-row md:items-baseline justify-between gap-4">
                                        <div className="md:w-48 shrink-0">
                                            <span className="text-xs font-mono font-bold text-[var(--accent-color)]">Display / H1</span>
                                            <p className="text-[10px] text-[var(--text-muted)] font-mono">32px (2rem) · font-black</p>
                                        </div>
                                        <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">
                                            Silicon Orchestrator Gateway
                                        </h1>
                                    </div>

                                    {/* Section H2 */}
                                    <div className="pt-4 flex flex-col md:flex-row md:items-baseline justify-between gap-4">
                                        <div className="md:w-48 shrink-0">
                                            <span className="text-xs font-mono font-bold text-[var(--accent-color)]">Section / H2</span>
                                            <p className="text-[10px] text-[var(--text-muted)] font-mono">24px (1.5rem) · font-bold</p>
                                        </div>
                                        <h2 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                                            Real-Time Tensor Compute Graph
                                        </h2>
                                    </div>

                                    {/* Subsection H3 */}
                                    <div className="pt-4 flex flex-col md:flex-row md:items-baseline justify-between gap-4">
                                        <div className="md:w-48 shrink-0">
                                            <span className="text-xs font-mono font-bold text-[var(--accent-color)]">Subsection / H3</span>
                                            <p className="text-[10px] text-[var(--text-muted)] font-mono">18px (1.125rem) · font-semibold</p>
                                        </div>
                                        <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                                            Memory Guard & Unified Buffer Allocation
                                        </h3>
                                    </div>

                                    {/* Body Base */}
                                    <div className="pt-4 flex flex-col md:flex-row md:items-baseline justify-between gap-4">
                                        <div className="md:w-48 shrink-0">
                                            <span className="text-xs font-mono font-bold text-[var(--accent-color)]">Body / Regular</span>
                                            <p className="text-[10px] text-[var(--text-muted)] font-mono">14px (0.875rem) · font-normal</p>
                                        </div>
                                        <p className="text-sm font-normal text-[var(--text-secondary)] leading-relaxed max-w-xl">
                                            Zero-copy execution transfers tensors straight to GPU device memory without going through host RAM serialization passes.
                                        </p>
                                    </div>

                                    {/* Caption / Small */}
                                    <div className="pt-4 flex flex-col md:flex-row md:items-baseline justify-between gap-4">
                                        <div className="md:w-48 shrink-0">
                                            <span className="text-xs font-mono font-bold text-[var(--accent-color)]">Small / Caption</span>
                                            <p className="text-[10px] text-[var(--text-muted)] font-mono">12px (0.75rem) · font-medium</p>
                                        </div>
                                        <p className="text-xs font-medium text-[var(--text-muted)]">
                                            Last sync: 2 ms ago · Latency: 0.45 ms/token · Threads: 16 (AVX-512)
                                        </p>
                                    </div>

                                    {/* Micro / Tag */}
                                    <div className="pt-4 flex flex-col md:flex-row md:items-baseline justify-between gap-4">
                                        <div className="md:w-48 shrink-0">
                                            <span className="text-xs font-mono font-bold text-[var(--accent-color)]">Micro / Token</span>
                                            <p className="text-[10px] text-[var(--text-muted)] font-mono">10px (0.625rem) · font-bold</p>
                                        </div>
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                                            METRIC_VRAM_PEAK_CONSUMPTION
                                        </span>
                                    </div>

                                    {/* Mono Code */}
                                    <div className="pt-4 flex flex-col md:flex-row md:items-baseline justify-between gap-4">
                                        <div className="md:w-48 shrink-0">
                                            <span className="text-xs font-mono font-bold text-[var(--accent-color)]">Code / Mono</span>
                                            <p className="text-[10px] text-[var(--text-muted)] font-mono">11px · font-mono</p>
                                        </div>
                                        <code className="text-[11px] font-mono text-[var(--accent-color)] bg-[var(--bg-primary)] px-2.5 py-1 rounded-md border border-[var(--border-color)]">
                                            ptx_compile_kernel(&quot;gemm_fp16&quot;, Arch::Sm89)?
                                        </code>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
{selectedId === 'radius' && (
                        <div className="space-y-8">
                            {/* Global Concentric Radius Controller */}
                            <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-5">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div>
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                                            Global Unified Corner Radius Controller
                                        </h3>
                                        <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                                            Updates <code className="text-[var(--accent-color)]">--app-radius</code> globally. Notice the entire sidebar, buttons, and cards morph live!
                                        </p>
                                    </div>
                                    <span className="font-mono text-xs font-bold px-3 py-1 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--accent-color)] shrink-0">
                                        Current: {borderRadius}px
                                    </span>
                                </div>

                                <div className="space-y-3">
                                    <input
                                        type="range"
                                        min="0"
                                        max="32"
                                        step="1"
                                        value={borderRadius}
                                        onChange={(e) => setBorderRadius(parseInt(e.target.value))}
                                        className="w-full accent-[var(--accent-color)] cursor-pointer"
                                    />

                                    {/* Preset Radius Buttons */}
                                    <div className="flex flex-wrap items-center gap-2 pt-1">
                                        {[
                                            { label: '0px Sharp', val: 0 },
                                            { label: '6px Compact', val: 6 },
                                            { label: '12px Modern (Default)', val: 12 },
                                            { label: '16px Smooth', val: 16 },
                                            { label: '24px Curved', val: 24 }
                                        ].map((preset) => (
                                            <button
                                                key={preset.val}
                                                onClick={() => setBorderRadius(preset.val)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${borderRadius === preset.val
                                                    ? 'bg-[var(--accent-color)] text-[var(--accent-contrast)] font-bold shadow-sm'
                                                    : 'bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                                    }`}
                                            >
                                                {preset.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3">
                                    <div className="p-5 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl text-center transition-all">
                                        <p className="text-xs font-bold text-[var(--text-primary)]">Card Component</p>
                                        <p className="text-[10px] text-[var(--text-muted)] mt-1">Global radius applied live</p>
                                    </div>
                                    <button className="p-5 bg-[var(--accent-color)] text-[var(--accent-contrast)] text-center font-bold text-xs rounded-xl flex items-center justify-center transition-all shadow-sm">
                                        Button Component
                                    </button>
                                    <div className="p-5 bg-[var(--bg-primary)] border border-[var(--accent-color)]/60 text-center text-xs font-mono text-[var(--text-primary)] rounded-xl transition-all">
                                        Input Field ({borderRadius}px)
                                    </div>
                                </div>
                            </div>

                            {/* Concentric Corner Radius Law (Diagram & Mathematical Rule) */}
                            <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-6">
                                <div>
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                                        Concentric Corner Radius Law (Nested Geometry)
                                    </h3>
                                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                                        The fundamental mathematical rule for nested elements: <code className="text-[var(--accent-color)]">R_inner = max(0, R_outer - padding)</code>.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* ❌ Clashing Radii (Wrong) */}
                                    <div className="p-5 rounded-2xl bg-[var(--bg-primary)] border border-rose-500/30 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5 text-rose-400 font-bold text-xs">
                                                <X className="w-4 h-4" />
                                                <span>Wrong: Outer = Inner</span>
                                            </div>
                                            <span className="text-[10px] font-mono text-rose-400/80 bg-rose-500/10 px-2 py-0.5 rounded">
                                                Visual Clash &amp; Pinching
                                            </span>
                                        </div>

                                        {/* Visual Box */}
                                        <div className="relative p-3 bg-[var(--bg-secondary)] border border-white/10 rounded-2xl flex items-center justify-center">
                                            <div
                                                style={{ borderRadius: `${borderRadius}px` }}
                                                className="w-full h-32 border-2 border-dashed border-rose-400/50 p-2 flex items-center justify-center"
                                            >
                                                <div
                                                    style={{ borderRadius: `${borderRadius}px` }}
                                                    className="w-full h-full bg-rose-500/10 border border-rose-500/40 flex flex-col items-center justify-center text-center p-2"
                                                >
                                                    <span className="text-xs font-bold text-rose-300">Inner: {borderRadius}px</span>
                                                    <span className="text-[9px] text-rose-400/70">Outer: {borderRadius}px (Clashing corners)</span>
                                                </div>
                                            </div>
                                        </div>
                                        <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                                            When inner radius equals outer radius, the distance between the arcs narrows unnaturally at the 45° corner, looking distorted and pinched.
                                        </p>
                                    </div>

                                    {/* ✅ Concentric Harmonic Radii (Correct) */}
                                    <div className="p-5 rounded-2xl bg-[var(--bg-primary)] border border-emerald-500/30 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                                                <Check className="w-4 h-4" />
                                                <span>Correct: Outer = Inner + Padding</span>
                                            </div>
                                            <span className="text-[10px] font-mono text-emerald-400/80 bg-emerald-500/10 px-2 py-0.5 rounded">
                                                Parallel Arcs (Harmonic)
                                            </span>
                                        </div>

                                        {/* Visual Box */}
                                        <div className="relative p-3 bg-[var(--bg-secondary)] border border-white/10 rounded-2xl flex items-center justify-center">
                                            <div
                                                style={{ borderRadius: `${borderRadius}px` }}
                                                className="w-full h-32 border-2 border-emerald-400/70 p-2.5 flex items-center justify-center transition-all"
                                            >
                                                <div
                                                    style={{ borderRadius: `${Math.max(0, borderRadius - 10)}px` }}
                                                    className="w-full h-full bg-emerald-500/10 border border-emerald-500/40 flex flex-col items-center justify-center text-center p-2 transition-all"
                                                >
                                                    <span className="text-xs font-bold text-emerald-300">
                                                        Inner: {Math.max(0, borderRadius - 10)}px
                                                    </span>
                                                    <span className="text-[9px] text-emerald-400/70">
                                                        Outer: {borderRadius}px (Padding: 10px)
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                                            By subtracting the 10px padding from the outer radius, both curves share the exact same radial center. When outer is 0px, inner collapses cleanly to 0px!
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Standard Scale Table */}
                            <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-5">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                                    Official Design Token Radius Scale
                                </h3>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    {[
                                        { name: 'rounded-none', value: '0px', usage: 'Pixel theme & sharp overlays', class: 'rounded-none' },
                                        { name: 'rounded-sm', value: '2px', usage: 'Code tokens & micro badges', class: 'rounded-sm' },
                                        { name: 'rounded-md', value: '6px', usage: 'Context chips & tooltips', class: 'rounded-md' },
                                        { name: 'rounded-lg', value: '8px', usage: 'Icon buttons & list items', class: 'rounded-lg' },
                                        { name: 'rounded-xl', value: '12px', usage: 'Inputs, buttons & dropdowns', class: 'rounded-xl' },
                                        { name: 'rounded-2xl', value: '16px', usage: 'Modals, cards & dialogs', class: 'rounded-2xl' },
                                        { name: 'rounded-3xl', value: '24px', usage: 'Floating HUDs & hero decks', class: 'rounded-3xl' },
                                        { name: 'rounded-full', value: '9999px', usage: 'Status badges & toggle pills', class: 'rounded-full' },
                                    ].map((rad, idx) => (
                                        <div
                                            key={idx}
                                            className="p-4 bg-[var(--bg-primary)] border border-[var(--border-color)] flex flex-col justify-between space-y-3 group hover:border-[var(--accent-color)] transition-all"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="font-mono text-xs font-bold text-[var(--text-primary)]">{rad.name}</span>
                                                <span className="font-mono text-[10px] text-[var(--accent-color)]">{rad.value}</span>
                                            </div>

                                            <div className="h-14 bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center justify-center overflow-hidden">
                                                <div className={`w-10 h-10 bg-[var(--accent-color)]/20 border-2 border-[var(--accent-color)] ${rad.class}`} />
                                            </div>

                                            <p className="text-[10px] text-[var(--text-muted)] leading-tight">{rad.usage}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
{selectedId === 'colors' && (
                        <div className="space-y-8">
                            {/* Surface Depth Layers */}
                            <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                                    Three-Layer Background Surface Depth
                                </h3>
                                <p className="text-xs text-[var(--text-muted)]">
                                    Our layout enforces strict depth separation between viewport canvas, containers, and elevated floating cards.
                                </p>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                                    {[
                                        { token: '--bg-primary', label: 'Layer 1: Canvas Base', desc: 'Main window backdrop behind all panes', bg: 'var(--bg-primary)' },
                                        { token: '--bg-secondary', label: 'Layer 2: Surface Panes', desc: 'Sidebars, content cards, and chat deck', bg: 'var(--bg-secondary)' },
                                        { token: '--bg-tertiary', label: 'Layer 3: Elevated Items', desc: 'Hovered rows, toolbars, and active chips', bg: 'var(--bg-tertiary, rgba(255,255,255,0.06))' },
                                    ].map((layer, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => copyToClipboard(`var(${layer.token})`)}
                                            className="p-5 rounded-2xl border border-[var(--border-color)] text-left space-y-3 hover:border-[var(--accent-color)] transition-all group"
                                            style={{ backgroundColor: layer.bg }}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="font-mono text-xs font-bold text-[var(--text-primary)]">{layer.token}</span>
                                                <Copy className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--accent-color)]" />
                                            </div>
                                            <p className="text-xs font-bold text-[var(--text-primary)]">{layer.label}</p>
                                            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{layer.desc}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Text Contrast Tokens */}
                            <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                                    Text Contrast & Hierarchy Tokens
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] space-y-1">
                                        <span className="font-mono text-[10px] text-[var(--accent-color)] font-bold">--text-primary</span>
                                        <p className="text-sm font-bold text-[var(--text-primary)]">Primary Headings & Active Values</p>
                                        <p className="text-[10px] text-[var(--text-muted)]">100% full optical contrast</p>
                                    </div>
                                    <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] space-y-1">
                                        <span className="font-mono text-[10px] text-[var(--accent-color)] font-bold">--text-secondary</span>
                                        <p className="text-sm font-medium text-[var(--text-secondary)]">Secondary Labels & Body Paragraphs</p>
                                        <p className="text-[10px] text-[var(--text-muted)]">75% balanced readable contrast</p>
                                    </div>
                                    <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] space-y-1">
                                        <span className="font-mono text-[10px] text-[var(--accent-color)] font-bold">--text-muted</span>
                                        <p className="text-sm font-medium text-[var(--text-muted)]">Muted Timestamps & Micro Hints</p>
                                        <p className="text-[10px] text-[var(--text-muted)]">45% de-emphasized metadata</p>
                                    </div>
                                </div>
                            </div>

                            {/* Semantic Status Colors */}
                            <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                                    Semantic Status Signals
                                </h3>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    {[
                                        { name: 'Success Signal', hex: '#10b981', desc: 'Hardware ready & compile OK', class: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' },
                                        { name: 'Warning Alert', hex: '#f59e0b', desc: 'VRAM pressure & fallback mode', class: 'bg-amber-500/15 border-amber-500/30 text-amber-400' },
                                        { name: 'Destructive Error', hex: '#f43f5e', desc: 'Memory OOM & socket failure', class: 'bg-rose-500/15 border-rose-500/30 text-rose-400' },
                                        { name: 'Info Notice', hex: '#0284c7', desc: 'Daemon connecting on port', class: 'bg-sky-500/15 border-sky-500/30 text-sky-400' },
                                    ].map((stat, idx) => (
                                        <div key={idx} className={`p-4 rounded-xl border ${stat.class} space-y-2`}>
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold">{stat.name}</span>
                                                <span className="font-mono text-[10px] opacity-75">{stat.hex}</span>
                                            </div>
                                            <p className="text-[11px] opacity-85 leading-tight">{stat.desc}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
{selectedId === 'themestudio' && (
                        <div className="space-y-8">
                            {/* Live Theme Switcher */}
                            <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-5">
                                <div>
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                                        Live Theme Engine Switcher (4 Modes)
                                    </h3>
                                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                                        Click any theme card below to instantly shift the entire application runtime with zero reload.
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    {themeModes.map((m) => {
                                        const isCurrent = theme === m.id;
                                        return (
                                            <button
                                                key={m.id}
                                                onClick={() => {
                                                    setTheme(m.id);
                                                    toast.success(`Activated ${m.label} theme mode.`);
                                                }}
                                                className={`p-4 rounded-2xl border text-left transition-all space-y-2 group relative overflow-hidden ${isCurrent
                                                    ? 'bg-[var(--accent-color)]/10 border-[var(--accent-color)] shadow-md'
                                                    : 'bg-[var(--bg-primary)] border-[var(--border-color)] hover:border-[var(--accent-color)]/50'
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        {m.icon}
                                                        <span className="text-xs font-bold text-[var(--text-primary)]">{m.label}</span>
                                                    </div>
                                                    {isCurrent && (
                                                        <CheckCircle2 className="w-4 h-4 text-[var(--accent-color)]" />
                                                    )}
                                                </div>
                                                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{m.desc}</p>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Accent Color Palette Customizer */}
                            <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                                    Dynamic Accent Token Customizer
                                </h3>
                                <p className="text-xs text-[var(--text-muted)]">
                                    Select an accent hue to recolor buttons, active badges, and neon glowing borders:
                                </p>

                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-2">
                                    {accentOptions.map((acc, idx) => {
                                        const isSelected = darkAccent === acc.dark;
                                        return (
                                            <button
                                                key={idx}
                                                onClick={() => {
                                                    setDarkAccent(acc.dark);
                                                    setLightAccent(acc.light);
                                                    toast.info(`Accent updated: ${acc.label}`);
                                                }}
                                                className={`p-3 rounded-xl bg-[var(--bg-primary)] border text-left transition-all ${isSelected
                                                    ? 'border-[var(--accent-color)] shadow-sm'
                                                    : 'border-[var(--border-color)] hover:border-[var(--text-muted)]'
                                                    }`}
                                            >
                                                <div
                                                    className="w-full h-8 rounded-lg mb-2 shadow-inner"
                                                    style={{ backgroundColor: acc.dark }}
                                                />
                                                <p className="text-xs font-bold text-[var(--text-primary)] truncate">{acc.label}</p>
                                                <span className="font-mono text-[9px] text-[var(--text-muted)]">{acc.dark}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
</>;
}

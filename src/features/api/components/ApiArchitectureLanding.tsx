import { catalogPillars } from '../utils/catalogGroups';
import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useApiStore } from '../../../store/api/useApiStore';
import {
    Activity,
    ShieldCheck,
    ArrowRight,
    ArrowDown,
    Server,
    Network,
    ChevronRight,
    ZoomIn,
    ZoomOut,
    Maximize2,
    X,
    ExternalLink
} from 'lucide-react';
import { ApiEndpoint, HttpMethod } from '../types';

interface SubGroup {
    id: string;
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    endpoints: ApiEndpoint[];
}

interface PillarGroup {
    id: string;
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
    borderGlow: string;
    badge: string;
    subgroups: SubGroup[];
    totalEndpoints: number;
}

export const ApiArchitectureLanding: React.FC = () => {
    const { apiData, selectEndpoint } = useApiStore();

    // Canvas Pan & Zoom State (Mermaid.ai Dot-Grid Canvas)
    const [zoom, setZoom] = useState<number>(1);
    const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

    // Node Selection / Property Inspector (Mermaid.ai style)
    const [selectedPillarId, setSelectedPillarId] = useState<string | null>(null);

    const canvasContainerRef = useRef<HTMLDivElement>(null);

    // Flatten all endpoints
    const allEndpoints = useMemo(() => {
        return apiData.flatMap((g) => g.endpoints);
    }, [apiData]);

    const totalEndpointsCount = allEndpoints.length || 108;

    // Helper for method badge styling
    const getMethodBadgeClass = (method: HttpMethod) => {
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
                return 'text-[var(--text-muted)] bg-[var(--bg-tertiary)] border-[var(--border-color)]';
        }
    };

    /**
     * Map flat API data into the 5 Structured Architectural Pillars.
     */
    const pillars = useMemo<PillarGroup[]>(() => catalogPillars(apiData), [apiData]);

    const activePillar = useMemo(() => {
        return pillars.find((p) => p.id === selectedPillarId) || null;
    }, [pillars, selectedPillarId]);

    // Non-passive Mouse Wheel Listener for natural zoom (Mermaid.ai style)
    useEffect(() => {
        const el = canvasContainerRef.current;
        if (!el) return;

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            const factor = e.deltaY < 0 ? 1.08 : 0.92;
            setZoom((prev) => {
                const next = prev * factor;
                return Math.min(Math.max(next, 0.4), 2.5);
            });
        };

        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleWheel);
    }, []);

    // Drag-to-Pan Handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).tagName === 'BUTTON' || (e.target as HTMLElement).closest('button')) {
            return;
        }
        setIsDragging(true);
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        setPan({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        });
    };

    const handleMouseUp = () => setIsDragging(false);

    // Zoom Controls
    const zoomIn = () => setZoom((z) => Math.min(z + 0.15, 2.5));
    const zoomOut = () => setZoom((z) => Math.max(z - 0.15, 0.4));
    const resetCanvas = useCallback(() => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
    }, []);

    return (
        <div className="relative w-full h-full overflow-hidden bg-[var(--bg-primary)] select-none">
            {/* MERMAID.AI DOT-GRID CANVAS WORKSPACE */}
            <div
                ref={canvasContainerRef}
                className="w-full h-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
                style={{
                    backgroundImage: 'radial-gradient(var(--border-color) 1px, transparent 1px)',
                    backgroundSize: '24px 24px'
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
            >
                {/* TRANSFORMABLE DIAGRAM CANVAS */}
                <div
                    className="p-8 md:p-12 transition-transform duration-75 origin-center flex flex-col items-center max-w-5xl w-full space-y-5"
                    style={{
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                    }}
                >
                    {/* ── STAGE 01: CLIENT INGRESS GATEWAY ── */}
                    <div className="w-full max-w-xl p-4 rounded-2xl bg-[var(--bg-secondary)] border-2 border-indigo-500/50 shadow-lg shadow-indigo-500/5 flex items-center justify-between group hover:border-indigo-400 transition-all">
                        <div className="flex items-center gap-3.5">
                            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                                <Server className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-wider">
                                        Stage 01 Ingress
                                    </span>
                                    <span className="text-xs font-bold text-[var(--text-primary)]">
                                        Client Ingress Gateway
                                    </span>
                                </div>
                                <p className="text-[11px] font-mono text-[var(--text-secondary)]">
                                    Port 8000 REST Multiplexer & Native C-FFI Pointer Gateway
                                </p>
                            </div>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold">
                            TCP/FFI
                        </span>
                    </div>

                    {/* CONNECTOR ARROW 1 -> 2 */}
                    <div className="flex flex-col items-center -my-2 z-10">
                        <div className="w-0.5 h-6 bg-gradient-to-b from-indigo-500 to-emerald-500" />
                        <ArrowDown className="w-4 h-4 text-emerald-400 -mt-1" />
                    </div>

                    {/* ── STAGE 02: SECURITY BOUNDARY & JAIL ── */}
                    <div className="w-full max-w-xl p-4 rounded-2xl bg-[var(--bg-secondary)] border-2 border-emerald-500/50 shadow-lg shadow-emerald-500/5 flex items-center justify-between group hover:border-emerald-400 transition-all">
                        <div className="flex items-center gap-3.5">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                                <ShieldCheck className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider">
                                        Stage 02 Sandbox
                                    </span>
                                    <span className="text-xs font-bold text-[var(--text-primary)]">
                                        Security Boundary Guard & Workspace Jail
                                    </span>
                                </div>
                                <p className="text-[11px] font-mono text-[var(--text-secondary)]">
                                    Bearer token auth, rate-limits & canonical workspace sandbox confinement
                                </p>
                            </div>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                            ZERO-TRUST
                        </span>
                    </div>

                    {/* CONNECTOR ARROW 2 -> 3 */}
                    <div className="flex flex-col items-center -my-2 z-10">
                        <div className="w-0.5 h-6 bg-gradient-to-b from-emerald-500 to-[var(--accent-color)]" />
                        <ArrowDown className="w-4 h-4 text-[var(--accent-color)] -mt-1" />
                    </div>

                    {/* ── STAGE 03: 5 ARCHITECTURE PILLARS (BALANCED 16:9 CLUSTERS) ── */}
                    <div className="w-full p-5 rounded-3xl bg-[var(--bg-secondary)]/90 backdrop-blur-md border-2 border-[var(--border-color)] shadow-xl space-y-3">
                        <div className="flex items-center justify-between pb-2.5 border-b border-[var(--border-color)]">
                            <div className="flex items-center gap-2">
                                <Network className="w-4 h-4 text-[var(--accent-color)]" />
                                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                                    Stage 03: 5 Core Architecture Pillars
                                </span>
                            </div>
                            <span className="text-[11px] font-mono text-[var(--accent-color)] font-bold">
                                {totalEndpointsCount} Active APIs • Click any pillar to inspect
                            </span>
                        </div>

                        {/* Balanced 5 Pillars Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                            {pillars.map((pillar) => {
                                const PillarIcon = pillar.icon;
                                const isSelected = selectedPillarId === pillar.id;

                                return (
                                    <button
                                        key={pillar.id}
                                        type="button"
                                        onClick={() => setSelectedPillarId(isSelected ? null : pillar.id)}
                                        className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between gap-3 group relative overflow-hidden ${
                                            isSelected
                                                ? `${pillar.borderGlow} bg-[var(--bg-tertiary)] scale-[1.02]`
                                                : 'border-[var(--border-color)] bg-[var(--bg-primary)] hover:border-white/20'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div
                                                className="w-8 h-8 rounded-xl flex items-center justify-center"
                                                style={{ backgroundColor: `${pillar.accentColor}18`, color: pillar.accentColor }}
                                            >
                                                <PillarIcon className="w-4 h-4" />
                                            </div>
                                            <span
                                                className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full"
                                                style={{ backgroundColor: `${pillar.accentColor}20`, color: pillar.accentColor }}
                                            >
                                                {pillar.totalEndpoints}
                                            </span>
                                        </div>

                                        <div>
                                            <span className="text-xs font-bold block text-[var(--text-primary)] group-hover:text-[var(--accent-color)] transition-colors truncate">
                                                {pillar.title}
                                            </span>
                                            <span className="text-[9.5px] font-mono text-[var(--text-muted)] uppercase block truncate mt-0.5">
                                                {pillar.badge}
                                            </span>
                                        </div>

                                        <div className="pt-2 border-t border-[var(--border-color)] flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)]">
                                            <span>{pillar.subgroups.length} Groups</span>
                                            <ChevronRight className={`w-3 h-3 transition-transform ${isSelected ? 'rotate-90 text-[var(--accent-color)]' : ''}`} />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* CONNECTOR ARROW 3 -> 4 */}
                    <div className="flex flex-col items-center -my-2 z-10">
                        <div className="w-0.5 h-6 bg-gradient-to-b from-[var(--accent-color)] to-blue-500" />
                        <ArrowDown className="w-4 h-4 text-blue-400 -mt-1" />
                    </div>

                    {/* ── STAGE 04: RESPONSE SERIALIZATION ── */}
                    <div className="w-full max-w-xl p-4 rounded-2xl bg-[var(--bg-secondary)] border-2 border-blue-500/50 shadow-lg shadow-blue-500/5 flex items-center justify-between group hover:border-blue-400 transition-all">
                        <div className="flex items-center gap-3.5">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                                <ArrowRight className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono font-bold text-blue-400 uppercase tracking-wider">
                                        Stage 04 Protocol
                                    </span>
                                    <span className="text-xs font-bold text-[var(--text-primary)]">
                                        Response Serialization Pipeline
                                    </span>
                                </div>
                                <p className="text-[11px] font-mono text-[var(--text-secondary)]">
                                    Encodes buffers into Server-Sent Events (SSE chunk stream) or atomic JSON payloads
                                </p>
                            </div>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold">
                            SSE/JSON
                        </span>
                    </div>

                    {/* CONNECTOR ARROW 4 -> 5 */}
                    <div className="flex flex-col items-center -my-2 z-10">
                        <div className="w-0.5 h-6 bg-gradient-to-b from-blue-500 to-cyan-500" />
                        <ArrowDown className="w-4 h-4 text-cyan-400 -mt-1" />
                    </div>

                    {/* ── STAGE 05: TELEMETRY & RING-BUFFER ── */}
                    <div className="w-full max-w-xl p-4 rounded-2xl bg-[var(--bg-secondary)] border-2 border-cyan-500/50 shadow-lg shadow-cyan-500/5 flex items-center justify-between group hover:border-cyan-400 transition-all">
                        <div className="flex items-center gap-3.5">
                            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                                <Activity className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-wider">
                                        Stage 05 Telemetry
                                    </span>
                                    <span className="text-xs font-bold text-[var(--text-primary)]">
                                        Telemetry Bus & Audit Ring-Buffer
                                    </span>
                                </div>
                                <p className="text-[11px] font-mono text-[var(--text-secondary)]">
                                    Live token profiling, execution metrics, and causal audit trail logging
                                </p>
                            </div>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold">
                            EVENT BUS
                        </span>
                    </div>
                </div>
            </div>

            {/* MERMAID.AI STYLE SLIDE-OVER PROPERTY INSPECTOR (When a pillar is clicked) */}
            {activePillar && (
                <div className="absolute top-4 right-4 bottom-16 w-80 sm:w-96 rounded-2xl bg-[var(--bg-secondary)]/95 backdrop-blur-xl border border-[var(--border-color)] shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-4 duration-150 z-30">
                    {/* Inspector Header */}
                    <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between gap-3 bg-[var(--bg-tertiary)]/50">
                        <div className="flex items-center gap-2 min-w-0">
                            <div
                                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                                style={{ backgroundColor: `${activePillar.accentColor}25`, color: activePillar.accentColor }}
                            >
                                <activePillar.icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-xs font-bold text-[var(--text-primary)] truncate">
                                    {activePillar.title}
                                </h3>
                                <span className="text-[10px] font-mono text-[var(--text-muted)]">
                                    {activePillar.totalEndpoints} Endpoints • {activePillar.subgroups.length} Subsystems
                                </span>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => setSelectedPillarId(null)}
                            className="p-1 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer shrink-0"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Subsystems & Endpoints List */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
                        {activePillar.subgroups.map((sub) => {
                            const SubIcon = sub.icon;
                            return (
                                <div key={sub.id} className="p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <SubIcon className="w-3.5 h-3.5 text-[var(--accent-color)] shrink-0" />
                                            <span className="text-xs font-bold text-[var(--text-primary)] truncate">
                                                {sub.title}
                                            </span>
                                        </div>
                                        <span className="text-[10px] font-mono text-[var(--text-muted)] font-bold">
                                            {sub.endpoints.length}
                                        </span>
                                    </div>

                                    {/* Endpoint items */}
                                    <div className="space-y-1">
                                        {sub.endpoints.map((ep) => (
                                            <button
                                                key={`${ep.method}-${ep.path}`}
                                                type="button"
                                                onClick={() => selectEndpoint(ep)}
                                                className="w-full flex items-center justify-between p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-left group transition-colors cursor-pointer"
                                            >
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <span className={`text-[8px] font-bold px-1 py-0.2 rounded border font-mono ${getMethodBadgeClass(ep.method)}`}>
                                                        {ep.method}
                                                    </span>
                                                    <span className="text-[11px] font-mono text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] truncate">
                                                        {ep.path}
                                                    </span>
                                                </div>
                                                <ExternalLink className="w-3 h-3 text-[var(--text-muted)] group-hover:text-[var(--accent-color)] shrink-0 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* MERMAID.AI STYLE FLOATING BOTTOM-RIGHT CONTROLS PILL */}
            <div className="absolute bottom-5 right-5 z-20 flex items-center gap-1.5 p-1.5 rounded-2xl bg-[var(--bg-secondary)]/90 backdrop-blur-md border border-[var(--border-color)] shadow-xl">
                <button
                    type="button"
                    onClick={zoomIn}
                    className="p-1.5 rounded-xl hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                    title="Zoom In (or use mouse scroll)"
                >
                    <ZoomIn className="w-4 h-4" />
                </button>
                <button
                    type="button"
                    onClick={zoomOut}
                    className="p-1.5 rounded-xl hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                    title="Zoom Out (or use mouse scroll)"
                >
                    <ZoomOut className="w-4 h-4" />
                </button>
                <button
                    type="button"
                    onClick={resetCanvas}
                    className="p-1.5 rounded-xl hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                    title="Fit to Screen"
                >
                    <Maximize2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

export default ApiArchitectureLanding;

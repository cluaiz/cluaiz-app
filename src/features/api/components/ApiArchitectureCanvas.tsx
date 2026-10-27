import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Monitor, Network, ShieldCheck, Brain, Layers, Wrench, Folder, Boxes, SlidersHorizontal,
    Database, Cpu, ZoomIn, ZoomOut, Maximize2, List, Map as MapIcon } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import type { ArchitectureGraph, ArchitectureNode } from '../utils/architectureGraph';

interface Props {
    graph: ArchitectureGraph; selected: string | null; highlighted: string[];
    modelLabel: string; onSelect: (id: string) => void;
}
const WIDTH = 238, HEIGHT = 124, ROW = 152, MIN_ZOOM = 0.2, MAX_ZOOM = 2.5;
const icons: Record<string, typeof Monitor> = { client: Monitor, transport: Network, guard: ShieldCheck,
    inference: Brain, memory: Layers, tools: Wrench, files: Folder, models: Boxes, system: SlidersHorizontal,
    runtime: Cpu, saved: Database };

export function ApiArchitectureCanvas({ graph, selected, highlighted, modelLabel, onSelect }: Props) {
    const stage = useRef<HTMLDivElement>(null);
    const drag = useRef<{ id: number; x: number; y: number; left: number; top: number } | null>(null);
    const moved = useRef(false);
    const [size, setSize] = useState({ width: 0, height: 0 });
    const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
    const [mode, setMode] = useState<'map' | 'list' | null>(null);
    const list = mode === 'list' || (mode === null && size.width > 0 && size.width < 640);
    const layout = useMemo(() => {
        const domains = graph.nodes.filter(node => node.groups.length);
        const height = Math.max(740, domains.length * ROW + 88);
        const positions = new Map<string, { x: number; y: number }>([
            ['client', { x: 28, y: height / 2 - HEIGHT / 2 }],
            ['transport', { x: 310, y: height / 2 - 170 }],
            ['guard', { x: 310, y: height / 2 + 38 }],
            ['runtime', { x: 930, y: height * 0.2 }],
            ['saved', { x: 930, y: height * 0.64 }],
        ]);
        domains.forEach((node, i) => positions.set(node.id, { x: 620, y: 54 + i * ROW }));
        return { positions, width: 1200, height };
    }, [graph]);
    const fit = useCallback(() => {
        const scale = Math.max(MIN_ZOOM, Math.min((size.width - 32) / layout.width, (size.height - 32) / layout.height, 1));
        setView({ x: (size.width - layout.width * scale) / 2, y: (size.height - layout.height * scale) / 2, scale });
        moved.current = false;
    }, [size, layout]);

    useEffect(() => {
        const element = stage.current;
        if (!element) return;
        const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
        observer.observe(element);
        return () => observer.disconnect();
    }, []);
    useEffect(() => { if (!moved.current && size.width && size.height) fit(); }, [fit, size]);

    const zoom = useCallback((factor: number, x = size.width / 2, y = size.height / 2) => {
        moved.current = true;
        setView(previous => {
            const scale = Math.max(MIN_ZOOM, Math.min(previous.scale * factor, MAX_ZOOM));
            return { x: x - (x - previous.x) * scale / previous.scale,
                y: y - (y - previous.y) * scale / previous.scale, scale };
        });
    }, [size]);
    useEffect(() => {
        const element = stage.current;
        if (!element || list) return;
        const wheel = (event: WheelEvent) => {
            event.preventDefault();
            const bounds = element.getBoundingClientRect();
            zoom(event.deltaY < 0 ? 1.1 : 1 / 1.1, event.clientX - bounds.left, event.clientY - bounds.top);
        };
        element.addEventListener('wheel', wheel, { passive: false });
        return () => element.removeEventListener('wheel', wheel);
    }, [zoom, list]);

    function select(node: ArchitectureNode) { onSelect(node.id); }
    function focusNode(id: string) {
        const point = layout.positions.get(id);
        if (!point) return;
        setView(previous => {
            const x = point.x * previous.scale + previous.x, y = point.y * previous.scale + previous.y;
            if (x >= 0 && y >= 0 && x + WIDTH * previous.scale <= size.width && y + HEIGHT * previous.scale <= size.height) return previous;
            moved.current = true;
            return { ...previous, x: size.width / 2 - (point.x + WIDTH / 2) * previous.scale,
                y: size.height / 2 - (point.y + HEIGHT / 2) * previous.scale };
        });
    }
    const nodeButton = (node: ArchitectureNode, inList: boolean) => {
        const Icon = icons[node.id] || Network;
        const active = selected === node.id || highlighted.includes(node.id);
        const position = layout.positions.get(node.id);
        const count = node.groups.reduce((sum, group) => sum + group.endpoints.length, 0);
        return <button key={node.id} id={`architecture-node-${node.id}`} type="button"
            aria-label={`${node.title}${count ? `, ${count} APIs` : ''}`} aria-pressed={selected === node.id}
            onClick={() => select(node)} onFocus={() => { if (!inList) focusNode(node.id); }}
            className={`${inList ? 'w-full min-h-[124px]' : 'absolute'} rounded-xl border p-4 text-left shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)] hover:bg-[var(--bg-tertiary)]`}
            style={{ ...(inList ? {} : { left: position?.x, top: position?.y, width: WIDTH, height: HEIGHT }),
                borderColor: active ? 'var(--accent-color)' : 'var(--border-color)', background: 'var(--bg-secondary)' }}>
            <span className="flex items-center justify-between gap-3">
                <Icon size={19} className="text-[var(--accent-color)] shrink-0" />
                <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{count ? `${count} APIs` : node.lane}</span>
            </span>
            <span className="mt-2 block text-sm font-semibold text-[var(--text-primary)]">{node.title}</span>
            <span className="mt-1 block text-[11px] leading-4 text-[var(--text-secondary)] line-clamp-2 break-words">
                {node.id === 'runtime' ? modelLabel : node.subtitle}
            </span>
        </button>;
    };

    return <section aria-label="Interactive API architecture" className="relative flex min-h-[340px] min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)]">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--border-color)] px-3 py-2">
            <span className="text-xs text-[var(--text-secondary)]">{list ? 'Readable architecture list' : 'Client → Engine → model / saved state'}</span>
            <Button variant="ghost" size="sm" onClick={() => setMode(list ? 'map' : 'list')}>
                {list ? <MapIcon size={14} /> : <List size={14} />}{list ? 'Map view' : 'List view'}
            </Button>
        </div>
        <div ref={stage} className={`relative min-h-0 flex-1 ${list ? 'overflow-y-auto p-3' : 'overflow-hidden cursor-grab active:cursor-grabbing'}`}
            style={list ? undefined : { touchAction: 'none', backgroundImage: 'radial-gradient(var(--border-color) 1px, transparent 1px)', backgroundSize: '24px 24px' }}
            onPointerDown={event => {
                if (list || event.button !== 0 || (event.target as Element).closest('button, input, a, select, textarea')) return;
                drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: view.x, top: view.y };
                event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={event => {
                const start = drag.current;
                if (!start || start.id !== event.pointerId) return;
                moved.current = true;
                setView(previous => ({ ...previous, x: start.left + event.clientX - start.x, y: start.top + event.clientY - start.y }));
            }}
            onPointerUp={event => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
                drag.current = null;
            }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}>
            {list ? <div className="grid gap-3 sm:grid-cols-2">{graph.nodes.map(node => nodeButton(node, true))}</div>
                : <div className="absolute left-0 top-0 origin-top-left" style={{ width: layout.width, height: layout.height,
                    transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}>
                    <svg width={layout.width} height={layout.height} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-visible">
                        <defs><marker id="architecture-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto-start-reverse"><path d="M0 0L7 3.5L0 7" fill="context-stroke" /></marker></defs>
                        {graph.edges.map(edge => {
                            const a = layout.positions.get(edge.from), b = layout.positions.get(edge.to);
                            if (!a || !b) return null;
                            const vertical = a.x === b.x;
                            const sx = a.x + (vertical ? WIDTH / 2 : WIDTH), sy = a.y + (vertical ? HEIGHT : HEIGHT / 2);
                            const tx = b.x + (vertical ? WIDTH / 2 : 0), ty = b.y + (vertical ? 0 : HEIGHT / 2);
                            const path = vertical ? `M${sx},${sy} C${sx},${(sy + ty) / 2} ${tx},${(sy + ty) / 2} ${tx},${ty}`
                                : `M${sx},${sy} C${(sx + tx) / 2},${sy} ${(sx + tx) / 2},${ty} ${tx},${ty}`;
                            const active = highlighted.includes(edge.from) && highlighted.includes(edge.to);
                            return <g key={`${edge.from}-${edge.to}`}><title>{edge.label}</title><path d={path} fill="none"
                                stroke={active ? 'var(--accent-color)' : 'var(--border-color)'} strokeWidth={active ? 2.5 : 1.5}
                                markerStart="url(#architecture-arrow)" markerEnd="url(#architecture-arrow)" /></g>;
                        })}
                    </svg>
                    <span className="absolute left-7 top-3 text-[11px] font-semibold tracking-widest text-[var(--text-muted)]">CLIENTS</span>
                    <span className="absolute left-[620px] top-3 text-[11px] font-semibold tracking-widest text-[var(--text-muted)]">ENGINE DOMAINS</span>
                    <span className="absolute left-[930px] top-3 text-[11px] font-semibold tracking-widest text-[var(--text-muted)]">RUNTIME / STATE</span>
                    {graph.nodes.map(node => nodeButton(node, false))}
                </div>}
        </div>
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[var(--border-color)] px-3 py-2">
            <span className="text-[10px] text-[var(--text-muted)]">Explanation map · no requests executed</span>
            {!list && <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" aria-label="Zoom out" onClick={() => zoom(1 / 1.2)}><ZoomOut size={15} /></Button>
                <span className="min-w-9 text-center text-[10px] tabular-nums text-[var(--text-muted)]">{Math.round(view.scale * 100)}%</span>
                <Button variant="ghost" size="icon" aria-label="Zoom in" onClick={() => zoom(1.2)}><ZoomIn size={15} /></Button>
                <Button variant="ghost" size="icon" aria-label="Fit architecture to view" onClick={fit}><Maximize2 size={15} /></Button>
            </div>}
        </div>
    </section>;
}

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Boxes, ChevronDown, ChevronRight, Cpu, Crosshair, Database, Folder, Layers, Maximize2, Network, ShieldCheck, SlidersHorizontal, Wrench, X, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { ApiArchitectureInspector } from './ApiArchitectureInspector';
import { architectureEdgePath, architectureLayout } from '../utils/architectureLayout';
import { architectureTransport, type ArchitectureView } from '../utils/architectureGraph';
import { useArchitectureViewport } from '../hooks/useArchitectureViewport';
import type { ApiEndpoint, InstalledModel } from '../types';

interface Props {
    view: ArchitectureView; highlighted: string[]; modelLabel: string; toolbar: React.ReactNode; ready: boolean;
    selectedModel: string; model?: InstalledModel; connection: string;
    onNavigate: (path: string[]) => void; onOpen: (endpoint: ApiEndpoint, docs: boolean) => void;
    onCollapse: (path: string[]) => void;
}
const icons: Record<string, typeof Network> = { transport: Network, guard: ShieldCheck, memory: Layers,
    tools: Wrench, files: Folder, models: Boxes, system: SlidersHorizontal, runtime: Cpu, saved: Database };

export function ApiArchitectureCanvas({ view, highlighted, modelLabel, toolbar, selectedModel, model, connection, onNavigate, onOpen, onCollapse, ready }: Props) {
    const process = useRef<HTMLDivElement>(null);
    const [processHeights, setProcessHeights] = useState<Record<string, number>>({});
    const processId = view.items.find(item => item.kind === 'detail')?.id;
    useEffect(() => {
        const element = process.current;
        if (!element || !processId) return;
        const observer = new ResizeObserver(() => {
            const height = Math.ceil(element.offsetHeight);
            setProcessHeights(previous => previous[processId] === height ? previous : { ...previous, [processId]: height });
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, [processId]);
    const layout = useMemo(() => architectureLayout(view, processHeights), [view, processHeights]);
    const viewport = useArchitectureViewport(layout.bounds, layout.frame, ready, Boolean(view.focusId));
    const engaged = Boolean(view.path.length || view.matches !== undefined || highlighted.length);
    const byId = useMemo(() => new Map(view.items.map(item => [item.id, item])), [view]);
    return <section ref={viewport.stage} aria-label="Interactive API architecture"
        className="relative h-full min-h-0 w-full cursor-default overflow-hidden bg-[var(--bg-primary)]"
        style={{ touchAction: 'none', backgroundImage: 'radial-gradient(var(--border-color) 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
        <div ref={viewport.world} className="absolute left-0 top-0 origin-top-left" data-architecture-world
            style={{ width: layout.bounds.width, height: layout.bounds.height, willChange: 'transform' }}>
            <svg width={layout.bounds.width} height={layout.bounds.height} className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden="true">
                <defs><marker id="architecture-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8" fill="context-stroke" /></marker></defs>
                {view.edges.map(edge => {
                    const a = layout.positions.get(edge.from), b = layout.positions.get(edge.to); if (!a || !b) return null;
                    const active = byId.get(edge.from)?.active && byId.get(edge.to)?.active;
                    return <g key={edge.from + ':' + edge.to} opacity={engaged && !active ? 0.18 : 0.75}><title>{edge.label}</title><path d={architectureEdgePath(a, b)} fill="none"
                        stroke={engaged && active ? 'var(--accent-color)' : 'var(--text-muted)'} strokeWidth="1.4" markerEnd="url(#architecture-arrow)" style={{ pointerEvents: 'stroke' }} />
                        {view.path.length > 0 && a.x !== b.x && <text x={(a.x + a.width + b.x) / 2} y={(a.y + a.height / 2 + b.y + b.height / 2) / 2 - 10}
                            fill="var(--text-secondary)" fontSize="10" textAnchor="middle">{edge.label.length > 22 ? edge.label.slice(0, 21) + '…' : edge.label}</text>}
                    </g>;
                })}
            </svg>
            {view.items.map(item => {
                const box = layout.positions.get(item.id)!;
                const Icon = icons[item.owner.id] || Network;
                const active = item.active !== false, count = item.owner.groups.reduce((n, group) => n + group.endpoints.length, 0);
                const title = item.title;
                const expanded = view.items.some(child => child.parentId === item.id);
                return <div key={item.id} ref={item.kind === 'detail' ? process : undefined} data-architecture-item={item.id} data-architecture-active={active} data-architecture-card={item.kind}
                    className={'absolute flex flex-col transition-opacity duration-150 motion-reduce:transition-none ' + (item.kind === 'detail' ? '' : 'rounded-xl border bg-[var(--bg-secondary)] shadow-sm ') + (active ? 'opacity-100' : 'opacity-40 hover:opacity-100 focus-within:opacity-100')}
                    style={{ left: box.x, top: box.y, width: box.width, height: item.kind === 'detail' ? 'auto' : box.height,
                        borderColor: engaged && active ? 'var(--accent-color)' : 'var(--border-color)' }}>
                    {item.kind === 'detail' ? <>
                        <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-3">
                            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
                            <Button size="icon" variant="ghost" aria-label={'Close ' + title} onClick={() => onCollapse(item.path)}><X size={14} /></Button>
                        </div>
                        <ApiArchitectureInspector item={item} model={model} selectedModel={selectedModel} connection={connection} onOpen={onOpen} />
                    </> : <button type="button" data-architecture-node={item.owner.id} data-architecture-kind={item.kind}
                        aria-label={'Expand ' + title} aria-expanded={expanded} onClick={() => onNavigate(item.path)}
                        onFocus={event => { if (event.currentTarget.matches(':focus-visible')) viewport.reveal(box); }}
                        className="flex h-full w-full cursor-pointer flex-col rounded-xl p-4 text-left outline-none transition-colors hover:bg-[var(--bg-tertiary)] focus-visible:ring-2 focus-visible:ring-[var(--accent-color)]">
                        <span className="mb-2 flex w-full items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                            <Icon size={17} className="text-[var(--accent-color)]" />
                            {item.matchCount ? item.matchCount + ' matches' : item.endpoint ? architectureTransport(item.endpoint) : item.kind === 'group' ? 'API group' : count ? count + ' APIs' : item.owner.lane}
                            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        </span>
                        <span className={'block w-full truncate text-sm font-semibold text-[var(--text-primary)] ' + (item.kind === 'api' ? 'font-mono' : '')} title={title}>{title}</span>
                        <span className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-secondary)]">{item.owner.id === 'runtime' && item.kind === 'component' ? modelLabel : item.subtitle}</span>
                    </button>}
                </div>;
            })}
        </div>
        <div className="absolute inset-x-0 top-0 z-10 flex flex-wrap items-center gap-1.5 border-b border-[var(--border-color)] bg-[var(--bg-primary)]/95 px-5 py-2 shadow-sm" data-architecture-interactive data-architecture-toolbar>
            {toolbar}
        </div>
        <div className="absolute bottom-3 right-3 z-10 flex items-center gap-0.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] p-1 shadow-sm" data-architecture-interactive>
            <Button size="icon" variant="ghost" aria-label="Zoom out" onClick={() => viewport.zoom(1 / 1.2)}><ZoomOut size={15} /></Button>
            <span ref={viewport.label} aria-label="Graph zoom" className="min-w-9 text-center text-[10px] text-[var(--text-secondary)]">100%</span>
            <Button size="icon" variant="ghost" aria-label="Zoom in" onClick={() => viewport.zoom(1.2)}><ZoomIn size={15} /></Button>
            <Button size="icon" variant="ghost" aria-label="Fit visible graph" onClick={() => viewport.fit(true)}><Maximize2 size={15} /></Button>
            <Button size="icon" variant="ghost" aria-label="Focus selected graph node" disabled={!view.focusId} onClick={() => viewport.fit(false)}><Crosshair size={15} /></Button>
        </div>
        {view.matches === 0 && <p role="status" className="absolute left-6 top-24 text-sm text-[var(--text-secondary)]">No APIs match. The graph is preserved.</p>}
        <span className="pointer-events-none absolute bottom-3 left-3 max-w-[50%] text-[10px] text-[var(--text-muted)]">Click to expand · drag to move · explanation, not live activity</span>
    </section>;
}

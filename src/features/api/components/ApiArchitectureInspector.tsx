import React from 'react';
import { BookOpen, ChevronRight, Info, X } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import type { ApiEndpoint, InstalledModel } from '../types';
import { architectureEndpointKey, architectureSearch, architectureTransport, type ArchitectureNode } from '../utils/architectureGraph';

interface Props {
    node: ArchitectureNode; query: string; selectedModel: string; model?: InstalledModel;
    connection: string; onClose: () => void; onOpen: (endpoint: ApiEndpoint, docs: boolean) => void;
}

export function ApiArchitectureInspector({ node, query, selectedModel, model, connection, onClose, onOpen }: Props) {
    const groups = architectureSearch(node, query);
    const count = groups.reduce((sum, group) => sum + group.endpoints.length, 0);
    const fields = [ ['Input', node.input], ['Output', node.output], ['State & storage', node.state], ['Model involvement', node.model] ];
    return <aside aria-label="Architecture details" className="flex min-h-0 w-full shrink-0 flex-col overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] lg:w-[350px] max-lg:max-h-[48%]">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border-color)] p-4">
            <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Architecture / {node.lane}</p>
                <h2 className="mt-1 break-words text-base font-semibold text-[var(--text-primary)]">{node.title}</h2>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">{node.subtitle}</p>
            </div>
            <Button variant="ghost" size="icon" aria-label="Close architecture details" onClick={onClose}><X size={16} /></Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-5">
            <section aria-label="How this component works">
                <h3 className="text-xs font-semibold text-[var(--text-primary)]">How it works</h3>
                <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{node.purpose}</p>
                <dl className="mt-4 space-y-3">{fields.map(([label, value]) => <div key={label}>
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{label}</dt>
                    <dd className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{value}</dd>
                </div>)}</dl>
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] p-3">
                    <Info size={14} className="mt-0.5 shrink-0 text-[var(--accent-color)]" />
                    <p className="text-[11px] leading-5 text-[var(--text-secondary)]">{node.caution}</p>
                </div>
            </section>
            {node.id === 'transport' && <section className="rounded-lg border border-[var(--border-color)] p-3">
                <h3 className="text-xs font-semibold text-[var(--text-primary)]">Configured transport</h3>
                <p className="mt-2 break-words text-xs text-[var(--text-secondary)]">{connection}</p>
                <p className="mt-2 text-[11px] text-[var(--text-muted)]">Configuration only · no live connection check from this page</p>
            </section>}
            {node.id === 'runtime' && <section className="rounded-lg border border-[var(--border-color)] p-3" aria-label="Explorer model selection">
                <h3 className="text-xs font-semibold text-[var(--text-primary)]">Explorer selection</h3>
                <p className="mt-2 break-all text-xs text-[var(--text-secondary)]">{selectedModel || 'No model selected'}</p>
                {model ? <>
                    <p className="mt-2 text-[11px] text-[var(--text-secondary)]">Inventory snapshot format: {model.format_type || 'Not reported'}</p>
                    <p className="mt-2 break-words text-[11px] text-[var(--text-secondary)]">Reported tasks: {model.supported_tasks?.join(', ') || 'Not reported'}</p>
                </> : <p className="mt-2 text-[11px] text-[var(--text-muted)]">No matching entry in the current Explorer inventory snapshot.</p>}
                <p className="mt-3 text-[11px] leading-5 text-[var(--text-muted)]">Loaded model, device and actual context: not measured here. Inventory metadata is not a compatibility test or a live connection result.</p>
            </section>}
            <section aria-label="Related APIs">
                <h3 className="flex justify-between gap-3 text-xs font-semibold text-[var(--text-primary)]">
                    <span>Related APIs</span><span className="tabular-nums text-[var(--text-muted)]">{count}</span>
                </h3>
                <p className="mt-2 text-[11px] leading-5 text-[var(--text-muted)]">Open a payload or its full documentation and examples. Nothing executes until you deliberately send a request.</p>
                {!groups.length && <p className="mt-3 text-xs text-[var(--text-secondary)]">{query.trim() ? 'No APIs match this search.' : 'This is a system relationship. Choose an Engine domain to inspect its APIs.'}</p>}
                <div className="mt-3 space-y-4">{groups.map(group => <div key={group.id}>
                    <h4 className="mb-2 text-[11px] font-semibold text-[var(--text-secondary)]">{group.title} · {group.endpoints.length}</h4>
                    <div className="space-y-2">{group.endpoints.map(endpoint => <div key={architectureEndpointKey(endpoint)}
                        className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] p-3">
                        <p className="text-[10px] text-[var(--text-muted)]">{architectureTransport(endpoint)}</p>
                        <p className="mt-1 break-all font-mono text-[11px] text-[var(--text-primary)]">{endpoint.method} {endpoint.path}</p>
                        <p className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">{endpoint.desc}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                            <Button size="sm" variant="ghost" onClick={() => onOpen(endpoint, false)} aria-label={`Open payload for ${endpoint.method} ${endpoint.path}`}>Payload <ChevronRight size={12} /></Button>
                            <Button size="sm" variant="ghost" onClick={() => onOpen(endpoint, true)} aria-label={`Read documentation for ${endpoint.method} ${endpoint.path}`}><BookOpen size={12} /> Documentation</Button>
                        </div>
                    </div>)}</div>
                </div>)}</div>
            </section>
        </div>
    </aside>;
}

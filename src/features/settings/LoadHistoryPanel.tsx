import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { errorMessage } from '../../api/client/errors';
import { modelsApi } from '../../api/engine/models/models.api';
import type { LoadHistoryRecord } from '../../api/engine/models/models.types';

interface LoadHistoryPanelProps {
    modelId?: string;
    limit?: number;
    autoLoad?: boolean;
}

const formatMs = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`);

/** Reusable viewer for `models.load_history` (all models or filtered to one model). */
export function LoadHistoryPanel({ modelId, limit = 30, autoLoad = false }: LoadHistoryPanelProps) {
    const [records, setRecords] = useState<LoadHistoryRecord[] | null>(null);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const load = useCallback((signal?: AbortSignal) => {
        setLoading(true);
        setError('');
        return modelsApi.readLoadHistory({ model: modelId, limit }, signal)
            .then(page => {
                if (signal?.aborted) return;
                setRecords([...page.records].reverse());
                setTotal(page.total);
            })
            .catch(err => {
                if (!signal?.aborted) setError(errorMessage(err));
            })
            .finally(() => {
                if (!signal?.aborted) setLoading(false);
            });
    }, [modelId, limit]);

    useEffect(() => {
        if (!autoLoad) return;
        const controller = new AbortController();
        void load(controller.signal);
        return () => controller.abort();
    }, [autoLoad, load]);

    return (
        <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-[var(--text-secondary)]">
                    {records
                        ? `Showing ${records.length} of ${total} recorded chat-model loads, refusals, failures, and unloads.`
                        : 'Placement, VRAM planned/taken, retry attempts, and wall time from Engine load_history.'}
                </p>
                <Button size="sm" variant="outline" disabled={loading} onClick={() => void load()}>
                    <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                    <span>{records ? 'Refresh' : 'Show'}</span>
                </Button>
            </div>
            {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
            {records && records.length === 0 && (
                <p className="text-xs text-[var(--text-muted)]">No load history recorded{modelId ? ` for ${modelId}` : ''} yet.</p>
            )}
            {records && records.length > 0 && (
                <div className="max-h-80 overflow-y-auto custom-scrollbar space-y-1.5">
                    {records.map(record => (
                        <div key={record.seq} className="rounded-lg border border-[var(--border-color)]/60 bg-[var(--bg-primary)]/40 px-3 py-2 text-xs space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant={record.outcome === 'ok' ? 'secondary' : 'destructive'}>
                                    {record.action ?? 'load'} · {record.outcome ?? 'ok'}
                                </Badge>
                                <span className="font-mono font-semibold text-[var(--text-primary)]">{record.model}</span>
                                {record.placement && <span className="font-mono text-[var(--text-secondary)]">{record.placement}</span>}
                                {record.attempts && record.attempts > 1 && (
                                    <Badge variant="outline">{record.attempts} attempts</Badge>
                                )}
                                {record.cause && record.cause !== 'requested' && (
                                    <Badge variant="outline">{record.cause}</Badge>
                                )}
                                <span className="ml-auto font-mono text-[11px] text-[var(--text-muted)]">{formatMs(record.ms)}</span>
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[11px] text-[var(--text-muted)]">
                                <span>#{record.seq}</span>
                                <span>{new Date(record.at).toLocaleString()}</span>
                                {record.n_ctx !== undefined && <span>ctx {record.n_ctx}</span>}
                                {record.n_gpu_layers !== undefined && <span>gpu_layers {record.n_gpu_layers}</span>}
                                {record.n_cpu_moe ? <span>cpu_moe {record.n_cpu_moe}</span> : null}
                                {record.vram_planned_gb !== undefined && <span>vram plan {record.vram_planned_gb.toFixed(2)} GB</span>}
                                {record.vram_taken_gb !== undefined && <span>vram taken {record.vram_taken_gb.toFixed(2)} GB</span>}
                            </div>
                            {record.error && (
                                <p className="font-mono text-[11px] text-amber-400 break-words">{record.error}</p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

import { useEffect, useRef, useState } from 'react';
import { Loader2, Play } from 'lucide-react';
import { InstalledModelDetail } from '../../store/engine/useEngineStore';
import { modelsApi } from '../../api/engine/models/models.api';
import { errorMessage } from '../../api/client/errors';
import { toast } from '../../components/ui/toast';

interface ModelInfoCardProps {
    model: InstalledModelDetail;
    onInspect: () => void;
    canLoad?: boolean;
}

export function ModelInfoCard({ model, onInspect, canLoad = false }: ModelInfoCardProps) {
    const [loadingModel, setLoadingModel] = useState(false);
    const [loadPercent, setLoadPercent] = useState<number | undefined>(undefined);
    const [loadMessage, setLoadMessage] = useState<string>('');
    const loadAbort = useRef<AbortController | null>(null);

    useEffect(() => {
        return () => { loadAbort.current?.abort(); loadAbort.current = null; };
    }, [model?.id]);

    if (!model) return null;

    const handleLoadModel = async () => {
        if (loadingModel) return;
        loadAbort.current?.abort();
        const controller = new AbortController();
        loadAbort.current = controller;
        setLoadingModel(true);
        setLoadPercent(undefined);
        setLoadMessage('Starting model load…');
        try {
            const res = await modelsApi.loadModel(model.id, controller.signal, task => {
                if (controller.signal.aborted) return;
                if (task.progress?.unit === 'percent') setLoadPercent(task.progress.done);
                const latestMsg = typeof task.latestEvent?.message === 'string' ? task.latestEvent.message : undefined;
                if (latestMsg) setLoadMessage(latestMsg);
                else if (task.progress?.message) setLoadMessage(task.progress.message);
            });
            if (!controller.signal.aborted) {
                setLoadMessage(`Loaded in ${(res.loaded_ms / 1000).toFixed(2)}s`);
                toast.success(`Loaded ${model.id} in ${(res.loaded_ms / 1000).toFixed(2)}s`);
            }
        } catch (err) {
            if (!controller.signal.aborted) {
                const msg = errorMessage(err);
                setLoadMessage(msg);
                toast.error(msg);
            }
        } finally {
            if (loadAbort.current === controller) {
                loadAbort.current = null;
                setLoadingModel(false);
            }
        }
    };

    const meta = model.metadata || {};
    const format = (model.format_type || 'gguf').toUpperCase();
    const quant = meta.quantization || 'Standard';
    const bitDepth = meta.bit_depth || 'N/A';
    const params = meta.parameters || 'Unknown';
    const tasks = Array.isArray(model.supported_tasks) ? model.supported_tasks : [];

    let contextLabel = 'Context Window';
    let context = meta.context_window || 'Unknown';

    if (model.category === 'audio' || tasks.includes('speech_to_text')) {
        contextLabel = 'Audio Window';
        if (!meta.context_window || meta.context_window === 'Unknown') {
            context = '30s Max';
        }
    } else if (model.category === 'vision' && (!meta.context_window || meta.context_window === 'Unknown')) {
        contextLabel = 'Vision Window';
        context = '224×224 (Images)';
    }

    const hfRepo = model.huggingface_repo;

    return (
        <div className="w-full mt-2 p-3.5 bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl space-y-2.5 transition-all">
            {/* Top row: Format badge, model ID, HuggingFace icon, and Inspect Files & Header Button */}
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]/50">
                <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border bg-[var(--bg-tertiary)] text-[var(--text-primary)] border-[var(--border-color)]">
                        {format}
                    </span>
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                        {model.id}
                    </span>
                    {hfRepo && (
                        <a
                            href={`https://huggingface.co/${hfRepo}`}
                            target="_blank"
                            rel="noreferrer"
                            title={`View on HuggingFace Hub (${hfRepo})`}
                            className="inline-flex items-center justify-center w-6 h-6 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs hover:scale-110 transition-transform"
                        >
                            🤗
                        </a>
                    )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {canLoad && (
                        <button
                            type="button"
                            disabled={loadingModel}
                            onClick={(e) => {
                                e.stopPropagation();
                                void handleLoadModel();
                            }}
                            className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-xs font-semibold text-emerald-400 transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {loadingModel ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                            <span>{loadingModel ? (loadPercent !== undefined ? `Loading ${loadPercent}%` : 'Loading…') : 'Load Model'}</span>
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onInspect();
                        }}
                        className="flex items-center gap-1.5 px-3 py-1 bg-[var(--accent-color)]/10 hover:bg-[var(--accent-color)]/20 border border-[var(--accent-color)]/30 rounded-lg text-xs font-semibold text-[var(--accent-color)] transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
                    >
                        <span>🔍 Inspect Files & Header</span>
                    </button>
                </div>
            </div>
            {(loadingModel || loadMessage) && canLoad && (
                <div className="space-y-1">
                    {loadMessage && <p className="text-[11px] font-mono text-[var(--text-secondary)] truncate">{loadMessage}</p>}
                    {loadingModel && loadPercent !== undefined && (
                        <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
                            <div className="h-full rounded-full bg-emerald-400 transition-[width] duration-200" style={{ width: `${Math.max(0, Math.min(100, loadPercent))}%` }} />
                        </div>
                    )}
                </div>
            )}

            {/* 4-Column Metrics Grid */}
            <div className="grid grid-cols-4 gap-2 text-left">
                <div className="bg-[var(--bg-primary)]/40 border border-[var(--border-color)]/40 p-2 rounded-lg">
                    <div className="text-[10px] text-[var(--text-muted)] font-medium">Parameters</div>
                    <div className="text-xs font-semibold text-[var(--text-primary)] font-mono truncate">{params}</div>
                </div>
                <div className="bg-[var(--bg-primary)]/40 border border-[var(--border-color)]/40 p-2 rounded-lg">
                    <div className="text-[10px] text-[var(--text-muted)] font-medium">Bit Precision</div>
                    <div className="text-xs font-semibold text-[var(--text-primary)] font-mono truncate">{bitDepth}</div>
                </div>
                <div className="bg-[var(--bg-primary)]/40 border border-[var(--border-color)]/40 p-2 rounded-lg">
                    <div className="text-[10px] text-[var(--text-muted)] font-medium">{contextLabel}</div>
                    <div className="text-xs font-semibold text-[var(--text-primary)] font-mono truncate">{context}</div>
                </div>
                <div className="bg-[var(--bg-primary)]/40 border border-[var(--border-color)]/40 p-2 rounded-lg">
                    <div className="text-[10px] text-[var(--text-muted)] font-medium">Quantization</div>
                    <div className="text-xs font-semibold text-[var(--text-primary)] font-mono truncate">{quant}</div>
                </div>
            </div>

            {/* Supported Tasks Pills */}
            {tasks.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-[10px] text-[var(--text-muted)] font-medium mr-1">Supported Tasks:</span>
                    {tasks.map((task) => (
                        <span
                            key={task}
                            className="text-[10px] font-mono px-2 py-0.5 bg-[var(--bg-tertiary)]/70 text-[var(--text-secondary)] border border-[var(--border-color)]/60 rounded-md"
                        >
                            {task}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

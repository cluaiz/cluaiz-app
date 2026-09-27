import { ExternalLink, Cpu, Layers, Hash } from 'lucide-react';
import { InstalledModelDetail } from '../../../store/engine/useEngineStore';

interface ModelInfoCardProps {
    model: InstalledModelDetail;
    onInspect: () => void;
}

export function ModelInfoCard({ model, onInspect }: ModelInfoCardProps) {
    if (!model) return null;

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

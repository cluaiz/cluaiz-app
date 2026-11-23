import React from 'react';
import { Activity, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Tabs } from '../../../components/ui/Tabs';
import { useChatStore } from '../../../store/chat/useChatStore';
import { controlsFor, SAMPLING_KEYS, useChatControlsStore, type SamplingKey, type TelemetryMode } from '../../../store/chat/useChatControlsStore';
import { useLiveSystem } from '../hooks/useLiveSystem';

/** Each sampling field: its label, what it does, and the input's step and bounds */
const FIELDS: Record<SamplingKey, { label: string; help: string; step: number; min?: number; max?: number; whole?: boolean }> = {
    temperature: { label: 'Temperature', help: 'Higher is more varied, lower is more exact', step: 0.05, min: 0, max: 2 },
    top_p: { label: 'Top P', help: 'Keeps the likeliest words that add up to this share', step: 0.05, min: 0, max: 1 },
    top_k: { label: 'Top K', help: 'Keeps only this many likeliest words', step: 1, min: 0, whole: true },
    min_p: { label: 'Min P', help: 'Drops words far less likely than the best one', step: 0.01, min: 0, max: 1 },
    repetition_penalty: { label: 'Repetition penalty', help: 'Above 1 repeats less', step: 0.05, min: 0 },
    presence_penalty: { label: 'Presence penalty', help: 'Pushes toward new topics', step: 0.1, min: -2, max: 2 },
    frequency_penalty: { label: 'Frequency penalty', help: 'Lowers words already used often', step: 0.1, min: -2, max: 2 },
    max_tokens: { label: 'Max tokens', help: 'Longest answer, in tokens', step: 1, min: 1, whole: true },
    seed: { label: 'Seed', help: 'The same seed repeats the same answer', step: 1, whole: true },
};

const TELEMETRY: { id: TelemetryMode; label: string }[] = [
    { id: 'on', label: 'Always' }, { id: 'smart', label: 'While open' }, { id: 'off', label: 'Off' },
];

const gb = (value: number) => `${value.toFixed(1)} GB`;

function Meter({ label, used, total, detail }: { label: string; used: number; total: number; detail: string }) {
    const share = total > 0 ? Math.min(100, Math.max(0, used / total * 100)) : 0;
    return <div className="space-y-1">
        <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-[var(--text-primary)] truncate">{label}</span>
            <span className="shrink-0 text-[var(--text-secondary)]">{detail}</span>
        </div>
        <div className="h-1.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
            <div className="h-full bg-[var(--accent-color)] transition-[width] duration-500" style={{ width: `${share}%` }} />
        </div>
    </div>;
}

function Section({ title, icon, action, children }: { title: string; icon: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
    return <section className="space-y-3 border-b border-[var(--border-color)] p-4">
        <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">{icon}{title}</h3>
            {action}
        </div>
        {children}
    </section>;
}

/** The chat's run settings and the Engine's live hardware use, beside the chat */
export function ChatControlsPanel() {
    const open = useChatControlsStore(s => s.panelOpen), setOpen = useChatControlsStore(s => s.setPanelOpen);
    const chatId = useChatStore(s => s.activeSessionId);
    const byChat = useChatControlsStore(s => s.byChat), update = useChatControlsStore(s => s.update), reset = useChatControlsStore(s => s.reset);
    const mode = useChatControlsStore(s => s.telemetry), setMode = useChatControlsStore(s => s.setTelemetry);
    const system = useLiveSystem(mode, open);
    if (!open) return null;
    const controls = controlsFor(byChat, chatId);
    const own = Boolean(chatId && byChat[chatId]);
    const number = (key: SamplingKey, raw: string) => {
        const value = raw.trim() === '' ? undefined : Number(raw);
        if (value !== undefined && !Number.isFinite(value)) return;
        update(chatId, { [key]: value === undefined ? undefined : FIELDS[key].whole ? Math.round(value) : value });
    };
    const { live, models } = system;
    const planned = models.reduce((sum, model) => sum + (model.vram_gb || 0), 0);

    return <aside aria-label="Chat settings" className="absolute inset-y-0 right-0 z-40 flex w-full flex-col overflow-hidden border-l border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-2xl sm:w-80">
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--border-color)] px-4">
            <span className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]"><SlidersHorizontal size={15} /> Chat settings</span>
            <Button variant="ghost" size="icon" aria-label="Close chat settings" onClick={() => setOpen(false)}><X size={16} /></Button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            <Section title={chatId ? (own ? 'This chat' : 'This chat · new-chat settings') : 'New chats'} icon={<SlidersHorizontal size={13} />}
                action={<Button variant="ghost" size="sm" onClick={() => reset(chatId)} title="Use the Engine's defaults"><RotateCcw size={13} /> Reset</Button>}>
                <label className="block space-y-1">
                    <span className="text-xs font-semibold text-[var(--text-primary)]">System prompt</span>
                    <textarea value={controls.systemPrompt ?? ''} rows={4} placeholder="Instructions the model follows in this chat"
                        onChange={event => update(chatId, { systemPrompt: event.target.value })}
                        className="ui-input w-full resize-y py-2 text-xs" />
                </label>
                <p className="text-[11px] text-[var(--text-muted)]">An empty field uses the Engine's default for the model.</p>
                <div className="grid grid-cols-2 gap-2">
                    {SAMPLING_KEYS.map(key => <label key={key} className="block space-y-1" title={FIELDS[key].help}>
                        <span className="block truncate text-[11px] font-semibold text-[var(--text-secondary)]">{FIELDS[key].label}</span>
                        <Input sizeVariant="sm" type="number" inputMode="decimal" placeholder="Default" step={FIELDS[key].step}
                            min={FIELDS[key].min} max={FIELDS[key].max} value={controls[key] ?? ''} onChange={event => number(key, event.target.value)} />
                    </label>)}
                </div>
            </Section>

            <Section title="Live system" icon={<Activity size={13} />}>
                <Tabs items={TELEMETRY} value={mode} onChange={setMode} className="w-full" />
                {mode === 'off' ? <p className="text-xs text-[var(--text-muted)]">Live reads are off.</p>
                    : system.error && !live ? <p role="alert" className="text-xs text-[var(--status-error)]">{system.error}</p>
                    : !live ? <p role="status" className="text-xs text-[var(--text-muted)]">Reading…</p>
                    : <div className="space-y-3">
                        <Meter label="RAM" used={live.memory.used_gb} total={live.memory.total_gb}
                            detail={`${gb(live.memory.used_gb)} used · ${gb(live.memory.available_gb)} free of ${gb(live.memory.total_gb)}`} />
                        {live.gpus.map(gpu => <Meter key={gpu.index} label={gpu.name}
                            used={gpu.vram_total_bytes - gpu.vram_free_bytes} total={gpu.vram_total_bytes}
                            detail={`${gb((gpu.vram_total_bytes - gpu.vram_free_bytes) / 1024 ** 3)} of ${gb(gpu.vram_total_bytes / 1024 ** 3)} VRAM`} />)}
                        <p className="text-xs text-[var(--text-secondary)]">
                            CPU: {live.cpu.brand} · {live.cpu.physical_cores} cores / {live.cpu.logical_threads} threads
                            {live.cpu.frequency_mhz ? ` · ${(live.cpu.frequency_mhz / 1000).toFixed(2)} GHz` : ''}
                        </p>
                        {models.length ? models.map(model => <div key={model.model_id} className="rounded-lg border border-[var(--border-color)] p-2 text-xs text-[var(--text-secondary)]">
                            <div className="truncate font-semibold text-[var(--text-primary)]">{model.model_id}</div>
                            <div>{model.tier ?? '?'} · {model.n_gpu_layers === -1 ? 'all' : model.n_gpu_layers ?? '?'} GPU layers · {model.context_size.toLocaleString()} context · {model.vram_gb.toFixed(1)} GB planned</div>
                        </div>) : <p className="text-xs text-[var(--text-muted)]">No model is loaded.</p>}
                        {models.length > 0 && <p className="text-[11px] text-[var(--text-muted)]">The Engine planned {gb(planned)} of VRAM for the loaded models.</p>}
                        <p className="text-[11px] text-[var(--text-muted)]">
                            CPU and GPU use in percent, and the Engine's own RAM, are not reported by the Engine yet.
                        </p>
                    </div>}
            </Section>
        </div>
    </aside>;
}

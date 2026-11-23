import React, { useEffect, useRef, useState } from 'react';
import { Tabs } from '../../../components/ui/Tabs';
import { useChatControlsStore, type TelemetryMode } from '../../../store/chat/useChatControlsStore';
import { useLiveSystem } from '../hooks/useLiveSystem';

const MODES: { id: TelemetryMode; label: string }[] = [
    { id: 'on', label: 'Always' }, { id: 'smart', label: 'While open' }, { id: 'off', label: 'Off' },
];
const gb = (value: number) => `${value.toFixed(1)} GB`;
const pct = (used: number, total: number) => total > 0 ? Math.round(used / total * 100) : 0;

function Row({ label, used, total, detail }: { label: string; used: number; total: number; detail: string }) {
    return <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[var(--text-primary)]">{label}</span>
            <span className="shrink-0 text-[var(--text-muted)]"><b className="text-[var(--text-primary)]">{detail}</b> {pct(used, total)}%</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
            <div className="h-full bg-[var(--accent-color)] transition-[width] duration-500" style={{ width: `${pct(used, total)}%` }} />
        </div>
    </div>;
}

/** Live RAM / VRAM beside the context meter under the input, opened the same way (hover or click) */
export function SystemStatusPopover() {
    const mode = useChatControlsStore(s => s.telemetry), setMode = useChatControlsStore(s => s.setTelemetry);
    const [pinned, setPinned] = useState(false), [hovered, setHovered] = useState(false);
    const open = pinned || hovered;
    const box = useRef<HTMLDivElement>(null);
    const { live, models, error } = useLiveSystem(mode, open);
    useEffect(() => {
        if (!pinned) return;
        const away = (event: MouseEvent) => { if (box.current && !box.current.contains(event.target as Node)) { setPinned(false); setHovered(false); } };
        document.addEventListener('mousedown', away);
        return () => document.removeEventListener('mousedown', away);
    }, [pinned]);
    const vramUsed = live?.gpus.reduce((sum, gpu) => sum + gpu.vram_total_bytes - gpu.vram_free_bytes, 0) ?? 0;
    const vramTotal = live?.gpus.reduce((sum, gpu) => sum + gpu.vram_total_bytes, 0) ?? 0;

    return <div ref={box} className="relative flex items-center" onMouseEnter={() => { if (!pinned) setHovered(true); }} onMouseLeave={() => { if (!pinned) setHovered(false); }}>
        <button type="button" onClick={() => setPinned(value => !value)} title="Live RAM and GPU memory"
            className={`flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors cursor-pointer ${open ? 'bg-white/[0.08] text-[var(--text-primary)]' : 'hover:bg-white/[0.04] hover:text-[var(--text-primary)]'}`}>
            <span>System:</span>
            {live && mode !== 'off' ? <>
                <b className="font-semibold text-[var(--text-primary)]">RAM {pct(live.memory.used_gb, live.memory.total_gb)}%</b>
                {vramTotal > 0 && <b className="font-semibold text-[var(--text-primary)]">· VRAM {pct(vramUsed, vramTotal)}%</b>}
            </> : <span>{mode === 'off' ? 'off' : '…'}</span>}
        </button>
        {open && <div className="absolute bottom-full right-0 z-[90] mb-1.5 w-[300px] space-y-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-3 text-[11px] text-[var(--text-primary)] shadow-2xl sm:w-[340px]">
            <div className="flex items-center justify-between font-semibold">
                <span className="font-bold">System</span>
                {live?.cpu && <span className="truncate pl-2 text-[10px] text-[var(--text-muted)]">{live.cpu.physical_cores} cores · {(live.cpu.frequency_mhz / 1000).toFixed(2)} GHz</span>}
            </div>
            {mode === 'off' ? <p className="text-[var(--text-muted)]">Live reads are off.</p>
                : error && !live ? <p role="alert" className="text-[var(--status-error)]">{error}</p>
                : !live ? <p role="status" className="text-[var(--text-muted)]">Reading…</p>
                : <>
                    <Row label="RAM" used={live.memory.used_gb} total={live.memory.total_gb} detail={`${gb(live.memory.used_gb)} / ${gb(live.memory.total_gb)}`} />
                    {live.gpus.map(gpu => <Row key={gpu.index} label={gpu.name} used={gpu.vram_total_bytes - gpu.vram_free_bytes} total={gpu.vram_total_bytes}
                        detail={`${gb((gpu.vram_total_bytes - gpu.vram_free_bytes) / 1024 ** 3)} / ${gb(gpu.vram_total_bytes / 1024 ** 3)}`} />)}
                    {models.map(model => <div key={model.model_id} className="flex items-center justify-between gap-2 border-t border-[var(--border-color)] pt-2">
                        <span className="truncate text-[var(--text-primary)]">{model.model_id}</span>
                        <span className="shrink-0 text-[var(--text-muted)]">{model.n_gpu_layers === -1 ? 'all' : model.n_gpu_layers ?? '?'} GPU layers · {gb(model.vram_gb)}</span>
                    </div>)}
                </>}
            <Tabs items={MODES} value={mode} onChange={setMode} className="w-full" />
            <p className="text-[10px] text-[var(--text-muted)]">CPU and GPU use in percent, and the Engine's own RAM, are not reported by the Engine yet.</p>
        </div>}
    </div>;
}

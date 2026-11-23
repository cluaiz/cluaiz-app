import { useEffect, useState } from 'react';
import { readSystemLive } from '../../../api/engine/system/systemData';
import { systemApi } from '../../../api/engine/system/system.api';
import type { ActiveProcess, SystemLiveResponse } from '../../../api/engine/system/system.types';
import type { TelemetryMode } from '../../../store/chat/useChatControlsStore';

const EVERY_MS = 2000;

export interface LiveSystem { live: SystemLiveResponse | null; models: ActiveProcess[]; error: string; at: number }

/**
 * Reads `system.live` (RAM, CPU, GPU memory) and `system.ps` (the loaded model's plan) every 2 s.
 * `on`: always; `smart`: only while `watching` (the panel is open) and the window is visible; `off`: never.
 * The Engine has no telemetry stream yet, so this polls; one read at a time, never piling up.
 */
export function useLiveSystem(mode: TelemetryMode, watching: boolean): LiveSystem {
    const [state, setState] = useState<LiveSystem>({ live: null, models: [], error: '', at: 0 });
    const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState === 'visible');
    useEffect(() => {
        const change = () => setVisible(document.visibilityState === 'visible');
        document.addEventListener('visibilitychange', change);
        return () => document.removeEventListener('visibilitychange', change);
    }, []);
    const running = mode === 'on' || (mode === 'smart' && watching && visible);
    useEffect(() => {
        if (!running) return;
        let stopped = false, timer: ReturnType<typeof setTimeout> | undefined;
        const tick = async () => {
            try {
                const [live, ps] = await Promise.all([readSystemLive(), systemApi.getProcesses()]);
                if (!stopped) setState({ live, models: ps.active_processes ?? [], error: '', at: Date.now() });
            } catch (error) {
                if (!stopped) setState(previous => ({ ...previous, error: error instanceof Error ? error.message : String(error) }));
            }
            if (!stopped) timer = setTimeout(() => void tick(), EVERY_MS);
        };
        void tick();
        return () => { stopped = true; clearTimeout(timer); };
    }, [running]);
    return state;
}

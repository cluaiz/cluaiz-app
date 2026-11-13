import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../../../api/client/errors';
import { flowsApi, type FlowRun, type FlowScope, type RunDetail } from '../../../api/engine/automation';
import { toast } from '../../../components/ui/toast';

const WATCH_MS = 1_500;
const moving = (run?: FlowRun | null) => run?.status === 'queued' || run?.status === 'running' || run?.status === 'waiting';

/** A flow's runs, and the one shown on the canvas, watched while it is still going */
export function useFlowRuns(name?: string, scope?: FlowScope) {
    const [runs, setRuns] = useState<FlowRun[]>([]);
    const [shown, setShown] = useState<string | null>(null);
    const [detail, setDetail] = useState<RunDetail | null>(null);
    const [starting, setStarting] = useState(false);
    const list = useCallback(async () => {
        if (!name || !scope) return;
        try { setRuns(await flowsApi.runs({ name, scope })); } catch { /* the list stays as it was */ }
    }, [name, scope]);

    useEffect(() => { setRuns([]); setShown(null); setDetail(null); void list(); }, [list]);

    useEffect(() => {
        if (!shown) { setDetail(null); return; }
        let alive = true, timer: ReturnType<typeof setTimeout> | undefined;
        const read = async () => {
            try {
                const value = await flowsApi.runGet(shown);
                if (!alive) return;
                setDetail(value);
                if (moving(value.run)) timer = setTimeout(read, WATCH_MS);
                else void list();
            } catch (reason) { if (alive) toast.error(errorMessage(reason)); }
        };
        void read();
        return () => { alive = false; clearTimeout(timer); };
    }, [shown, list]);

    const start = useCallback(async (from?: { run: string; step: string }) => {
        if (!name || !scope) return;
        setStarting(true);
        try {
            const id = from ? await flowsApi.rerunFrom(from.run, from.step) : await flowsApi.run({ name, scope });
            setShown(id);
            void list();
        } catch (reason) { toast.error(errorMessage(reason)); }
        finally { setStarting(false); }
    }, [name, scope, list]);

    return { runs, shown, setShown, detail, starting, start, refresh: list };
}

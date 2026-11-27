import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Power } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { toast } from '../../../components/ui/toast';
import { errorMessage } from '../../../api/client/errors';
import { modelsApi } from '../../../api/engine/models/models.api';
import { systemApi } from '../../../api/engine/system/system.api';
import { useConnectionStore } from '../../../store/engine/useConnectionStore';

const EVERY_MS = 4000;

/**
 * Eject for the loaded chat model (like `ollama stop`): shows only while `system.ps` lists a loaded model,
 * calls `models.unload` for it, then reads `system.ps` again. The Engine's own error text is shown on failure.
 */
export function UnloadModelButton() {
    const connection = useConnectionStore(state => `${state.protocol}:${state.getBaseUrl()}`);
    const [loaded, setLoaded] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const working = useRef(false);

    const refresh = useCallback(async (isCurrent: () => boolean = () => true) => {
        try {
            const ps = await systemApi.getProcesses();
            if (isCurrent()) setLoaded(ps.active_processes?.[0]?.model_id ?? null);
        } catch {
            if (isCurrent()) setLoaded(null); // Engine offline or unreadable: nothing to eject
        }
    }, []);

    useEffect(() => {
        let stopped = false, timer: ReturnType<typeof setTimeout> | undefined;
        const tick = async () => {
            if (document.visibilityState === 'visible' && !working.current) await refresh(() => !stopped);
            if (!stopped) timer = setTimeout(() => void tick(), EVERY_MS);
        };
        void tick();
        return () => { stopped = true; clearTimeout(timer); };
    }, [connection, refresh]);

    if (!loaded) return null;

    const unload = async () => {
        if (working.current) return;
        working.current = true;
        setBusy(true);
        try {
            const result = await modelsApi.unloadModel(loaded);
            if (result.busy.length) toast.error(`${loaded} is in use by a running request and stayed loaded. Try again when it ends.`);
            else toast.success(`Unloaded ${loaded}`);
        } catch (failure) {
            toast.error(errorMessage(failure));
        } finally {
            working.current = false;
            setBusy(false);
            await refresh();
        }
    };

    return <Button variant="ghost" size="sm" onClick={() => void unload()} disabled={busy}
        title={`Unload ${loaded} from memory`} aria-label={`Unload ${loaded}`} className="ml-1 shrink-0 gap-1.5">
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Power size={14} />}
        <span className="hidden @md/chat:inline">{busy ? 'Unloading…' : 'Unload'}</span>
    </Button>;
}

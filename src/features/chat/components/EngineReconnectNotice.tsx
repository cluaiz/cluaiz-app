import { useRef, useState } from 'react';
import { RotateCw } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { useEngineStore } from '../../../store/engine/useEngineStore';

/** Reuse settings initialization: native boot for FFI, reconnect for HTTP. */
export function EngineReconnectNotice() {
    const fetchStatus = useEngineStore(state => state.fetchStatus);
    const [retrying, setRetrying] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const busy = useRef(false);
    const loading = retrying || fetchStatus === 'loading';

    const retry = async () => {
        if (busy.current || useEngineStore.getState().fetchStatus === 'loading') return;
        busy.current = true;
        setRetrying(true);
        setMessage(null);
        try {
            await useEngineStore.getState().initEngineSettings();
            const state = useEngineStore.getState();
            if (state.fetchStatus === 'auth_required') {
                setMessage('Engine needs authentication. Enter your session token.');
            } else if (state.fetchStatus !== 'success' || !state.permissions) {
                setMessage('Engine is still offline. Check the connection and retry.');
            }
        } catch {
            setMessage('Could not connect to the Engine. Please retry.');
        } finally {
            busy.current = false;
            setRetrying(false);
        }
    };

    return (
        <div className="flex items-center gap-1 text-sm font-medium text-[var(--text-muted)]">
            <span role="status" aria-live="polite" className="min-w-0 break-words">
                {loading ? 'Connecting to Cluaiz Engine...' : (message ?? 'Cluaiz Engine is offline...')}
            </span>
            <Button type="button" variant="ghost" size="icon" onClick={retry} disabled={loading}
                className="h-6 w-6 shrink-0" title="Retry Engine connection" aria-label="Retry Engine connection" aria-busy={loading}>
                <RotateCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            </Button>
        </div>
    );
}

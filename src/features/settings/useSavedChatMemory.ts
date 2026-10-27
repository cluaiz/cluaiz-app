import { useCallback, useEffect, useRef, useState } from 'react';
import { chatMemoryApi, type ChatMemorySettings, type ChatMemoryStatus } from '../../api/engine/chat-memory';
import { errorMessage } from '../../api/client/errors';
import { useConnectionStore } from '../../store/engine/useConnectionStore';

interface View { scope: string; memory: ChatMemoryStatus | null; busy: boolean; error: string | null; }
interface Job { scope: string; controller: AbortController; }
type Operation = { kind: 'refresh' | 'clear' } | { kind: 'update'; patch: Partial<ChatMemorySettings> };

/** Saved KV settings/usage for the selected Engine; local chat retention is a separate owner. */
export function useSavedChatMemory() {
    const scope = useConnectionStore(s => JSON.stringify([s.protocol, s.host, s.port]));
    const currentScope = useRef(scope); currentScope.current = scope;
    const active = useRef<Job | null>(null);
    const [view, setView] = useState<View>({ scope: '', memory: null, busy: true, error: null });
    const snapshot = useRef(view); snapshot.current = view;

    const operate = useCallback(async (operation: Operation) => {
        const { kind } = operation;
        // Old confirmation closures must not clear another Engine's cache.
        if (scope !== currentScope.current || active.current) return false;
        if (kind !== 'refresh' && (snapshot.current.scope !== scope || !snapshot.current.memory || snapshot.current.error)) return false;
        const job = { scope, controller: new AbortController() }; active.current = job;
        const alive = () => active.current === job && currentScope.current === scope && !job.controller.signal.aborted;
        const signal = job.controller.signal;
        let acknowledgment = '';
        setView(previous => ({ scope, memory: previous.scope === scope ? previous.memory : null, busy: true, error: null }));
        try {
            if (operation.kind === 'update') {
                const saved = await chatMemoryApi.updateSettings(operation.patch, signal);
                if (!alive()) return false;
                acknowledgment = 'Settings saved';
                setView(previous => ({ ...previous, memory: previous.memory ? { ...previous.memory, settings: saved.settings } : null }));
            } else if (kind === 'clear') {
                const result = await chatMemoryApi.clear(signal);
                if (!alive()) return false;
                acknowledgment = `Cache cleanup acknowledged (${result.deleted} removed)`;
                // Concurrent writers may create new entries; do not invent a zero usage snapshot.
                setView(previous => ({ ...previous, memory: null }));
            }
            const memory = await chatMemoryApi.getStatus(signal);
            if (!alive()) return false;
            setView({ scope, memory, busy: false, error: null });
            return true;
        } catch (failure) {
            if (alive()) setView(previous => ({ ...previous, busy: false,
                error: `${acknowledgment ? acknowledgment + '; usage refresh failed: ' : ''}${errorMessage(failure)}` }));
            return acknowledgment.length > 0;
        } finally {
            if (active.current === job) {
                active.current = null;
                setView(previous => ({ ...previous, busy: false }));
            }
        }
    }, [scope]);

    useEffect(() => {
        currentScope.current = scope;
        setView({ scope, memory: null, busy: true, error: null });
        void operate({ kind: 'refresh' });
        return () => {
            if (active.current?.scope === scope) { active.current.controller.abort(); active.current = null; }
        };
    }, [scope, operate]);

    return { ...(view.scope === scope ? view : { scope, memory: null, busy: true, error: null }),
        refresh: () => operate({ kind: 'refresh' }), update: (patch: Partial<ChatMemorySettings>) => operate({ kind: 'update', patch }),
        clear: () => operate({ kind: 'clear' }) };
}

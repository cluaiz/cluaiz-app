import { useCallback, useEffect, useRef, useState } from 'react';
import { useSystemStore } from '../../../api/engine/system/system.store';
import { usePermissionStore } from '../../../api/engine/permission/permission.store';
import { commandApproval } from '../../../api/engine/system/execution';
import { ApiError, errorMessage } from '../../../api/client/errors';
import type { CommandApproval } from '../../../api/engine/system/system.types';

interface Job {
    scope: string; controller: AbortController; approval?: CommandApproval; deciding: boolean;
    answer?: (id: string) => void; refuse?: (error: Error) => void;
}

/** Observe one command. Only an explicit acknowledged approval retries its exact payload once. */
export function useTerminalExecution(scope: string) {
    const current = useRef(scope); current.current = scope;
    const job = useRef<Job | null>(null);
    const [approval, setApproval] = useState<CommandApproval | null>(null);
    const [deciding, setDeciding] = useState(false);
    const [error, setError] = useState('');
    const alive = (run: Job) => job.current === run && run.scope === current.current && !run.controller.signal.aborted;
    useEffect(() => {
        current.current = scope;
        setApproval(null); setDeciding(false); setError('');
        return () => {
            const run = job.current;
            if (run) {
                run.controller.abort();
                run.refuse?.(new ApiError('Command observation ended; an already running process may continue', 409, 'COMMAND_OBSERVATION_ENDED'));
            }
            job.current = null;
        };
    }, [scope]);

    const execute = useCallback(async (command: string) => {
        if (job.current) throw new ApiError('A command is already pending', 409, 'COMMAND_BUSY');
        const run: Job = { scope, controller: new AbortController(), deciding: false };
        job.current = run; setError('');
        const request = (approvalId?: string) => useSystemStore.getState().executeCommand(command, undefined,
            { signal: run.controller.signal, approvalId });
        try {
            try { return await request(); }
            catch (failure) {
                const asked = commandApproval(failure);
                if (!asked || !alive(run)) throw failure;
                run.approval = asked;
                const id = await new Promise<string>((resolve, reject) => {
                    run.answer = resolve; run.refuse = reject; setApproval(asked);
                });
                if (!alive(run)) throw new ApiError('Command observation ended', 409, 'COMMAND_OBSERVATION_ENDED');
                // No loop: a second approval request or unknown transport outcome is never replayed automatically.
                return await request(id);
            }
        } finally {
            if (job.current === run) { job.current = null; setApproval(null); setDeciding(false); }
        }
    }, [scope]);

    const decide = async (approved: boolean) => {
        const run = job.current;
        if (!run?.approval || !alive(run) || run.deciding) return;
        run.deciding = true; setDeciding(true); setError('');
        try {
            const permissions = usePermissionStore.getState();
            if (approved) await permissions.approvePermission(run.approval.id);
            else await permissions.rejectPermission(run.approval.id);
            if (!alive(run)) return;
            setApproval(null);
            if (approved) run.answer?.(run.approval.id);
            else run.refuse?.(new ApiError('Command rejected; it was not executed', 403, 'COMMAND_REJECTED'));
        } catch (failure) { if (alive(run)) setError(errorMessage(failure)); }
        finally { if (alive(run)) { run.deciding = false; setDeciding(false); } }
    };
    return { execute, approval, deciding, error, decide };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { flowsApi, missingPermissions, type FlowRef, type FlowRun, type FlowSummary, type MissingPermissions } from '../../api/engine/automation';
import { errorMessage } from '../../api/client/errors';
import { toast } from '../../components/ui/toast';

export const flowKey = (ref: FlowRef) => `${ref.scope}:${ref.name}`;
const refOf = (flow: FlowSummary): FlowRef => ({ name: flow.name, scope: flow.scope });

export const describePermissions = (missing: MissingPermissions) => {
    const lines = Object.entries(missing).map(([kind, names]) => `${kind}: ${names.join(', ')}`);
    return lines.length ? `This flow asks for: ${lines.join('; ')}.` : 'This flow asks for permissions that are not confirmed yet.';
};

/** Runs that are still moving; a waiting run can wait for days, so it is not watched. */
const active = (runs: FlowRun[] | null) => Boolean(runs?.some(run => run.status === 'queued' || run.status === 'running'));
const WATCH_MS = 2_000;

export interface PendingConfirmation { flow: FlowRef; missing: MissingPermissions }

/** Flows and their runs, read from Automation; every change re-reads the Engine's answer. */
export function useFlows() {
    const [flows, setFlows] = useState<FlowSummary[] | null>(null);
    const [runs, setRuns] = useState<FlowRun[] | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState<string | null>(null);
    const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(null);
    const reads = useRef<AbortController | null>(null);

    const refresh = useCallback(async () => {
        reads.current?.abort();
        const controller = new AbortController();
        reads.current = controller;
        setError('');
        try {
            const [nextFlows, nextRuns] = await Promise.all([flowsApi.list(controller.signal), flowsApi.runs(undefined, controller.signal)]);
            if (controller.signal.aborted) return;
            setFlows(nextFlows);
            setRuns(nextRuns);
        } catch (reason) {
            if (!controller.signal.aborted) setError(errorMessage(reason));
        }
    }, []);

    useEffect(() => {
        void refresh();
        return () => reads.current?.abort();
    }, [refresh]);

    useEffect(() => {
        if (!active(runs)) return;
        const timer = setTimeout(() => void refresh(), WATCH_MS);
        return () => clearTimeout(timer);
    }, [runs, refresh]);

    const act = useCallback(async (key: string, action: () => Promise<unknown>, done: string, onRefused?: (missing: MissingPermissions) => void) => {
        setBusy(key);
        try {
            await action();
            toast.success(done);
            await refresh();
        } catch (reason) {
            const missing = onRefused ? missingPermissions(reason) : null;
            if (missing) onRefused!(missing);
            else toast.error(errorMessage(reason));
        } finally {
            setBusy(null);
        }
    }, [refresh]);

    const setEnabled = useCallback((flow: FlowSummary, enabled: boolean, permissionsConfirmed = false) => {
        const ref = refOf(flow);
        const ask = enabled && !permissionsConfirmed ? (missing: MissingPermissions) => setConfirmation({ flow: ref, missing }) : undefined;
        return act(flowKey(ref), () => enabled ? flowsApi.enable(ref, permissionsConfirmed) : flowsApi.disable(ref),
            `${flow.name} ${enabled ? 'enabled' : 'disabled'}`, ask);
    }, [act]);

    const run = useCallback((flow: FlowSummary) =>
        act(flowKey(flow), () => flowsApi.run(refOf(flow)), `${flow.name} started`), [act]);

    const remove = useCallback((flow: FlowSummary) =>
        act(flowKey(flow), () => flowsApi.remove(refOf(flow)), `${flow.name} removed`), [act]);

    const rerunFrom = useCallback((record: FlowRun, step: string) =>
        act(record.run_id, () => flowsApi.rerunFrom(record.run_id, step), `${record.flow} started again from ${step}`), [act]);

    const confirm = useCallback(() => {
        const pending = confirmation;
        setConfirmation(null);
        const flow = pending && flows?.find(item => flowKey(item) === flowKey(pending.flow));
        if (flow) void setEnabled(flow, true, true);
    }, [confirmation, flows, setEnabled]);

    return { flows, runs, error, busy, confirmation, refresh, setEnabled, run, remove, rerunFrom, confirm,
        cancelConfirmation: () => setConfirmation(null) };
}

import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { flowsApi, type FlowRun, type RunDetail } from '../../api/engine/automation';
import { errorMessage } from '../../api/client/errors';
import { formatDuration } from '../chat/hooks/useChatTelemetry';
import { RunStatusBadge, when } from './RunStatusBadge';

const finished = new Set(['succeeded', 'failed', 'cancelled']);

function RunSteps({ record, busy, onRerun }: { record: FlowRun; busy: boolean; onRerun: (record: FlowRun, step: string) => void }) {
    const runId = record.run_id;
    const [detail, setDetail] = useState<RunDetail | null>(null);
    const [error, setError] = useState('');
    useEffect(() => {
        const controller = new AbortController();
        flowsApi.runGet(runId, controller.signal).then(setDetail)
            .catch(reason => { if (!controller.signal.aborted) setError(errorMessage(reason)); });
        return () => controller.abort();
    }, [runId, record.status]);

    if (error) return <p role="alert" className="text-xs text-red-400">{error}</p>;
    if (!detail) return <p role="status" className="text-xs text-[var(--text-secondary)]">Reading steps…</p>;
    if (!detail.steps.length) return <p className="text-xs text-[var(--text-secondary)]">No steps recorded.</p>;
    return <ol className="space-y-1.5 border-t border-[var(--border-color)] pt-3">
        {detail.steps.map(step => {
            const last = step.attempts?.at(-1);
            return <li key={step.id} className="flex flex-wrap items-center gap-2 text-xs">
                <RunStatusBadge status={step.status} />
                <span className="font-mono text-[var(--text-primary)]">{step.id}</span>
                <span className="text-[var(--text-muted)]">{step.kind}</span>
                {last?.ms !== undefined && <span className="text-[var(--text-muted)]">{formatDuration(last.ms)}</span>}
                {(step.attempts?.length ?? 0) > 1 && <span className="text-[var(--text-muted)]">{step.attempts!.length} attempts</span>}
                {finished.has(record.status) && <Button size="sm" variant="ghost" className="ml-auto" disabled={busy}
                    title="Start a new run from this step" onClick={() => onRerun(record, step.id)}>
                    <RotateCcw className="w-3.5 h-3.5 mr-1" /> Run from here
                </Button>}
                {last?.error?.message && <span className="w-full text-red-400">{last.error.message}</span>}
            </li>;
        })}
    </ol>;
}

export function RunList({ runs, busy, onRerun }: { runs: FlowRun[]; busy: string | null; onRerun: (record: FlowRun, step: string) => void }) {
    const [open, setOpen] = useState<string | null>(null);
    if (!runs.length) return <p className="text-sm text-[var(--text-secondary)]">No runs yet.</p>;
    return <div className="space-y-2">
        {runs.map(run => <Card key={run.run_id}>
            <CardContent className="space-y-3 py-3">
                <button type="button" className="flex w-full flex-wrap items-center gap-3 text-left cursor-pointer"
                    aria-expanded={open === run.run_id} onClick={() => setOpen(open === run.run_id ? null : run.run_id)}>
                    <RunStatusBadge status={run.status} />
                    <span className="font-medium text-[var(--text-primary)]">{run.flow}</span>
                    <span className="text-xs text-[var(--text-muted)]">{run.trigger?.kind ?? 'call'}{run.dry_run ? ' · dry run' : ''}</span>
                    <span className="ml-auto text-xs text-[var(--text-secondary)]">
                        {when(run.started_at ?? run.created_at)}
                        {run.running_ms !== undefined && ` · ${formatDuration(run.running_ms)}`}
                    </span>
                </button>
                {run.waiting_for && <p className="text-xs text-[var(--text-secondary)]">
                    Waiting for {run.waiting_for.kind}{run.waiting_for.step ? ` at ${run.waiting_for.step}` : ''}
                    {run.waiting_for.until ? ` until ${when(run.waiting_for.until)}` : ''}
                </p>}
                {run.error?.message && <p role="alert" className="text-xs text-red-400">{run.error.message}</p>}
                {open === run.run_id && <RunSteps record={run} busy={Boolean(busy)} onRerun={onRerun} />}
            </CardContent>
        </Card>)}
    </div>;
}

import { Clock3, ShieldCheck } from 'lucide-react';
import type { FlowRun } from '../../../api/engine/automation';
import { RunList } from '../RunList';
import { ago } from '../home/homeText';

/** Runs that wait for the person (an `approve` step, a wait, or a tool call that needs a yes), newest first */
export function ApprovalsPage({ runs, busy, onRerun }: { runs: FlowRun[]; busy: string | null; onRerun: (record: FlowRun, step: string) => void }) {
    const waiting = runs.filter(run => run.status === 'waiting');
    return <div className="space-y-4">
        <p className="max-w-2xl text-sm text-[var(--text-secondary)]">Runs that stopped to wait for you. Open one to see the step it waits at.</p>
        {waiting.length === 0
            ? <section className="rounded-2xl border border-dashed border-[var(--border-color)] p-10 text-center">
                <ShieldCheck className="mx-auto h-8 w-8 text-emerald-400" />
                <h2 className="mt-3 text-base font-semibold text-[var(--text-primary)]">Nothing waits for you</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">When a workflow reaches an approval step, it shows here.</p>
            </section>
            : <>
                <ul className="space-y-1">
                    {waiting.map(run => <li key={run.run_id} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                        <Clock3 className="h-4 w-4 text-amber-400" /><b className="text-[var(--text-primary)]">{run.flow}</b>
                        waits for {run.waiting_for?.kind ?? 'you'}{run.waiting_for?.step ? ` at ${run.waiting_for.step}` : ''} · since {ago(run.started_at ?? run.created_at)}
                    </li>)}
                </ul>
                <RunList runs={waiting} busy={busy} onRerun={onRerun} />
            </>}
    </div>;
}

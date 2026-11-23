import { ArrowRight, CheckCircle2, CircleAlert, Clock3, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import type { FlowRun } from '../../../api/engine/automation';
import { formatDuration } from '../../chat/hooks/useChatTelemetry';
import { ago } from './homeText';

const ICON: Record<string, { icon: typeof CheckCircle2; tone: string }> = {
    succeeded: { icon: CheckCircle2, tone: 'text-emerald-400' },
    failed: { icon: XCircle, tone: 'text-red-400' },
    running: { icon: Loader2, tone: 'text-[var(--accent-color)] animate-spin' },
    queued: { icon: Loader2, tone: 'text-[var(--accent-color)] animate-spin' },
    waiting: { icon: Clock3, tone: 'text-amber-400' },
};

export const Panel = ({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) =>
    <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>{action}
        </div>
        {children}
    </section>;

/** The last few runs of any workflow: how each went, when, and how long it took */
export function RecentRuns({ runs, onAll }: { runs: FlowRun[]; onAll: () => void }) {
    const latest = [...runs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);
    return <Panel title="Recent runs" action={runs.length > 0 && <button type="button" onClick={onAll}
        className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer">View all <ArrowRight className="h-3 w-3" /></button>}>
        {latest.length === 0
            ? <p className="py-4 text-center text-xs text-[var(--text-muted)]">No runs yet. Press Run on a workflow to see it here.</p>
            : <ul className="space-y-1">
                {latest.map(run => {
                    const look = ICON[run.status] ?? { icon: CircleAlert, tone: 'text-[var(--text-muted)]' };
                    return <li key={run.run_id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-[var(--bg-tertiary)]/40">
                        <look.icon className={`h-4 w-4 shrink-0 ${look.tone}`} />
                        <div className="min-w-0 flex-1">
                            <div className="truncate text-sm text-[var(--text-primary)]">{run.flow}</div>
                            <div className="truncate text-xs text-[var(--text-muted)]">
                                {run.status === 'failed' && run.error?.message ? run.error.message : `${ago(run.created_at)}${run.running_ms ? ` · ${formatDuration(run.running_ms)}` : ''}`}
                            </div>
                        </div>
                    </li>;
                })}
            </ul>}
    </Panel>;
}

/** Whether anything needs the person: workflows with problems, runs waiting for an approval, failures today */
export function Health({ problems, waiting, failedToday }: { problems: number; waiting: number; failedToday: number }) {
    const rows = [
        { ok: true, text: 'Engine connected' },
        { ok: problems === 0, text: problems ? `${problems} workflow${problems > 1 ? 's' : ''} with problems` : 'No workflow problems' },
        { ok: waiting === 0, text: waiting ? `${waiting} run${waiting > 1 ? 's' : ''} waiting for you` : 'Nothing waiting for approval' },
        { ok: failedToday === 0, text: failedToday ? `${failedToday} failed today` : 'No failures today' },
    ];
    const allGood = rows.every(row => row.ok);
    return <Panel title="Health">
        <div className="flex items-center gap-4">
            <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-4 ${allGood ? 'border-emerald-400/70 text-emerald-400' : 'border-amber-400/70 text-amber-400'}`}>
                {allGood ? <ShieldCheck className="h-6 w-6" /> : <CircleAlert className="h-6 w-6" />}
            </span>
            <ul className="space-y-1.5">
                {rows.map(row => <li key={row.text} className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                    {row.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <CircleAlert className="h-3.5 w-3.5 text-amber-400" />}{row.text}
                </li>)}
            </ul>
        </div>
    </Panel>;
}

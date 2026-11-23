import { useMemo } from 'react';
import { Activity, Bot, CheckCircle2, CircleAlert, Clock3, Plus, TriangleAlert, Upload, Workflow, XCircle } from 'lucide-react';
import type { FlowRun, FlowSummary } from '../../../api/engine/automation';
import { flowKey } from '../useFlows';
import { Health, Panel, RecentRuns } from './HomeSide';
import { Bars } from './Bars';
import { errorsOf, perDay, summary } from './homeText';

export type Section = 'home' | 'workflows' | 'agents' | 'runs' | 'approvals';

/**
 * Overview: only the state of Automation and what needs the person. Counts with the last 7 days as bars, three ways
 * to start, a "needs attention" list, the latest runs and health. Lists and organizing live in their own sections.
 */
export function AutomationHome({ flows, runs, onGo, onOpen, onNew, onNewAgent, onImport }: {
    flows: FlowSummary[]; runs: FlowRun[]; onGo: (section: Section) => void; onOpen: (flow: FlowSummary) => void;
    onNew: () => void; onNewAgent: () => void; onImport: () => void;
}) {
    const counts = useMemo(() => summary(flows, runs), [flows, runs]);
    const week = useMemo(() => ({ all: perDay(runs), ok: perDay(runs, 7, Date.now(), run => run.status === 'succeeded'), failed: perDay(runs, 7, Date.now(), run => run.status === 'failed') }), [runs]);
    const attention = useMemo(() => {
        const items: { key: string; icon: typeof CircleAlert; tone: string; title: string; text: string; flow?: FlowSummary; go?: Section }[] = [];
        for (const flow of flows) {
            const errors = errorsOf(flow);
            if (errors.length) items.push({ key: `p:${flowKey(flow)}`, icon: CircleAlert, tone: 'text-red-400', title: flow.name, text: errors[0].message, flow });
            else if (flow.last_run?.status === 'failed') items.push({ key: `f:${flowKey(flow)}`, icon: XCircle, tone: 'text-red-400', title: flow.name, text: 'Its last run failed', go: 'runs' });
        }
        if (counts.waiting) items.unshift({ key: 'w', icon: Clock3, tone: 'text-amber-400', title: `${counts.waiting} run${counts.waiting > 1 ? 's' : ''} waiting for you`, text: 'Open Approvals', go: 'approvals' });
        return items.slice(0, 6);
    }, [flows, counts.waiting]);

    return <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat icon={Workflow} value={counts.on} label="Active workflows" hint={`${counts.total} saved`} onClick={() => onGo('workflows')} />
                <Stat icon={Activity} value={counts.runsToday} label="Runs (24h)" hint="bars: last 7 days" bars={week.all} onClick={() => onGo('runs')} />
                <Stat icon={CheckCircle2} value={counts.successRate === null ? '—' : `${counts.successRate}%`} label="Success rate" hint={`${counts.finishedCount} finished runs`} bars={week.ok} onClick={() => onGo('runs')} />
                <Stat icon={TriangleAlert} value={counts.failedToday} label="Failed (24h)" hint="bars: last 7 days" bars={week.failed} bad={counts.failedToday > 0} onClick={() => onGo('runs')} />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Action primary icon={Plus} title="Create workflow" text="Start on an empty canvas" onClick={onNew} />
                <Action icon={Bot} title="New agent" text="A tool your chats can call" onClick={onNewAgent} />
                <Action icon={Upload} title="Import" text="A .yaml or .json flow file" onClick={onImport} />
            </div>

            <Panel title="Needs attention">
                {attention.length === 0
                    ? <p className="flex items-center gap-2 py-2 text-sm text-[var(--text-secondary)]"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Nothing needs you right now.</p>
                    : <ul className="divide-y divide-[var(--border-color)]/60">
                        {attention.map(item => <li key={item.key}>
                            <button type="button" onClick={() => item.flow ? onOpen(item.flow) : item.go && onGo(item.go)}
                                className="flex w-full items-center gap-3 px-1 py-2.5 text-left hover:bg-[var(--bg-tertiary)]/40 cursor-pointer">
                                <item.icon className={`h-4 w-4 shrink-0 ${item.tone}`} />
                                <span className="min-w-0 flex-1"><span className="block truncate text-sm text-[var(--text-primary)]">{item.title}</span>
                                    <span className="block truncate text-xs text-[var(--text-muted)]">{item.text}</span></span>
                            </button>
                        </li>)}
                    </ul>}
            </Panel>
        </div>
        <aside className="space-y-5">
            <RecentRuns runs={runs} onAll={() => onGo('runs')} />
            <Health problems={counts.problems} waiting={counts.waiting} failedToday={counts.failedToday} />
        </aside>
    </div>;
}

function Stat({ icon: Icon, value, label, hint, bars, bad, onClick }: {
    icon: typeof Workflow; value: number | string; label: string; hint: string; bars?: number[]; bad?: boolean; onClick: () => void;
}) {
    return <button type="button" onClick={onClick}
        className="flex flex-col gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 text-left transition-colors cursor-pointer hover:border-[var(--accent-color)]/40">
        <span className="flex items-center justify-between gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-secondary)]"><Icon className="h-4 w-4" /></span>
            {bars && <Bars values={bars} />}
        </span>
        <span className="min-w-0">
            <span className={`block text-2xl font-semibold leading-tight tabular-nums ${bad ? 'text-red-400' : 'text-[var(--text-primary)]'}`}>{value}</span>
            <span className="block truncate text-xs text-[var(--text-secondary)]">{label}</span>
            <span className="block truncate text-[11px] text-[var(--text-muted)]">{hint}</span>
        </span>
    </button>;
}

function Action({ icon: Icon, title, text, primary, onClick }: { icon: typeof Plus; title: string; text: string; primary?: boolean; onClick: () => void }) {
    return <button type="button" onClick={onClick}
        className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-colors cursor-pointer ${primary
            ? 'border-transparent bg-[var(--text-primary)] text-[var(--bg-primary)] hover:opacity-90'
            : 'border-[var(--border-color)] bg-[var(--bg-secondary)] hover:border-[var(--accent-color)]/40'}`}>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${primary ? 'bg-[var(--bg-primary)] text-[var(--text-primary)]' : 'border border-[var(--border-color)] text-[var(--text-secondary)]'}`}><Icon className="h-5 w-5" /></span>
        <span className="min-w-0">
            <span className={`block text-sm font-semibold ${primary ? '' : 'text-[var(--text-primary)]'}`}>{title}</span>
            <span className={`block truncate text-xs ${primary ? 'opacity-70' : 'text-[var(--text-muted)]'}`}>{text}</span>
        </span>
    </button>;
}

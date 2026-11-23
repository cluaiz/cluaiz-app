import { useMemo, useRef, useState } from 'react';
import { Activity, Bot, CheckCircle2, Hammer, History, Play, Plus, RefreshCw, Search, ShieldCheck, TriangleAlert, Upload, Workflow, Wrench } from 'lucide-react';
import { Tabs } from '../../../components/ui/Tabs';
import { Button } from '../../../components/ui/Button';
import { CluaizLogo } from '../../../components/ui/CluaizLogo';
import { CustomDropdown } from '../../../components/ui/dropdown/CustomDropdown';
import type { FlowSummary } from '../../../api/engine/automation';
import { RunList } from '../RunList';
import { TRIGGER_KINDS } from '../model/kinds';
import { flowKey, type useFlows } from '../useFlows';
import { WorkflowRow, ROW_GRID } from './WorkflowRow';
import { Health, RecentRuns } from './HomeSide';
import { Bars } from './Bars';
import { matchesStatus, perDay, runsToday, sortFlows, summary, type SortBy, type StatusFilter } from './homeText';

type Flows = ReturnType<typeof useFlows>;

const CAN = [
    { icon: Workflow, label: 'Workflows' }, { icon: Bot, label: 'AI agents' }, { icon: Wrench, label: 'Tools & MCP' }, { icon: ShieldCheck, label: 'Approvals' },
];
const STATUS = [{ value: 'all', label: 'All statuses' }, { value: 'on', label: 'On' }, { value: 'off', label: 'Off' }, { value: 'problems', label: 'Needs attention' }];
const SORT = [{ value: 'updated', label: 'Recently updated' }, { value: 'last_run', label: 'Last run' }, { value: 'name', label: 'Name' }];

/**
 * Automation's landing page: what Automation does, the state of every workflow at a glance (counts with the last
 * 7 days as bars), ways to start, the workflow table, and on the side the latest runs and anything that needs the
 * person. Every number comes from the Engine's flow and run lists; nothing here is sample data.
 */
export function AutomationHome({ data, onOpen, onNew, onImport, onRemove }: {
    data: Flows; onOpen: (flow: FlowSummary) => void; onNew: () => void; onImport: (file: File) => void; onRemove: (flow: FlowSummary) => void;
}) {
    const { flows, runs, error, busy, refresh, setEnabled, run, rerunFrom } = data;
    const [section, setSection] = useState<'workflows' | 'runs'>('workflows');
    const [status, setStatus] = useState<StatusFilter>('all');
    const [triggerKind, setTriggerKind] = useState('all');
    const [sortBy, setSortBy] = useState<SortBy>('updated');
    const [query, setQuery] = useState('');
    const file = useRef<HTMLInputElement>(null);

    const counts = useMemo(() => flows && runs ? summary(flows, runs) : null, [flows, runs]);
    const week = useMemo(() => runs ? { all: perDay(runs), failed: perDay(runs, 7, Date.now(), item => item.status === 'failed'), ok: perDay(runs, 7, Date.now(), item => item.status === 'succeeded') } : null, [runs]);
    const today = useMemo(() => runsToday(runs ?? []), [runs]);
    const triggerOptions = useMemo(() => [{ value: 'all', label: 'All triggers' },
        ...[...new Set((flows ?? []).flatMap(flow => (flow.triggers ?? []).map(item => item.kind)))].map(kind => ({ value: kind, label: TRIGGER_KINDS[kind]?.label ?? kind }))], [flows]);
    const shown = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return sortFlows((flows ?? []).filter(flow => matchesStatus(flow, status)
            && (triggerKind === 'all' || (flow.triggers ?? []).some(item => item.kind === triggerKind))
            && (!needle || `${flow.name} ${flow.description ?? ''} ${(flow.tags ?? []).join(' ')}`.toLowerCase().includes(needle))), sortBy);
    }, [flows, status, triggerKind, query, sortBy]);
    const ready = Boolean(flows && runs && counts && week);

    return <div className="h-full min-h-0 overflow-y-auto custom-scrollbar">
        <input ref={file} type="file" accept=".yaml,.yml,.json" hidden onChange={event => { const picked = event.target.files?.[0]; event.target.value = ''; if (picked) onImport(picked); }} />
        <div className="mx-auto w-full max-w-[1400px] space-y-5 px-6 py-6">
            {/* Hero: what this place is, in one line, with what a workflow can use */}
            <header className="relative overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-6 py-6">
                <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-[var(--accent-color)]/10 blur-3xl" />
                <div className="relative flex items-center justify-between gap-6">
                    <div className="min-w-0">
                        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-[var(--text-primary)]"><Workflow className="h-7 w-7" /> Automation</h1>
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">Build, run and manage workflows that get work done by themselves.</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                            {CAN.map(item => <span key={item.label} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-1 text-xs text-[var(--text-secondary)]">
                                <item.icon className="h-3.5 w-3.5" />{item.label}</span>)}
                        </div>
                    </div>
                    <div className="hidden shrink-0 items-center gap-3 md:flex">
                        <Button size="icon" variant="ghost" title="Refresh" aria-label="Refresh" onClick={() => void refresh()}><RefreshCw className="h-4 w-4" /></Button>
                        <CluaizLogo size={96} glow />
                    </div>
                </div>
            </header>

            {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
            {!error && !ready && <p role="status" className="text-sm text-[var(--text-secondary)]">Reading workflows…</p>}

            {ready && <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="min-w-0 space-y-5">
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <Stat icon={Workflow} value={counts!.on} label="Active workflows" hint={`${counts!.total} saved`} onClick={() => { setSection('workflows'); setStatus(status === 'on' ? 'all' : 'on'); }} active={status === 'on'} />
                        <Stat icon={Activity} value={counts!.runsToday} label="Runs (24h)" hint="last 7 days" bars={week!.all} onClick={() => setSection('runs')} />
                        <Stat icon={CheckCircle2} value={counts!.successRate === null ? '—' : `${counts!.successRate}%`} label="Success rate" hint={`${counts!.finishedCount} finished runs`} bars={week!.ok} onClick={() => setSection('runs')} />
                        <Stat icon={TriangleAlert} value={counts!.failedToday} label="Failed (24h)" hint="last 7 days" bars={week!.failed} bad={counts!.failedToday > 0} onClick={() => setSection('runs')} />
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <Action primary icon={Plus} title="Create workflow" text="Start on an empty canvas" onClick={onNew} />
                        <Action icon={Upload} title="Import" text="From a .yaml or .json flow file" onClick={() => file.current?.click()} />
                        <Action icon={History} title="Run history" text="Every run, step by step" onClick={() => setSection('runs')} />
                    </div>

                    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border-color)]">
                        <Tabs variant="underline" bordered={false} items={[{ id: 'workflows', label: 'Workflows', count: flows!.length }, { id: 'runs', label: 'Runs', count: runs!.length }]}
                            value={section} onChange={setSection} />
                    </div>

                    {section === 'runs'
                        ? <RunList runs={runs!} busy={busy} onRerun={(record, step) => void rerunFrom(record, step)} />
                        : flows!.length === 0
                            ? <FirstWorkflow onNew={onNew} onImport={() => file.current?.click()} />
                            : <>
                                <div className="flex flex-wrap items-center gap-2">
                                    <label className="flex min-w-[160px] flex-1 items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 focus-within:border-[var(--accent-color)]">
                                        <Search className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                                        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search workflows" aria-label="Search workflows"
                                            className="w-full min-w-0 border-0 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder-[var(--text-muted)]" />
                                    </label>
                                    <CustomDropdown className="w-40" options={STATUS} value={status} onChange={value => setStatus(value as StatusFilter)} />
                                    <CustomDropdown className="w-40" options={triggerOptions} value={triggerKind} onChange={setTriggerKind} />
                                    <CustomDropdown className="w-44" options={SORT} value={sortBy} onChange={value => setSortBy(value as SortBy)} />
                                </div>
                                <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
                                    <div className={`${ROW_GRID} border-b border-[var(--border-color)] px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]`}>
                                        <span>Workflow</span><span className="hidden lg:block">Trigger</span><span className="hidden lg:block">Last run</span><span className="hidden lg:block">Runs (24h)</span><span className="text-right">Status</span>
                                    </div>
                                    {shown.length === 0
                                        ? <p className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">No workflow matches these filters.</p>
                                        : shown.map(flow => <WorkflowRow key={flowKey(flow)} flow={flow} flowId={flowKey(flow)} today={today.get(flowKey(flow)) ?? 0} busy={busy}
                                            onToggle={(item, enabled) => void setEnabled(item, enabled)} onRun={item => void run(item)} onOpen={onOpen} onRemove={onRemove} />)}
                                </section>
                            </>}
                </div>

                <aside className="space-y-5">
                    <RecentRuns runs={runs!} onAll={() => setSection('runs')} />
                    <Health problems={counts!.problems} waiting={counts!.waiting} failedToday={counts!.failedToday} />
                </aside>
            </div>}
        </div>
    </div>;
}

function Stat({ icon: Icon, value, label, hint, bars, bad, active, onClick }: {
    icon: typeof Workflow; value: number | string; label: string; hint: string; bars?: number[]; bad?: boolean; active?: boolean; onClick: () => void;
}) {
    return <button type="button" onClick={onClick} aria-pressed={active}
        className={`flex flex-col gap-3 rounded-2xl border bg-[var(--bg-secondary)] p-4 text-left transition-colors cursor-pointer hover:border-[var(--accent-color)]/40 ${active ? 'border-[var(--accent-color)]/60' : 'border-[var(--border-color)]'}`}>
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

/** No workflows yet: what a workflow is, in three steps, and two ways to get the first one */
function FirstWorkflow({ onNew, onImport }: { onNew: () => void; onImport: () => void }) {
    const steps = [
        { icon: Play, title: 'Something happens', text: 'A time, a new file, a webhook, an event, or you press Run.' },
        { icon: Hammer, title: 'Cluaiz does the steps', text: 'Ask a model, use your tools, read and write files, wait for your OK.' },
        { icon: CheckCircle2, title: 'You get the result', text: 'A note, a file, a message. Every run is recorded.' },
    ];
    return <section className="rounded-2xl border border-dashed border-[var(--border-color)] p-8 text-center">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">No workflows yet</h2>
        <p className="mx-auto mt-1 max-w-xl text-sm text-[var(--text-secondary)]">A workflow is a small job that runs by itself. Build it once; it runs every time its moment comes.</p>
        <ol className="mx-auto mt-6 grid max-w-3xl gap-3 text-left md:grid-cols-3">
            {steps.map((step, index) => <li key={step.title} className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4">
                <span className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]"><step.icon className="h-4 w-4 text-[var(--text-secondary)]" /> Step {index + 1}</span>
                <span className="mt-2 block text-sm font-semibold text-[var(--text-primary)]">{step.title}</span>
                <span className="mt-1 block text-xs text-[var(--text-secondary)]">{step.text}</span>
            </li>)}
        </ol>
        <div className="mt-6 flex justify-center gap-2">
            <Button onClick={onNew}><Plus className="mr-1 h-4 w-4" /> Create workflow</Button>
            <Button variant="outline" onClick={onImport}><Upload className="mr-1 h-4 w-4" /> Import a file</Button>
        </div>
    </section>;
}

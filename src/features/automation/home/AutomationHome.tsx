import { useMemo, useState } from 'react';
import { ArrowRight, CalendarClock, FolderOpen, Plus, RefreshCw, Search, Sparkles, Webhook, Workflow, Zap } from 'lucide-react';
import { Tabs } from '../../../components/ui/Tabs';
import { Button } from '../../../components/ui/Button';
import type { FlowSummary } from '../../../api/engine/automation';
import { RunList } from '../RunList';
import { flowKey, type useFlows } from '../useFlows';
import { WorkflowRow, ROW_GRID } from './WorkflowRow';
import { matchesFilter, summary, type HomeFilter } from './homeText';

type Flows = ReturnType<typeof useFlows>;

const FILTERS: { id: HomeFilter; label: string }[] = [
    { id: 'all', label: 'All' }, { id: 'on', label: 'On' }, { id: 'off', label: 'Off' }, { id: 'problems', label: 'Needs attention' },
];

/**
 * The first page of Automation. The person sees at once what is on, what ran and what failed, then the list of
 * workflows with what starts each one. No chat here: the chat opens only inside a workflow.
 */
export function AutomationHome({ data, onOpen, onNew, onRemove }: {
    data: Flows; onOpen: (flow: FlowSummary) => void; onNew: () => void; onRemove: (flow: FlowSummary) => void;
}) {
    const { flows, runs, error, busy, refresh, setEnabled, run, rerunFrom } = data;
    const [section, setSection] = useState<'workflows' | 'runs'>('workflows');
    const [filter, setFilter] = useState<HomeFilter>('all');
    const [query, setQuery] = useState('');
    const counts = useMemo(() => flows && runs ? summary(flows, runs) : null, [flows, runs]);
    const shown = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return (flows ?? []).filter(flow => matchesFilter(flow, filter)
            && (!needle || `${flow.name} ${flow.description ?? ''} ${(flow.tags ?? []).join(' ')}`.toLowerCase().includes(needle)));
    }, [flows, filter, query]);
    const ready = Boolean(flows && runs);
    const empty = ready && flows!.length === 0;

    return <div className="flex h-full min-h-0 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[var(--border-color)]/80 px-6">
            <div className="flex min-w-0 items-baseline gap-3">
                <h1 className="text-base font-semibold text-[var(--text-primary)]">Automation</h1>
                <p className="hidden truncate text-xs text-[var(--text-muted)] sm:block">Workflows that do a job by themselves when something happens</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
                <Button size="icon" variant="ghost" title="Refresh" aria-label="Refresh" onClick={() => void refresh()}><RefreshCw className="h-4 w-4" /></Button>
                {!empty && <Button size="sm" onClick={onNew}><Plus className="mr-1 h-4 w-4" /> New workflow</Button>}
            </div>
        </header>

        <main className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="mx-auto w-full max-w-6xl space-y-6 px-6 py-6">
                {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
                {!error && !ready && <p role="status" className="text-sm text-[var(--text-secondary)]">Reading workflows…</p>}

                {empty && <EmptyHome onNew={onNew} />}

                {ready && !empty && counts && <>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        <Stat label="On" value={counts.on} hint="running on their trigger" active={filter === 'on'} onClick={() => { setSection('workflows'); setFilter(filter === 'on' ? 'all' : 'on'); }} />
                        <Stat label="Off" value={counts.off} hint="saved, not running" active={filter === 'off'} onClick={() => { setSection('workflows'); setFilter(filter === 'off' ? 'all' : 'off'); }} />
                        <Stat label="Runs, last 24 hours" value={counts.runsToday} hint={counts.running ? `${counts.running} running now` : 'none running now'} onClick={() => setSection('runs')} />
                        <Stat label="Failed, last 24 hours" value={counts.failedToday} tone={counts.failedToday ? 'bad' : undefined} hint={counts.failedToday ? 'open Runs to see why' : 'all good'} onClick={() => setSection('runs')} />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <Tabs variant="underline" bordered={false} items={[{ id: 'workflows', label: 'Workflows', count: flows!.length }, { id: 'runs', label: 'Runs', count: runs!.length }]}
                            value={section} onChange={setSection} />
                        {section === 'workflows' && <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center rounded-lg border border-[var(--border-color)] p-0.5">
                                {FILTERS.map(item => <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}
                                    className={`rounded-md px-2.5 py-1 text-xs transition-colors cursor-pointer ${filter === item.id ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>{item.label}</button>)}
                            </div>
                            <label className="flex w-56 items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-2.5 py-1.5 focus-within:border-[var(--accent-color)]">
                                <Search className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
                                <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search workflows" aria-label="Search workflows"
                                    className="w-full min-w-0 border-0 bg-transparent text-xs text-[var(--text-primary)] outline-none placeholder-[var(--text-muted)]" />
                            </label>
                        </div>}
                    </div>

                    {section === 'runs'
                        ? <RunList runs={runs!} busy={busy} onRerun={(record, step) => void rerunFrom(record, step)} />
                        : <section className="overflow-visible rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
                            <div className={`${ROW_GRID} border-b border-[var(--border-color)] px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]`}>
                                <span>Workflow</span><span className="hidden md:block">Starts when</span><span className="hidden md:block">Last run</span><span className="text-right">On · Run</span>
                            </div>
                            {shown.length === 0
                                ? <p className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">No workflow matches.</p>
                                : shown.map(flow => <WorkflowRow key={flowKey(flow)} flow={flow} flowId={flowKey(flow)} busy={busy}
                                    onToggle={(item, enabled) => void setEnabled(item, enabled)} onRun={item => void run(item)} onOpen={onOpen} onRemove={onRemove} />)}
                        </section>}
                </>}
            </div>
        </main>
    </div>;
}

function Stat({ label, value, hint, tone, active, onClick }: { label: string; value: number; hint: string; tone?: 'bad'; active?: boolean; onClick: () => void }) {
    return <button type="button" onClick={onClick} aria-pressed={active}
        className={`rounded-xl border bg-[var(--bg-secondary)] px-4 py-3 text-left transition-colors cursor-pointer hover:border-[var(--accent-color)]/40 ${active ? 'border-[var(--accent-color)]/60' : 'border-[var(--border-color)]'}`}>
        <div className="text-xs text-[var(--text-muted)]">{label}</div>
        <div className={`mt-1 text-2xl font-semibold tabular-nums ${tone === 'bad' ? 'text-red-400' : 'text-[var(--text-primary)]'}`}>{value}</div>
        <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">{hint}</div>
    </button>;
}

const STEPS = [
    { icon: Zap, title: 'When something happens', text: 'A time, a new file, a webhook, an event, or you press Run.' },
    { icon: Workflow, title: 'Cluaiz does the steps', text: 'Ask a model, use your tools, read and write files, wait for your OK.' },
    { icon: Sparkles, title: 'You get the result', text: 'A note, a file, a message. Every run is recorded.' },
];
const IDEAS = [
    { icon: CalendarClock, text: 'Every morning at 8, summarize the news into my notes' },
    { icon: FolderOpen, text: 'When a PDF lands in Downloads, write a short summary of it' },
    { icon: Webhook, text: 'When a webhook arrives, let an agent answer it' },
];

/** First visit: what a workflow is, in three steps, examples of what people automate, and one way to start */
function EmptyHome({ onNew }: { onNew: () => void }) {
    return <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-8">
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">Let your computer do the repeating work</h2>
        <p className="mt-1 max-w-2xl text-sm text-[var(--text-secondary)]">A workflow is a small job that runs by itself. You build it once; it runs every time its moment comes.</p>

        <ol className="mt-6 grid gap-3 md:grid-cols-3">
            {STEPS.map((step, index) => <li key={step.title} className="relative rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-4">
                <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-color)]/10 text-[var(--accent-color)]"><step.icon className="h-4 w-4" /></span>
                    <span className="text-[11px] font-medium text-[var(--text-muted)]">Step {index + 1}</span>
                </div>
                <h3 className="mt-3 text-sm font-semibold text-[var(--text-primary)]">{step.title}</h3>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">{step.text}</p>
                {index < STEPS.length - 1 && <ArrowRight aria-hidden className="absolute -right-3 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-[var(--text-muted)] md:block" />}
            </li>)}
        </ol>

        <div className="mt-6">
            <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">What people automate</h3>
            <ul className="mt-2 space-y-1.5">
                {IDEAS.map(idea => <li key={idea.text} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                    <idea.icon className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />{idea.text}
                </li>)}
            </ul>
        </div>

        <Button className="mt-6" onClick={onNew}><Plus className="mr-1 h-4 w-4" /> Create your first workflow</Button>
    </section>;
}

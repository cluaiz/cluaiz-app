import { useMemo, useState } from 'react';
import { Plus, RefreshCw, Workflow } from 'lucide-react';
import { WorkspaceHeader } from '../../../components/layout/WorkspaceHeader';
import { Tabs } from '../../../components/ui/Tabs';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import type { FlowSummary } from '../../../api/engine/automation';
import { RunList } from '../RunList';
import { flowKey, type useFlows } from '../useFlows';
import { WorkflowCard } from './WorkflowCard';

type Flows = ReturnType<typeof useFlows>;

/**
 * The first page of Automation: the person's workflows as cards, and their runs. No chat here; the chat opens
 * only inside a workflow. Templates join this page in the next step.
 */
export function AutomationHome({ data, onOpen, onNew, onRemove }: {
    data: Flows; onOpen: (flow: FlowSummary) => void; onNew: () => void; onRemove: (flow: FlowSummary) => void;
}) {
    const { flows, runs, error, busy, refresh, setEnabled, run, rerunFrom } = data;
    const [section, setSection] = useState<'workflows' | 'runs'>('workflows');
    const [query, setQuery] = useState('');
    const shown = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return (flows ?? []).filter(flow => !needle || `${flow.name} ${flow.description ?? ''} ${(flow.tags ?? []).join(' ')}`.toLowerCase().includes(needle));
    }, [flows, query]);
    const loading = !error && (!flows || !runs);

    return <div className="flex h-full min-h-0 flex-col">
        <WorkspaceHeader icon={Workflow} title="Automation" description="Work that runs by itself: on a time, a file, a webhook or an event." />
        <main className="flex-1 space-y-5 overflow-y-auto p-5 custom-scrollbar">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <Tabs items={[{ id: 'workflows', label: 'Workflows', count: flows?.length }, { id: 'runs', label: 'Runs', count: runs?.length }]}
                    value={section} onChange={setSection} />
                <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={() => void refresh()}><RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh</Button>
                    <Button size="sm" onClick={onNew}><Plus className="mr-1 h-3.5 w-3.5" /> New workflow</Button>
                </div>
            </div>

            {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
            {loading && <p role="status" className="text-sm text-[var(--text-secondary)]">Reading workflows…</p>}

            {flows && runs && section === 'runs' && <RunList runs={runs} busy={busy} onRerun={(record, step) => void rerunFrom(record, step)} />}

            {flows && runs && section === 'workflows' && (flows.length === 0
                ? <EmptyHome onNew={onNew} />
                : <>
                    {flows.length > 6 && <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search workflows" className="max-w-sm" />}
                    {shown.length === 0
                        ? <p className="text-sm text-[var(--text-secondary)]">No workflow matches "{query}".</p>
                        : <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
                            {shown.map(flow => <WorkflowCard key={flowKey(flow)} flow={flow} flowId={flowKey(flow)} busy={busy}
                                onToggle={(item, enabled) => void setEnabled(item, enabled)} onRun={item => void run(item)} onOpen={onOpen} onRemove={onRemove} />)}
                        </div>}
                </>)}
        </main>
    </div>;
}

/** No workflows yet: what Automation is for, in plain words, and one clear way to start */
function EmptyHome({ onNew }: { onNew: () => void }) {
    return <section className="mx-auto flex max-w-lg flex-col items-center gap-3 rounded-xl border border-dashed border-[var(--border-color)] px-6 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--accent-color)]/25 bg-[var(--accent-color)]/10 text-[var(--accent-color)]">
            <Workflow className="h-6 w-6" />
        </div>
        <h2 className="text-base font-semibold text-[var(--text-primary)]">No workflows yet</h2>
        <p className="text-sm text-[var(--text-secondary)]">
            A workflow does a job for you when something happens: every morning, when a file arrives, when a webhook is called.
            It can use your models, tools and files.
        </p>
        <Button onClick={onNew}><Plus className="mr-1 h-4 w-4" /> New workflow</Button>
    </section>;
}

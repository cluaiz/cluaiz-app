import { useMemo, useState } from 'react';
import { FolderInput, Plus, Power, PowerOff, Search, Trash2, Upload, X } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { CustomDropdown } from '../../../components/ui/dropdown/CustomDropdown';
import type { FlowSummary } from '../../../api/engine/automation';
import { TRIGGER_KINDS } from '../model/kinds';
import { flowKey } from '../useFlows';
import { WorkflowRow, ROW_GRID, type WorkflowActions } from '../home/WorkflowRow';
import { matchesStatus, runsToday, sortFlows, type SortBy, type StatusFilter } from '../home/homeText';
import { FolderTree, type FolderPick } from '../folders/FolderTree';
import { folderTree } from '../folders/flowFolders';
import type { FlowRun } from '../../../api/engine/automation';

const STATUS = [{ value: 'all', label: 'All statuses' }, { value: 'on', label: 'On' }, { value: 'off', label: 'Off' }, { value: 'problems', label: 'Needs attention' }];
const SORT = [{ value: 'updated', label: 'Recently updated' }, { value: 'last_run', label: 'Last run' }, { value: 'name', label: 'Name' }];
const PAGE = 100;

/**
 * Every workflow, organized: a folder tree on the left (folders live in each file's `meta.folder`), search, status,
 * trigger and sort filters, a table that draws 100 rows at a time, and bulk actions on the selected rows.
 */
export function WorkflowsPage({ flows, runs, folders, reading, actions, onNew, onImport, onBulk }: {
    flows: FlowSummary[]; runs: FlowRun[]; folders: Record<string, string>; reading: number;
    actions: WorkflowActions; onNew: () => void; onImport: () => void;
    onBulk: (kind: 'on' | 'off' | 'remove', flows: FlowSummary[]) => void;
}) {
    const [folder, setFolder] = useState<FolderPick>(null);
    const [status, setStatus] = useState<StatusFilter>('all');
    const [triggerKind, setTriggerKind] = useState('all');
    const [sortBy, setSortBy] = useState<SortBy>('updated');
    const [query, setQuery] = useState('');
    const [limit, setLimit] = useState(PAGE);
    const [picked, setPicked] = useState<Set<string>>(new Set());

    const tree = useMemo(() => folderTree(folders), [folders]);
    const today = useMemo(() => runsToday(runs), [runs]);
    const triggerOptions = useMemo(() => [{ value: 'all', label: 'All triggers' },
        ...[...new Set(flows.flatMap(flow => (flow.triggers ?? []).map(item => item.kind)))].map(kind => ({ value: kind, label: kind === 'tool' ? 'Agent in chat' : TRIGGER_KINDS[kind]?.label ?? kind }))], [flows]);
    const shown = useMemo(() => {
        const needle = query.trim().toLowerCase();
        const inFolder = (flow: FlowSummary) => {
            const at = folders[flowKey(flow)] ?? '';
            return folder === null || (folder === '' ? !at : at === folder || at.startsWith(`${folder}/`));
        };
        return sortFlows(flows.filter(flow => inFolder(flow) && matchesStatus(flow, status)
            && (triggerKind === 'all' || (flow.triggers ?? []).some(item => item.kind === triggerKind))
            && (!needle || `${flow.name} ${flow.description ?? ''} ${(flow.tags ?? []).join(' ')} ${folders[flowKey(flow)] ?? ''}`.toLowerCase().includes(needle))), sortBy);
    }, [flows, folders, folder, status, triggerKind, query, sortBy]);
    const selected = flows.filter(flow => picked.has(flowKey(flow)));
    const allShownPicked = shown.length > 0 && shown.every(flow => picked.has(flowKey(flow)));
    const toggle = (key: string, on: boolean) => setPicked(old => { const next = new Set(old); if (on) next.add(key); else next.delete(key); return next; });
    const bulk = (kind: 'on' | 'off' | 'remove') => { onBulk(kind, selected); setPicked(new Set()); };

    return <div className="grid min-h-0 gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-0 lg:self-start">
            <FolderTree tree={tree} total={flows.length} unfiled={flows.filter(flow => !folders[flowKey(flow)]).length} value={folder} reading={reading}
                onPick={pick => { setFolder(pick); setLimit(PAGE); }} />
        </aside>

        <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                <label className="flex min-w-[180px] flex-1 items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 focus-within:border-[var(--accent-color)]">
                    <Search className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                    <input value={query} onChange={event => { setQuery(event.target.value); setLimit(PAGE); }} placeholder="Search name, description, tag or folder" aria-label="Search workflows"
                        className="w-full min-w-0 border-0 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder-[var(--text-muted)]" />
                </label>
                <CustomDropdown className="w-40" options={STATUS} value={status} onChange={value => setStatus(value as StatusFilter)} />
                <CustomDropdown className="w-40" options={triggerOptions} value={triggerKind} onChange={setTriggerKind} />
                <CustomDropdown className="w-44" options={SORT} value={sortBy} onChange={value => setSortBy(value as SortBy)} />
                <Button size="sm" variant="outline" onClick={onImport}><Upload className="mr-1 h-4 w-4" /> Import</Button>
                <Button size="sm" onClick={onNew}><Plus className="mr-1 h-4 w-4" /> New workflow</Button>
            </div>

            {selected.length > 0 && <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--accent-color)]/40 bg-[var(--accent-color)]/5 px-3 py-2 text-sm">
                <span className="font-medium text-[var(--text-primary)]">{selected.length} selected</span>
                <span className="mx-1 h-4 w-px bg-[var(--border-color)]" />
                <Button size="sm" variant="ghost" onClick={() => actions.onMove(selected)}><FolderInput className="mr-1 h-4 w-4" /> Move to folder</Button>
                <Button size="sm" variant="ghost" onClick={() => bulk('on')}><Power className="mr-1 h-4 w-4" /> Turn on</Button>
                <Button size="sm" variant="ghost" onClick={() => bulk('off')}><PowerOff className="mr-1 h-4 w-4" /> Turn off</Button>
                <Button size="sm" variant="ghost" className="text-red-400" onClick={() => bulk('remove')}><Trash2 className="mr-1 h-4 w-4" /> Remove</Button>
                <Button size="icon" variant="ghost" className="ml-auto" aria-label="Clear selection" onClick={() => setPicked(new Set())}><X className="h-4 w-4" /></Button>
            </div>}

            <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
                <div className={`${ROW_GRID} border-b border-[var(--border-color)] px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]`}>
                    <input type="checkbox" checked={allShownPicked} aria-label="Select all shown"
                        onChange={event => setPicked(event.target.checked ? new Set(shown.slice(0, limit).map(flowKey)) : new Set())}
                        className="h-4 w-4 cursor-pointer accent-[var(--accent-color)]" />
                    <span>Workflow · {shown.length}</span><span className="hidden lg:block">Trigger</span><span className="hidden lg:block">Last run</span><span className="hidden lg:block">Runs 24h</span><span className="text-right">Status</span>
                </div>
                {shown.length === 0
                    ? <p className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">{flows.length ? 'No workflow matches these filters.' : 'No workflows yet.'}</p>
                    : shown.slice(0, limit).map(flow => <WorkflowRow key={flowKey(flow)} flow={flow} flowId={flowKey(flow)} folder={folder === null ? folders[flowKey(flow)] ?? '' : ''}
                        today={today.get(flowKey(flow)) ?? 0} selected={picked.has(flowKey(flow))} onSelect={on => toggle(flowKey(flow), on)} {...actions} />)}
                {shown.length > limit && <div className="border-t border-[var(--border-color)]/60 p-3 text-center">
                    <Button size="sm" variant="ghost" onClick={() => setLimit(limit + PAGE)}>Show {Math.min(PAGE, shown.length - limit)} more of {shown.length - limit}</Button>
                </div>}
            </section>
        </div>
    </div>;
}

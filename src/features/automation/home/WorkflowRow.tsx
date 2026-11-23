import { useRef, useState } from 'react';
import { CheckCircle2, CircleAlert, Clock3, MoreHorizontal, Pencil, Play, Trash2, Workflow, XCircle } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { ToggleSwitch } from '../../../components/ui/ToggleSwitch';
import { ActionDropdown, ActionDropdownItem } from '../../../components/ui/dropdown/ActionDropdown';
import type { FlowSummary } from '../../../api/engine/automation';
import { TRIGGER_KINDS } from '../model/kinds';
import { ago, errorsOf } from './homeText';

export interface WorkflowActions {
    busy: string | null;
    onToggle: (flow: FlowSummary, enabled: boolean) => void;
    onRun: (flow: FlowSummary) => void;
    onOpen: (flow: FlowSummary) => void;
    onRemove: (flow: FlowSummary) => void;
}

const LAST: Record<string, { icon: typeof CheckCircle2; tone: string; word: string }> = {
    succeeded: { icon: CheckCircle2, tone: 'text-emerald-400', word: 'Worked' },
    failed: { icon: XCircle, tone: 'text-red-400', word: 'Failed' },
    waiting: { icon: Clock3, tone: 'text-amber-400', word: 'Waiting' },
};

/** Shared columns of the header and every row, so they line up */
export const ROW_GRID = 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.1fr)_70px_auto]';

/** The first trigger's icon stands for the workflow; a plain workflow icon when it has none */
function FlowIcon({ kind }: { kind?: string }) {
    const view = kind ? TRIGGER_KINDS[kind] : undefined;
    const Icon = view?.icon ?? Workflow;
    return <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-secondary)]"><Icon className="h-4 w-4" /></span>;
}

/** One workflow: what it is, what starts it, how its last run went, how often it ran today, and its controls */
export function WorkflowRow({ flow, flowId, today, busy, onToggle, onRun, onOpen, onRemove }: WorkflowActions & { flow: FlowSummary; flowId: string; today: number }) {
    const [menu, setMenu] = useState(false);
    const trigger = useRef<HTMLButtonElement>(null);
    const errors = errorsOf(flow);
    const starts = [...new Set((flow.triggers ?? []).map(item => item.kind))];
    const nextAt = flow.triggers?.map(item => item.next_at).filter(Boolean).sort()[0];
    const locked = Boolean(busy);
    const last = flow.last_run;
    const look = last ? LAST[last.status] : undefined;

    return <div className={`${ROW_GRID} group border-b border-[var(--border-color)]/60 px-4 py-3 transition-colors last:border-b-0 hover:bg-[var(--bg-tertiary)]/40`}>
        <button type="button" onClick={() => onOpen(flow)} className="flex min-w-0 items-center gap-3 text-left cursor-pointer">
            <FlowIcon kind={starts[0]} />
            <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-color)]">{flow.name}</span>
                <span className="block truncate text-xs text-[var(--text-muted)]">
                    {errors.length ? <span className="inline-flex items-center gap-1 text-red-400"><CircleAlert className="h-3 w-3" />{errors[0].message}</span> : flow.description || 'No description'}
                </span>
            </span>
        </button>

        <div className="hidden min-w-0 flex-wrap items-center gap-1.5 lg:flex">
            {starts.length === 0 && <span className="text-xs text-[var(--text-muted)]">Not set</span>}
            {starts.map(kind => {
                const view = TRIGGER_KINDS[kind];
                const Icon = view?.icon;
                return <span key={kind} className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-color)] px-2 py-0.5 text-xs text-[var(--text-secondary)]">
                    {Icon && <Icon className="h-3.5 w-3.5" />}{view?.label ?? kind}
                </span>;
            })}
        </div>

        <div className="hidden min-w-0 items-center gap-2 text-xs lg:flex">
            {look ? <look.icon className={`h-4 w-4 shrink-0 ${look.tone}`} /> : null}
            <span className="min-w-0">
                <span className="block text-[var(--text-secondary)]">{last ? `${look?.word ?? last.status} ${ago(last.finished_at)}` : 'Never run'}</span>
                {flow.enabled && nextAt && <span className="block text-[var(--text-muted)]">Next {ago(nextAt)}</span>}
            </span>
        </div>

        <div className="hidden text-sm tabular-nums text-[var(--text-primary)] lg:block" title="Runs in the last 24 hours">{today}</div>

        <div className="flex items-center gap-1.5">
            <ToggleSwitch active={flow.enabled} loading={busy === flowId} disabled={locked || errors.length > 0}
                onToggle={() => onToggle(flow, !flow.enabled)} />
            <span className="hidden w-6 text-xs text-[var(--text-muted)] xl:inline">{flow.enabled ? 'On' : 'Off'}</span>
            <Button size="icon" variant="outline" title="Run now" aria-label={`Run ${flow.name} now`} disabled={locked || errors.length > 0} onClick={() => onRun(flow)}>
                <Play className="h-3.5 w-3.5" />
            </Button>
            <Button ref={trigger} size="icon" variant="ghost" aria-label={`More for ${flow.name}`} aria-expanded={menu} disabled={locked} onClick={() => setMenu(!menu)}>
                <MoreHorizontal className="h-4 w-4" />
            </Button>
            <ActionDropdown isOpen={menu} onClose={() => setMenu(false)} floating triggerRef={trigger} className="w-44">
                <ActionDropdownItem icon={<Pencil size={14} />} onClick={() => { setMenu(false); onOpen(flow); }}>Open</ActionDropdownItem>
                <ActionDropdownItem danger icon={<Trash2 size={14} />} onClick={() => { setMenu(false); onRemove(flow); }}>Remove</ActionDropdownItem>
            </ActionDropdown>
        </div>
    </div>;
}

import { useRef, useState } from 'react';
import { CircleAlert, MoreHorizontal, Pencil, Play, Trash2 } from 'lucide-react';
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

const RUN_TONE: Record<string, string> = {
    succeeded: 'text-emerald-400', failed: 'text-red-400', running: 'text-[var(--accent-color)]', queued: 'text-[var(--accent-color)]',
};

/** Shared column layout of the header and every row, so they line up */
export const ROW_GRID = 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1.3fr)_auto]';

/** One workflow: what it is, what starts it, how its last run went and when it runs next, and its controls */
export function WorkflowRow({ flow, flowId, busy, onToggle, onRun, onOpen, onRemove }: WorkflowActions & { flow: FlowSummary; flowId: string }) {
    const [menu, setMenu] = useState(false);
    const trigger = useRef<HTMLButtonElement>(null);
    const errors = errorsOf(flow);
    const starts = [...new Set((flow.triggers ?? []).map(item => item.kind))];
    const nextAt = flow.triggers?.map(item => item.next_at).filter(Boolean).sort()[0];
    const locked = Boolean(busy);
    const last = flow.last_run;

    return <div className={`${ROW_GRID} group border-b border-[var(--border-color)]/60 px-4 py-3 transition-colors last:border-b-0 hover:bg-[var(--bg-tertiary)]/40`}>
        <button type="button" onClick={() => onOpen(flow)} className="flex min-w-0 items-center gap-3 text-left cursor-pointer">
            <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${errors.length ? 'bg-red-400' : flow.enabled ? 'bg-emerald-400' : 'bg-[var(--text-muted)]/50'}`} />
            <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-color)]">{flow.name}</span>
                <span className="block truncate text-xs text-[var(--text-muted)]">
                    {errors.length ? <span className="inline-flex items-center gap-1 text-red-400"><CircleAlert className="h-3 w-3" />{errors[0].message}</span> : flow.description || 'No description'}
                </span>
            </span>
        </button>

        <div className="hidden min-w-0 flex-wrap items-center gap-1.5 md:flex">
            {starts.length === 0 && <span className="text-xs text-[var(--text-muted)]">Not set</span>}
            {starts.map(kind => {
                const view = TRIGGER_KINDS[kind];
                const Icon = view?.icon;
                return <span key={kind} className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                    {Icon && <Icon className={`h-3.5 w-3.5 ${view.tint}`} />}{view?.label ?? kind}
                </span>;
            })}
        </div>

        <div className="hidden min-w-0 text-xs md:block">
            {last
                ? <span className={RUN_TONE[last.status] ?? 'text-[var(--text-secondary)]'}>{last.status === 'succeeded' ? 'Worked' : last.status === 'failed' ? 'Failed' : last.status} <span className="text-[var(--text-muted)]">{ago(last.finished_at)}</span></span>
                : <span className="text-[var(--text-muted)]">Never run</span>}
            {flow.enabled && nextAt && <span className="block text-[var(--text-muted)]">Next {ago(nextAt)}</span>}
        </div>

        <div className="flex items-center gap-1">
            <ToggleSwitch active={flow.enabled} loading={busy === flowId} disabled={locked || errors.length > 0}
                onToggle={() => onToggle(flow, !flow.enabled)} />
            <Button size="icon" variant="ghost" title="Run now" aria-label={`Run ${flow.name} now`} disabled={locked || errors.length > 0} onClick={() => onRun(flow)}>
                <Play className="h-4 w-4" />
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

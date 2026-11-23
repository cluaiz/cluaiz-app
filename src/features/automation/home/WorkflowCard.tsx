import { useRef, useState } from 'react';
import { MoreHorizontal, Pencil, Play, Trash2, TriangleAlert } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { ToggleSwitch } from '../../../components/ui/ToggleSwitch';
import { ActionDropdown, ActionDropdownItem } from '../../../components/ui/dropdown/ActionDropdown';
import type { FlowSummary } from '../../../api/engine/automation';
import { TRIGGER_KINDS } from '../model/kinds';
import { RunStatusBadge, when } from '../RunStatusBadge';

export interface WorkflowActions {
    busy: string | null;
    onToggle: (flow: FlowSummary, enabled: boolean) => void;
    onRun: (flow: FlowSummary) => void;
    onOpen: (flow: FlowSummary) => void;
    onRemove: (flow: FlowSummary) => void;
}

/** One workflow on the Home page: what starts it in plain words, when it ran and runs next, on/off, Run, and a menu */
export function WorkflowCard({ flow, flowId, busy, onToggle, onRun, onOpen, onRemove }: WorkflowActions & { flow: FlowSummary; flowId: string }) {
    const [menu, setMenu] = useState(false);
    const trigger = useRef<HTMLButtonElement>(null);
    const errors = flow.problems?.filter(problem => problem.severity === 'error') ?? [];
    const starts = [...new Set((flow.triggers ?? []).map(item => item.kind))];
    const nextAt = flow.triggers?.map(item => item.next_at).filter(Boolean).sort()[0];
    const locked = Boolean(busy);

    return <article className="group flex flex-col gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 transition-colors hover:border-[var(--accent-color)]/40">
        <div className="flex items-start justify-between gap-3">
            <button type="button" onClick={() => onOpen(flow)} className="min-w-0 flex-1 text-left cursor-pointer">
                <h3 className="truncate text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-color)]">{flow.name}</h3>
                <p className="mt-0.5 line-clamp-2 text-xs text-[var(--text-secondary)]">{flow.description || 'No description yet.'}</p>
            </button>
            <ToggleSwitch active={flow.enabled} loading={busy === flowId} disabled={locked || errors.length > 0}
                onToggle={() => onToggle(flow, !flow.enabled)} />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
            {starts.length === 0 && <span className="text-xs text-[var(--text-muted)]">No trigger</span>}
            {starts.map(kind => {
                const view = TRIGGER_KINDS[kind];
                const Icon = view?.icon;
                return <span key={kind} className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-0.5 text-xs text-[var(--text-secondary)]">
                    {Icon && <Icon className={`h-3.5 w-3.5 ${view.tint}`} />}{view?.label ?? kind}
                </span>;
            })}
            <span className="rounded-md px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{flow.scope}</span>
        </div>

        {errors.length > 0 && <p role="alert" className="flex items-start gap-1.5 text-xs text-red-400">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-2">{errors.length === 1 ? errors[0].message : `${errors.length} problems. Open it to fix them.`}</span>
        </p>}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-color)]/60 pt-3 text-xs text-[var(--text-secondary)]">
            <div className="min-w-0 space-y-0.5">
                <div className="flex flex-wrap items-center gap-1.5">
                    {flow.last_run ? <>Last run <RunStatusBadge status={flow.last_run.status} /> {when(flow.last_run.finished_at)}</> : 'Never run'}
                </div>
                {flow.enabled && nextAt && <div className="text-[var(--text-muted)]">Next {when(nextAt)}</div>}
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-1">
                <Button size="sm" variant="outline" disabled={locked || errors.length > 0} onClick={() => onRun(flow)}>
                    <Play className="mr-1 h-3.5 w-3.5" /> Run
                </Button>
                <Button ref={trigger} size="icon" variant="ghost" aria-label={`More for ${flow.name}`} aria-expanded={menu} disabled={locked} onClick={() => setMenu(!menu)}>
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
                <ActionDropdown isOpen={menu} onClose={() => setMenu(false)} floating triggerRef={trigger} className="w-44">
                    <ActionDropdownItem icon={<Pencil size={14} />} onClick={() => { setMenu(false); onOpen(flow); }}>Open</ActionDropdownItem>
                    <ActionDropdownItem danger icon={<Trash2 size={14} />} onClick={() => { setMenu(false); onRemove(flow); }}>Remove</ActionDropdownItem>
                </ActionDropdown>
            </div>
        </div>
    </article>;
}

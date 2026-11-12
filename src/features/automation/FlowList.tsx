import { Pencil, Play, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ToggleSwitch } from '../../components/ui/ToggleSwitch';
import type { FlowSummary } from '../../api/engine/automation';
import { RunStatusBadge, when } from './RunStatusBadge';
import { flowKey } from './useFlows';

interface FlowListProps {
    flows: FlowSummary[];
    busy: string | null;
    onToggle: (flow: FlowSummary, enabled: boolean) => void;
    onRun: (flow: FlowSummary) => void;
    onEdit: (flow: FlowSummary) => void;
    onRemove: (flow: FlowSummary) => void;
}

export function FlowList({ flows, busy, onToggle, onRun, onEdit, onRemove }: FlowListProps) {
    if (!flows.length) {
        return <p className="text-sm text-[var(--text-secondary)]">No flows yet. Save a flow file with <code>cluaiz flow</code> or the <code>flows.save</code> method and it shows here.</p>;
    }
    return <div className="grid gap-4 md:grid-cols-2">
        {flows.map(flow => {
            const key = flowKey(flow);
            const errors = flow.problems?.filter(problem => problem.severity === 'error') ?? [];
            const nextAt = flow.triggers?.find(trigger => trigger.next_at)?.next_at;
            return <Card key={key}>
                <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                            <CardTitle className="truncate">{flow.name}</CardTitle>
                            {flow.description && <CardDescription>{flow.description}</CardDescription>}
                        </div>
                        <ToggleSwitch active={flow.enabled} loading={busy === key} disabled={Boolean(busy) || errors.length > 0}
                            onToggle={() => onToggle(flow, !flow.enabled)} />
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
                        <Badge variant="outline">{flow.scope}</Badge>
                        {flow.triggers?.map(trigger => <Badge key={trigger.id} variant="secondary">{trigger.kind}</Badge>)}
                        {flow.tags?.map(tag => <Badge key={tag} variant="outline">#{tag}</Badge>)}
                    </div>
                    {errors.map((problem, index) => <p key={index} role="alert" className="text-xs text-red-400">
                        {problem.line ? `Line ${problem.line}: ` : ''}{problem.message}
                    </p>)}
                    <div className="flex items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
                        <span className="space-y-1">
                            <span className="flex flex-wrap items-center gap-2">
                                {flow.last_run ? <>Last run <RunStatusBadge status={flow.last_run.status} /> {when(flow.last_run.finished_at)}</> : 'Never run'}
                            </span>
                            {nextAt && <span className="block">Next {when(nextAt)}</span>}
                        </span>
                        <span className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" title="Edit" disabled={Boolean(busy)} onClick={() => onEdit(flow)}><Pencil className="w-3.5 h-3.5" /></Button>
                            <Button size="sm" variant="ghost" title="Remove" disabled={Boolean(busy)} onClick={() => onRemove(flow)}><Trash2 className="w-3.5 h-3.5" /></Button>
                            <Button size="sm" variant="outline" disabled={Boolean(busy) || errors.length > 0} onClick={() => onRun(flow)}>
                                <Play className="w-3.5 h-3.5 mr-1" /> Run
                            </Button>
                        </span>
                    </div>
                </CardContent>
            </Card>;
        })}
    </div>;
}

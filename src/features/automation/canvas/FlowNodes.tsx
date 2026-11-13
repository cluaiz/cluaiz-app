import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { CheckCircle2, CircleSlash, Loader2, PauseCircle, Play, Plus, SkipForward, TriangleAlert, XCircle } from 'lucide-react';
import { Tooltip } from '../../../components/ui/tooltip';
import { STEP_KINDS, TRIGGER_KINDS, type KindView } from '../model/kinds';
import { NODE_SIZE } from '../model/layout';
import type { StepData, TriggerData } from '../model/flowGraph';
import type { InsertAt } from '../model/flowDoc';
import { sameInsert, useCanvas, type StepStatus } from './canvasContext';

const STATUS: Record<StepStatus, { icon: typeof Play; className: string; ring: string; label: string }> = {
    succeeded: { icon: CheckCircle2, className: 'text-green-400', ring: 'border-green-500/60', label: 'Succeeded' },
    failed: { icon: XCircle, className: 'text-red-400', ring: 'border-red-500/70', label: 'Failed' },
    running: { icon: Loader2, className: 'text-[var(--accent-color)] animate-spin', ring: 'border-[var(--accent-color)]', label: 'Running' },
    waiting: { icon: PauseCircle, className: 'text-amber-400', ring: 'border-amber-500/60', label: 'Waiting' },
    skipped: { icon: SkipForward, className: 'text-[var(--text-muted)]', ring: 'border-[var(--border-color)] opacity-70', label: 'Skipped' },
    cancelled: { icon: CircleSlash, className: 'text-[var(--text-muted)]', ring: 'border-[var(--border-color)]', label: 'Cancelled' },
};

const shell = (selected: boolean, ring: string) =>
    `relative h-full bg-[var(--bg-secondary)] border transition-[border-color,box-shadow] duration-150 shadow-sm ${
        selected ? 'border-[var(--accent-color)] shadow-[0_0_0_3px_var(--accent-glow)]' : ring || 'border-[var(--border-color)] hover:border-[var(--text-muted)]/60'}`;

function KindIcon({ view }: { view: KindView }) {
    const Icon = view.icon;
    return <div className="w-9 h-9 shrink-0 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] flex items-center justify-center">
        <Icon className={`w-[18px] h-[18px] ${view.tint}`} />
    </div>;
}

function Problems({ id }: { id: string }) {
    const problems = useCanvas().problems[id];
    if (!problems?.length) return null;
    const errors = problems.filter(problem => problem.severity === 'error').length;
    return <Tooltip className="!absolute -top-2 -right-2" title={errors ? `${errors} problem${errors === 1 ? '' : 's'}` : 'Warnings'} subtitle={problems.map(problem => problem.message).join('\n')}>
        <span className={`flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold bg-[var(--bg-primary)] ${
            errors ? 'border-red-500/60 text-red-400' : 'border-amber-500/60 text-amber-400'}`}>
            <TriangleAlert className="w-3 h-3" />{problems.length}
        </span>
    </Tooltip>;
}

const REVIEW = {
    added: { ring: 'border-green-500/70 shadow-[0_0_0_3px_rgb(34_197_94_/_0.15)]', pill: 'border-green-500/50 text-green-400', label: 'new' },
    changed: { ring: 'border-amber-500/70 shadow-[0_0_0_3px_rgb(245_158_11_/_0.15)]', pill: 'border-amber-500/50 text-amber-400', label: 'changed' },
};

/** The ring of a node: a change under review first, then its run state */
function useRing(id: string) {
    const { review, statuses } = useCanvas();
    const mark = review[id];
    return { ring: mark ? REVIEW[mark].ring : statuses[id] ? STATUS[statuses[id]].ring : '', mark, status: statuses[id] };
}

function ReviewPill({ mark }: { mark?: keyof typeof REVIEW }) {
    if (!mark) return null;
    return <span className={`absolute -top-2 left-3 rounded-full border bg-[var(--bg-primary)] px-1.5 text-[9px] leading-4 font-semibold ${REVIEW[mark].pill}`}>{REVIEW[mark].label}</span>;
}

function StatusMark({ status }: { status?: StepStatus }) {
    if (!status) return null;
    const { icon: Icon, className, label } = STATUS[status];
    return <Icon className={`w-3.5 h-3.5 shrink-0 ${className}`} aria-label={label} />;
}

/** A step: its kind, name and what it does; branching kinds send along one handle per branch */
export const StepNode = memo(({ id, data, selected }: NodeProps<Node<StepData>>) => {
    const { ring, mark, status } = useRing(id);
    const view = STEP_KINDS[data.kind];
    const branches = data.outlets.filter(outlet => outlet.tone !== 'error');
    const error = data.outlets.find(outlet => outlet.tone === 'error');
    return <div className={`${shell(selected, ring)} rounded-xl`} style={NODE_SIZE.step}>
        <ReviewPill mark={mark} />
        <Handle type="target" position={Position.Top} />
        {data.loops && <Handle type="target" id="loop" position={Position.Left} />}
        <div className="flex items-start gap-3 p-3">
            <KindIcon view={view} />
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] truncate">{view.label}</span>
                    <StatusMark status={status} />
                </div>
                <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate leading-tight mt-0.5">{data.title}</div>
                {data.detail && <div className="text-[11px] font-mono text-[var(--text-muted)] truncate mt-0.5">{data.detail}</div>}
            </div>
        </div>
        {data.marks.length > 0 && <div className="absolute left-3 right-3 bottom-1.5 flex gap-1 overflow-hidden">
            {data.marks.map(mark => <span key={mark} className="shrink-0 rounded-md bg-[var(--bg-tertiary)] border border-[var(--border-color)] px-1.5 text-[9px] leading-4 text-[var(--text-secondary)]">{mark}</span>)}
        </div>}
        {branches.length ? branches.map((outlet, index) => {
            const left = `${((index + 1) / (branches.length + 1)) * 100}%`;
            return <div key={outlet.id}>
                <Handle type="source" id={outlet.id} position={Position.Bottom} style={{ left }} />
                <span className={`absolute top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-full border px-1.5 text-[9px] leading-4 bg-[var(--bg-primary)] pointer-events-none ${
                    outlet.tone === 'loop' ? 'border-orange-500/40 text-orange-400' : 'border-[var(--border-color)] text-[var(--text-secondary)]'}`} style={{ left }}>
                    {outlet.label}
                </span>
            </div>;
        }) : <Handle type="source" position={Position.Bottom} />}
        {error && <Handle type="source" id={error.id} position={Position.Right} className="!border-red-400" />}
        <Problems id={id} />
    </div>;
});

/** A trigger: what starts the flow */
export const TriggerNode = memo(({ id, data, selected }: NodeProps<Node<TriggerData>>) => {
    const view = TRIGGER_KINDS[data.kind];
    const { ring, mark } = useRing(id);
    return <div className={`${shell(selected, ring)} rounded-l-[32px] rounded-r-xl ${data.off ? 'opacity-50' : ''}`} style={NODE_SIZE.trigger}>
        <ReviewPill mark={mark} />
        <div className="flex items-center gap-3 h-full pl-3 pr-3">
            <KindIcon view={view} />
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Trigger{data.off && <span className="rounded bg-[var(--bg-tertiary)] px-1 normal-case tracking-normal">off</span>}
                </div>
                <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{data.title}</div>
                {data.detail && <div className="text-[11px] font-mono text-[var(--text-muted)] truncate">{data.detail}</div>}
            </div>
        </div>
        <Handle type="source" position={Position.Bottom} />
        <Problems id={id} />
    </div>;
});

/** Where a flow without triggers starts, and where its failure steps start */
export const StartNode = memo(({ data }: NodeProps<Node<{ label: string }>>) =>
    <div className="h-full flex items-center justify-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[11px] font-medium text-[var(--text-secondary)]"
        style={NODE_SIZE.start}>
        <Play className="w-3.5 h-3.5 text-[var(--accent-color)]" />{data.label}
        <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </div>);

/** The end of a list: a step can be added here */
export const AddNode = memo(({ data }: NodeProps<Node<{ at: InsertAt }>>) => {
    const { onInsert, insertTarget } = useCanvas();
    const active = sameInsert(insertTarget, data.at);
    return <button type="button" title="Add a step here" onClick={event => { event.stopPropagation(); onInsert(data.at); }}
        className={`nodrag flex items-center justify-center rounded-full border border-dashed cursor-pointer transition-colors ${
            active ? 'border-[var(--accent-color)] text-[var(--accent-color)] bg-[var(--accent-glow)]'
                : 'border-[var(--text-muted)]/60 text-[var(--text-muted)] bg-[var(--bg-secondary)] hover:border-[var(--accent-color)] hover:text-[var(--accent-color)]'}`}
        style={NODE_SIZE.add}>
        <Handle type="target" position={Position.Top} isConnectable={false} />
        <Plus className="w-4 h-4" />
    </button>;
});

export const NODE_TYPES = { step: StepNode, trigger: TriggerNode, start: StartNode, add: AddNode };

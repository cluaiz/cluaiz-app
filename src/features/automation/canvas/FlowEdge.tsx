import { memo } from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type Edge, type EdgeProps } from '@xyflow/react';
import { Plus, X } from 'lucide-react';
import type { GraphEdge } from '../model/flowGraph';
import { sameInsert, useCanvas } from './canvasContext';

const STROKE: Record<GraphEdge['kind'], React.CSSProperties> = {
    next: {},
    branch: {},
    needs: { strokeDasharray: '5 4' },
    loop: { strokeDasharray: '3 4', opacity: 0.8 },
    error: { stroke: 'rgb(248 113 113 / 0.75)' },
};

const button = 'nodrag nopan w-5 h-5 rounded-full border flex items-center justify-center cursor-pointer transition-all bg-[var(--bg-secondary)]';

/** A line between steps: rounded corners, its branch's name, and a "+" that puts a step on it */
export const FlowEdge = memo(({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, selected, data }: EdgeProps<Edge<{ edge: GraphEdge }>>) => {
    const { onInsert, onRemoveNeed, insertTarget } = useCanvas();
    const edge = data?.edge;
    const [path, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 14, offset: 22 });
    const active = sameInsert(insertTarget, edge?.insert);
    return <>
        <BaseEdge id={id} path={path} markerEnd={markerEnd}
            style={{ ...(edge ? STROKE[edge.kind] : {}), ...((selected || active) && { stroke: 'var(--accent-color)' }) }} />
        <EdgeLabelRenderer>
            <div className="absolute flex items-center gap-1 pointer-events-auto group"
                style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}>
                {edge?.insert && <button type="button" title="Add a step here" onClick={() => onInsert(edge.insert!)}
                    className={`${button} ${active ? 'border-[var(--accent-color)] text-[var(--accent-color)] opacity-100'
                        : 'border-[var(--border-color)] text-[var(--text-muted)] opacity-50 hover:opacity-100 hover:border-[var(--accent-color)] hover:text-[var(--accent-color)]'}`}>
                    <Plus className="w-3 h-3" />
                </button>}
                {edge?.need && <button type="button" title="Stop waiting for this step" onClick={() => onRemoveNeed(edge)}
                    className={`${button} border-red-500/40 text-red-400 opacity-50 hover:opacity-100`}>
                    <X className="w-3 h-3" />
                </button>}
            </div>
        </EdgeLabelRenderer>
    </>;
});

export const EDGE_TYPES = { flow: FlowEdge };

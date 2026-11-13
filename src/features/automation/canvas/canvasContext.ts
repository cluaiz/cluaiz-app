import { createContext, useContext } from 'react';
import type { FlowProblem } from '../../../api/engine/automation';
import type { InsertAt } from '../model/flowDoc';
import type { GraphEdge, ReviewMark } from '../model/flowGraph';

/** A step's state in the run shown on the canvas */
export type StepStatus = 'succeeded' | 'failed' | 'running' | 'waiting' | 'skipped' | 'cancelled';

/** What nodes and edges read and do, without passing callbacks through React Flow's data */
export interface CanvasContext {
    statuses: Record<string, StepStatus>;
    problems: Record<string, FlowProblem[]>;
    insertTarget: InsertAt | null;
    /** Steps a change from the chat added or changed, until the owner keeps or undoes it */
    review: Record<string, ReviewMark>;
    onInsert: (at: InsertAt) => void;
    onRemoveNeed: (edge: GraphEdge) => void;
}

export const FlowCanvasContext = createContext<CanvasContext>({
    statuses: {}, problems: {}, insertTarget: null, review: {}, onInsert: () => {}, onRemoveNeed: () => {},
});

export const useCanvas = () => useContext(FlowCanvasContext);

export const sameInsert = (a: InsertAt | null, b: InsertAt | null | undefined) =>
    Boolean(a && b && a.index === b.index && a.list.join('/') === b.list.join('/'));

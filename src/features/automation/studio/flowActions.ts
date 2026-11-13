import type { Document } from 'yaml';
import { copyWithIds, freshId, insertStep, moveAt, removeAt, setStepId, setValue, stepIds, valueAt, type FlowPath, type FlowValue, type InsertAt } from '../model/flowDoc';
import type { FlowGraph, GraphEdge, GraphNode } from '../model/flowGraph';
import { STEP_KINDS, TRIGGER_KINDS } from '../model/kinds';
import type { PaletteItem } from './NodePalette';

type Edit = (doc: Document) => void;
const all = (...edits: Edit[]): Edit => doc => edits.forEach(edit => edit(doc));
const isObject = (value: unknown): value is FlowValue => value !== null && typeof value === 'object' && !Array.isArray(value);
const pathOf = (node?: GraphNode) => node && (node.type === 'step' || node.type === 'trigger') ? node.data.path : null;

/** A new step or trigger from the palette, with an id no other step has */
export function paletteValue(item: PaletteItem, flow: FlowValue): { trigger: boolean; value: FlowValue } {
    if (item.type === 'trigger') return { trigger: true, value: structuredClone(TRIGGER_KINDS[item.kind].template) };
    const used = stepIds(flow);
    if (item.type === 'step') return { trigger: false, value: { id: freshId(item.kind, used), ...structuredClone(STEP_KINDS[item.kind].template) } };
    const name = item.node.ref.split(/[/.:]/).filter(Boolean).pop() ?? item.node.step;
    return { trigger: false, value: { id: freshId(name, used), [item.node.step]: item.node.ref, with: {} } };
}

/** Where a picked step goes: the "+" pressed, else after the selected step, else at the end */
export function insertPlace(target: InsertAt | null, selected: GraphNode | undefined, flow: FlowValue): InsertAt {
    if (target) return target;
    const path = selected?.type === 'step' ? selected.data.path : null;
    if (path) return { list: path.slice(0, -1), index: Number(path[path.length - 1]) + 1 };
    return { list: ['steps'], index: Array.isArray(flow.steps) ? flow.steps.length : 0 };
}

export const addItem = (at: InsertAt, item: { trigger: boolean; value: FlowValue }, flow: FlowValue): Edit =>
    insertStep(item.trigger ? { list: ['on'], index: Array.isArray(flow.on) ? flow.on.length : 0 } : at, item.value);

/** A step's id as written, writing one first when the Engine made it from its place */
function ensureId(node: GraphNode, flow: FlowValue, used: Set<string>, edits: Edit[]): string | null {
    if (node.type !== 'step') return null;
    const step = valueAt(flow, node.data.path);
    if (isObject(step) && typeof step.id === 'string') return step.id;
    const id = freshId(node.data.kind, used);
    used.add(id);
    edits.push(setStepId(node.data.path, id));
    return id;
}

/**
 * Drawing a line from one step to another: the target waits for it (`needs`). A step without `needs` waited for
 * the step above it, so that one is written in too and nothing it waited for is lost.
 */
export function connect(graph: FlowGraph, flow: FlowValue, sourceId: string, targetId: string): Edit | null {
    const source = graph.nodes.find(node => node.id === sourceId), target = graph.nodes.find(node => node.id === targetId);
    if (!source || target?.type !== 'step') return null;
    const used = stepIds(flow), edits: Edit[] = [];
    const sourceKey = ensureId(source, flow, used, edits);
    if (!sourceKey) return null;
    const path = target.data.path;
    const step = valueAt(flow, path);
    const needs = isObject(step) && Array.isArray(step.needs) ? step.needs.filter((id): id is string => typeof id === 'string') : [];
    const index = Number(path[path.length - 1]);
    if (!needs.length && index > 0) {
        const above = graph.nodes.find(node => node.type === 'step' && node.data.path.join('/') === [...path.slice(0, -1), index - 1].join('/'));
        const aboveKey = above && ensureId(above, flow, used, edits);
        if (aboveKey && aboveKey !== sourceKey) needs.push(aboveKey);
    }
    if (needs.includes(sourceKey)) return null;
    edits.push(setValue([...path, 'needs'], [...needs, sourceKey]));
    return all(...edits);
}

/** The target stops waiting for that step; with nothing left it waits for the step above again */
export function removeNeed(edge: GraphEdge, flow: FlowValue): Edit | null {
    if (!edge.need) return null;
    const step = valueAt(flow, edge.need.path);
    const needs = isObject(step) && Array.isArray(step.needs) ? step.needs.filter(id => id !== edge.need!.id) : [];
    return setValue([...edge.need.path, 'needs'], needs.length ? needs : undefined);
}

/** Removes steps and triggers, the later ones of a list first so earlier places stay right */
export function removeNodes(graph: FlowGraph, ids: string[]): Edit {
    const paths = ids.map(id => pathOf(graph.nodes.find(node => node.id === id))).filter((path): path is FlowPath => Boolean(path));
    paths.sort((a, b) => b.join('/').localeCompare(a.join('/'), undefined, { numeric: true }));
    return all(...paths.map(removeAt));
}

export function duplicate(node: GraphNode, flow: FlowValue): Edit | null {
    const path = pathOf(node);
    if (!path) return null;
    const copy = node.type === 'step' ? copyWithIds(valueAt(flow, path), stepIds(flow)) : structuredClone(valueAt(flow, path));
    return insertStep({ list: path.slice(0, -1), index: Number(path[path.length - 1]) + 1 }, copy);
}

export const move = (node: GraphNode, delta: number): Edit | null => { const path = pathOf(node); return path ? moveAt(path, delta) : null; };

/** Forgets every place the owner moved a node to, so the layout places them all again */
export const tidy = (flow: FlowValue): Edit => {
    const ui = isObject(flow.ui) ? flow.ui : {};
    const mine = isObject(ui.cluaiz) ? ui.cluaiz : {};
    const keepsMine = Object.keys(mine).some(key => key !== 'positions');
    const keepsUi = Object.keys(ui).some(key => key !== 'cluaiz');
    return setValue(keepsMine ? ['ui', 'cluaiz', 'positions'] : keepsUi ? ['ui', 'cluaiz'] : ['ui'], undefined);
};

/** Places the owner moved nodes to, kept in the file's `ui.cluaiz.positions` */
export function pinnedPositions(flow: FlowValue | null): Record<string, { x: number; y: number }> {
    const stored = valueAt(flow, ['ui', 'cluaiz', 'positions']);
    if (!isObject(stored)) return {};
    return Object.fromEntries(Object.entries(stored).filter(([, at]) => isObject(at) && typeof at.x === 'number' && typeof at.y === 'number')
        .map(([id, at]) => [id, { x: (at as { x: number }).x, y: (at as { y: number }).y }]));
}

import { STEP_KINDS, stepKind, TRIGGER_KINDS, triggerKind } from './kinds';
import { pointerOf, type FlowPath, type FlowValue, type InsertAt } from './flowDoc';

/** A source handle a step sends along: a branch of `if`/`switch`/`parallel`, a loop's body, or its error steps */
export interface Outlet { id: string; label: string; tone?: 'error' | 'loop' }

export interface StepData {
    kind: string; stepId: string; title: string; detail: string; path: FlowPath;
    /** Small facts shown under the title: retry, timeout, when, approval… */
    marks: string[];
    outlets: Outlet[];
    /** `each` and `repeat`: their body comes back to them */
    loops: boolean;
    [key: string]: unknown;
}
export interface TriggerData { kind: string; title: string; detail: string; path: FlowPath; off: boolean; [key: string]: unknown }

export type GraphNode =
    | { id: string; type: 'step'; data: StepData }
    | { id: string; type: 'trigger'; data: TriggerData }
    | { id: string; type: 'start'; data: { label: string } }
    | { id: string; type: 'add'; data: { at: InsertAt } };

export type EdgeKind = 'next' | 'needs' | 'branch' | 'loop' | 'error';
export interface GraphEdge {
    id: string; source: string; target: string; kind: EdgeKind;
    sourceHandle?: string; targetHandle?: string; label?: string;
    /** Where a step put on this edge goes */
    insert?: InsertAt;
    /** A `needs` edge: removing it takes this id out of that step's `needs` */
    need?: { path: FlowPath; id: string };
}

export interface FlowGraph {
    nodes: GraphNode[]; edges: GraphEdge[];
    /** The pointer of every step and trigger → its node, to place the Engine's problems */
    pointers: Map<string, string>;
}

/** Where a list hands on to whatever comes after it */
interface Exit { node: string; handle?: string; label?: string; insert: InsertAt }

const isObject = (value: unknown): value is FlowValue => value !== null && typeof value === 'object' && !Array.isArray(value);
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const text = (value: unknown, max = 70): string => {
    const raw = typeof value === 'string' ? value : value === undefined ? '' : JSON.stringify(value);
    const flat = raw.replace(/\s+/g, ' ').trim();
    return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

/** The id the Engine gives a step without one (`format/mod.rs`: `_2`, `_on_error.0`, `parent.then.0`) */
export const generatedId = (parent: string | null, part: string, index: number) =>
    parent ? `${parent}.${part}.${index}` : part === 'steps' ? `_${index}` : `_${part}.${index}`;

function detail(kind: string, step: FlowValue): string {
    const value = step[kind];
    switch (kind) {
        case 'tool': case 'call': case 'code': case 'run': case 'emit': case 'approve': case 'fail': case 'ask': case 'agent':
            return text(value);
        case 'if': case 'return': return text(value);
        case 'each': return `${text(value, 40)} as ${typeof step.as === 'string' ? step.as : 'item'}`;
        case 'repeat': return `until ${text(step.until, 40)} · at most ${text(step.max)}`;
        case 'switch': return `${list(value).length} cases${step.default ? ' and a default' : ''}`;
        case 'parallel': return isObject(value) ? Object.keys(value).join(' · ') : '';
        case 'set': return isObject(value) ? Object.keys(value).join(', ') : '';
        case 'wait': return isObject(value) ? Object.entries(value).map(([key, item]) => `${key} ${text(item, 30)}`).join(' · ') : text(value);
        default: return '';
    }
}

function marks(step: FlowValue): string[] {
    const out: string[] = [];
    if (step.when !== undefined) out.push('when');
    if (isObject(step.retry)) out.push(`retry ×${text(step.retry.max)}`);
    if (step.timeout) out.push(`timeout ${text(step.timeout)}`);
    if (step.approve_before) out.push('asks first');
    if (step.on_error === 'continue') out.push('goes on after errors');
    if (step.secret_output) out.push('secret');
    return out;
}

function triggerDetail(kind: string, trigger: FlowValue): string {
    const value = trigger[kind];
    if (kind === 'webhook') return 'POST /v1/hooks/…';
    if (kind === 'file' && isObject(value)) return `${text(value.path, 40)}${value.glob ? ` · ${text(value.glob)}` : ''}`;
    if (kind === 'poll' && isObject(value)) return `${text(value.tool ?? value.call, 40)} · every ${text(value.every)}`;
    if (kind === 'tool' && isObject(value)) return text(value.title ?? value.description);
    return isObject(value) ? '' : text(value);
}

/** The flow as nodes and edges: triggers on top, each list top to bottom, branches side by side */
export function flowGraph(flow: FlowValue): FlowGraph {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const pointers = new Map<string, string>();
    const byId = new Map<string, string>();
    const pendingNeeds: { target: string; path: FlowPath; ids: string[] }[] = [];
    let edgeCount = 0;
    const edge = (value: Omit<GraphEdge, 'id'>) => edges.push({ id: `e${edgeCount++}`, ...value });
    const join = (from: Exit[], target: string, kind: EdgeKind = 'next') => from.forEach(exit =>
        edge({ source: exit.node, target, kind: exit.handle && kind === 'next' ? 'branch' : kind, sourceHandle: exit.handle, label: exit.label, insert: exit.insert }));

    /** Walks a list; returns where it hands on. An empty list hands on its entry, so new steps go into it. */
    const walk = (steps: unknown[], path: FlowPath, parent: string | null, part: string, entry: Exit[]): Exit[] => {
        let previous = entry;
        /** Ends no later step waits for (the step after them names its own `needs`): they end the list too */
        const loose: Exit[] = [];
        steps.forEach((raw, index) => {
            const kind = stepKind(raw);
            if (!kind || !isObject(raw)) return;
            const stepPath = [...path, index];
            const id = typeof raw.id === 'string' ? raw.id : generatedId(parent, part, index);
            const outlets: Outlet[] = [];
            const view = STEP_KINDS[kind];
            const node: GraphNode = { id, type: 'step', data: {
                kind, stepId: id, path: stepPath, outlets, loops: kind === 'each' || kind === 'repeat', marks: marks(raw),
                title: typeof raw.name === 'string' ? raw.name : typeof raw.id === 'string' ? raw.id : view.label,
                detail: detail(kind, raw),
            } };
            nodes.push(node);
            byId.set(id, id);
            pointers.set(pointerOf(stepPath), id);
            const needs = list(raw.needs).filter((need): need is string => typeof need === 'string');
            if (needs.length) { pendingNeeds.push({ target: id, path: stepPath, ids: needs }); if (index) loose.push(...previous); }
            else join(previous, id);

            const after: InsertAt = { list: path, index: index + 1 };
            const branch = (handle: string, label: string, field: FlowPath, steps: unknown, part: string, tone?: Outlet['tone']): Exit[] => {
                outlets.push({ id: handle, label, tone });
                const into: Exit = { node: id, handle, label, insert: { list: [...stepPath, ...field], index: 0 } };
                return walk(list(steps), [...stepPath, ...field], id, part, [into]);
            };
            let exits: Exit[] = [{ node: id, insert: after }];
            if (kind === 'if') exits = [...branch('then', 'then', ['then'], raw.then, 'then'), ...branch('else', 'else', ['else'], raw.else, 'else')];
            else if (kind === 'switch') {
                exits = list(raw.switch).flatMap((item, at) => {
                    const name = isObject(item) && typeof item.name === 'string' ? item.name : `case ${at + 1}`;
                    return branch(`case-${at}`, name, ['switch', at, 'do'], isObject(item) ? item.do : [], `switch.${at}.do`);
                });
                exits.push(...branch('default', 'default', ['default'], raw.default, 'default'));
            } else if (kind === 'parallel' && isObject(raw.parallel)) {
                exits = Object.entries(raw.parallel).flatMap(([name, steps]) =>
                    branch(`branch-${name}`, name, ['parallel', name], steps, `parallel.${name}`));
            } else if (kind === 'each' || kind === 'repeat') {
                const field = kind === 'each' ? 'do' : 'repeat';
                const body = branch('do', kind === 'each' ? 'each item' : 'each round', [field], raw[field], field, 'loop');
                if (body.every(exit => exit.node === id)) {
                    const ghost = `add:${id}`;
                    nodes.push({ id: ghost, type: 'add', data: { at: body[0].insert } });
                    join(body, ghost);
                } else body.forEach(exit => edge({ source: exit.node, target: id, kind: 'loop', sourceHandle: exit.handle,
                    targetHandle: 'loop', insert: exit.insert }));
                outlets.push({ id: 'done', label: 'done' });
                exits = [{ node: id, handle: 'done', label: 'done', insert: after }];
            }
            if (Array.isArray(raw.on_error)) branch('error', 'on error', ['on_error'], raw.on_error, 'on_error', 'error');
            previous = exits;
        });
        return [...previous, ...loose];
    };

    const triggers = list(flow.on);
    const entry: Exit[] = [];
    triggers.forEach((raw, index) => {
        const kind = triggerKind(raw);
        if (!kind || !isObject(raw)) return;
        const id = `trigger:${index}`;
        nodes.push({ id, type: 'trigger', data: {
            kind, path: ['on', index], off: raw.enabled === false, detail: triggerDetail(kind, raw),
            title: typeof raw.id === 'string' ? raw.id : TRIGGER_KINDS[kind].label,
        } });
        pointers.set(pointerOf(['on', index]), id);
        entry.push({ node: id, insert: { list: ['steps'], index: 0 } });
    });
    if (!entry.length) {
        nodes.push({ id: 'start', type: 'start', data: { label: 'Started by hand' } });
        entry.push({ node: 'start', insert: { list: ['steps'], index: 0 } });
    }
    const steps = list(flow.steps);
    const ends = walk(steps, ['steps'], null, 'steps', entry);
    const add: InsertAt = { list: ['steps'], index: steps.length };
    nodes.push({ id: 'add', type: 'add', data: { at: add } });
    join(ends, 'add');

    if (Array.isArray(flow.on_error) && flow.on_error.length) {
        nodes.push({ id: 'failure', type: 'start', data: { label: 'When the run fails' } });
        walk(flow.on_error, ['on_error'], null, 'on_error', [{ node: 'failure', insert: { list: ['on_error'], index: 0 } }]);
    }
    for (const { target, path, ids } of pendingNeeds) {
        ids.forEach(need => {
            if (byId.has(need)) edge({ source: need, target, kind: 'needs', need: { path, id: need } });
        });
    }
    return { nodes, edges, pointers };
}

/** What the chat gets when asked about a step or trigger: the whole file as it is now, and which part is meant (the chat fences it) */
export function askContext(text: string, flow: string, node: GraphNode, lines: string | null): string {
    const what = node.type === 'step' ? `the ${node.data.kind} step "${node.data.stepId}"` : node.type === 'trigger' ? `the ${node.data.kind} trigger` : 'the flow';
    return [`# The Cluaiz Automation flow "${flow}" (cluaiz.flow/1). The question is about ${what}${lines ? ` at lines ${lines}` : ''}.`,
        '# To suggest a change, answer with the whole changed flow file in one yaml code block.', text.trimEnd()].join('\n');
}

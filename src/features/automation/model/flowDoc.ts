import { isMap, isSeq, LineCounter, parseDocument, stringify, type Document } from 'yaml';
import type { FlowFormat } from '../../../api/engine/automation';

/** A place in the flow file: keys and list indexes from the top (`['steps', 1, 'then', 0]`) */
export type FlowPath = (string | number)[];
export type FlowValue = Record<string, unknown>;

/** Where a new step goes: a step list of the file and the index in it */
export interface InsertAt { list: FlowPath; index: number }

const isObject = (value: unknown): value is FlowValue => value !== null && typeof value === 'object' && !Array.isArray(value);

/** The file read as data, or why it cannot be (JSON is read as YAML 1.2, which it is) */
export function readFlow(text: string): { value: FlowValue | null; error: string } {
    const doc = parseDocument(text);
    if (doc.errors.length) return { value: null, error: doc.errors[0].message };
    const value = doc.toJS();
    return isObject(value) ? { value, error: '' } : { value: null, error: 'The file is not a flow: it must be an object' };
}

const write = (doc: Document, format: FlowFormat) =>
    format === 'json' ? `${JSON.stringify(doc.toJS(), null, 2)}\n` : doc.toString({ lineWidth: 0 });

/** One change to the file. YAML keeps its comments and order; JSON is written again, as JSON has no comments. */
export function editFlow(text: string, format: FlowFormat, change: (doc: Document) => void): string {
    const doc = parseDocument(text);
    if (doc.errors.length) throw new Error(doc.errors[0].message);
    change(doc);
    return write(doc, format);
}

/** Sets a value; `undefined` removes it */
export const setValue = (path: FlowPath, value: unknown) => (doc: Document) => {
    if (value === undefined) doc.deleteIn(path);
    else doc.setIn(path, doc.createNode(value));
};

/** Puts a step into a list, making the list when it is not there yet */
export const insertStep = (at: InsertAt, step: unknown) => (doc: Document) => {
    const list = doc.getIn(at.list, true);
    if (isSeq(list)) list.items.splice(Math.min(at.index, list.items.length), 0, doc.createNode(step));
    else doc.setIn(at.list, doc.createNode([step]));
};

export const removeAt = (path: FlowPath) => (doc: Document) => { doc.deleteIn(path); };

/** Moves a list item up (-1) or down (+1) inside its list */
export const moveAt = (path: FlowPath, delta: number) => (doc: Document) => {
    const list = doc.getIn(path.slice(0, -1), true);
    const from = Number(path[path.length - 1]), to = from + delta;
    if (!isSeq(list) || to < 0 || to >= list.items.length) return;
    const [item] = list.items.splice(from, 1);
    list.items.splice(to, 0, item);
};

/** Gives a step an id first in its keys, as people write them */
export const setStepId = (path: FlowPath, id: string) => (doc: Document) => {
    const step = doc.getIn(path, true);
    if (!isMap(step)) return;
    step.delete('id');
    step.items.unshift(doc.createPair('id', id));
};

/** Every id written in the file, so a new one never repeats one */
export function stepIds(value: unknown, into = new Set<string>()): Set<string> {
    if (Array.isArray(value)) value.forEach(item => stepIds(item, into));
    else if (isObject(value)) {
        if (typeof value.id === 'string') into.add(value.id);
        Object.values(value).forEach(item => stepIds(item, into));
    }
    return into;
}

/** An id the Engine accepts (letters, digits, _; a letter first) that the flow does not use yet */
export function freshId(base: string, used: Set<string>): string {
    const stem = base.replace(/[^A-Za-z0-9_]/g, '_').replace(/^[^A-Za-z]+/, '') || 'step';
    if (!used.has(stem)) return stem;
    let n = 2;
    while (used.has(`${stem}_${n}`)) n += 1;
    return `${stem}_${n}`;
}

/** A copy of a step with ids of its own, for every step inside it too */
export function copyWithIds(step: unknown, used: Set<string>): unknown {
    if (Array.isArray(step)) return step.map(item => copyWithIds(item, used));
    if (!isObject(step)) return step;
    const copy: FlowValue = {};
    for (const [key, value] of Object.entries(step)) {
        if (key === 'id' && typeof value === 'string') { const id = freshId(value, used); used.add(id); copy.id = id; }
        else copy[key] = copyWithIds(value, used);
    }
    return copy;
}

export const valueAt = (value: unknown, path: FlowPath): unknown =>
    path.reduce<unknown>((at, key) => (at !== null && typeof at === 'object' ? (at as Record<string | number, unknown>)[key] : undefined), value);

/** One part of the file as YAML text, for its editor */
export const toYaml = (value: unknown) => value === undefined ? '' : stringify(value, { lineWidth: 0 });

/** The lines a place of the file covers (`L12-L20`), so the chat can be pointed at them */
export function lineRange(text: string, path: FlowPath): string | null {
    const lines = new LineCounter();
    const doc = parseDocument(text, { lineCounter: lines });
    const node = doc.getIn(path, true) as { range?: [number, number, number] } | undefined;
    if (!node?.range) return null;
    const start = lines.linePos(node.range[0]).line;
    const end = lines.linePos(Math.max(node.range[0], node.range[1] - 1)).line;
    return start === end ? `L${start}` : `L${start}-L${end}`;
}

/** The pointer the Engine reports problems at (`/steps/1/with`) */
export const pointerOf = (path: FlowPath) => `/${path.map(part => String(part).replace(/~/g, '~0').replace(/\//g, '~1')).join('/')}`;

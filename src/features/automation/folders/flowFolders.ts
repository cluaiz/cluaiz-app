import { useEffect, useState } from 'react';
import { flowsApi, type FlowSummary } from '../../../api/engine/automation';
import { editFlow, readFlow, setValue, removeAt, valueAt } from '../model/flowDoc';
import { flowKey } from '../useFlows';

/**
 * A workflow's folder lives in its own file, at `meta.folder` ("Clients/Acme"): Automation keeps `meta` as it is and
 * never reads it, so the folder travels with the file (git, copy, import). `flows.list` does not return `meta` yet
 * (Engine gap), so the folder is read with `flows.get` once per file version (its `hash`) and remembered.
 */
const PATH = ['meta', 'folder'];
const STORE = 'cluaiz_flow_folders_v1';
const PARALLEL = 4;

type Cache = Record<string, { hash: string; folder: string }>;
const memory: Cache = (() => { try { return JSON.parse(localStorage.getItem(STORE) ?? '{}') as Cache; } catch { return {}; } })();
const persist = () => { try { localStorage.setItem(STORE, JSON.stringify(memory)); } catch { /* the folders are read again next time */ } };

export const cleanFolder = (folder: string) => folder.split('/').map(part => part.trim()).filter(Boolean).join('/');

const folderOf = (text: string) => {
    const value = valueAt(readFlow(text).value, PATH);
    return typeof value === 'string' ? cleanFolder(value) : '';
};

/** The folder of every workflow, by `scope:name`; '' is no folder. Missing ones are read in the background */
export function useFlowFolders(flows: FlowSummary[] | null) {
    const [folders, setFolders] = useState<Record<string, string>>({});
    const [reading, setReading] = useState(0);

    useEffect(() => {
        if (!flows) return;
        const controller = new AbortController();
        const known = () => Object.fromEntries(flows.map(flow => [flowKey(flow), memory[flowKey(flow)]?.folder ?? '']));
        setFolders(known());
        const stale = flows.filter(flow => !flow.hash || memory[flowKey(flow)]?.hash !== flow.hash);
        if (!stale.length) return;
        setReading(stale.length);
        let next = 0;
        const worker = async () => {
            while (next < stale.length && !controller.signal.aborted) {
                const flow = stale[next++];
                try {
                    const file = await flowsApi.get({ name: flow.name, scope: flow.scope }, controller.signal);
                    memory[flowKey(flow)] = { hash: flow.hash ?? '', folder: folderOf(file.text) };
                } catch { /* an unreadable file stays without a folder */ }
                if (!controller.signal.aborted) setReading(left => left - 1);
            }
        };
        void Promise.all(Array.from({ length: PARALLEL }, worker)).then(() => {
            if (controller.signal.aborted) return;
            for (const key of Object.keys(memory)) if (!flows.some(flow => flowKey(flow) === key)) delete memory[key];
            persist();
            setFolders(known());
        });
        return () => controller.abort();
    }, [flows]);

    return { folders, reading };
}

/** Writes `meta.folder` into the workflow's file and saves it; '' takes it out of any folder */
export async function moveToFolder(flow: FlowSummary, folder: string) {
    const file = await flowsApi.get({ name: flow.name, scope: flow.scope });
    const clean = cleanFolder(folder);
    const text = editFlow(file.text, file.format, clean ? setValue(PATH, clean) : removeAt(PATH));
    const saved = await flowsApi.save({ text, format: file.format, scope: flow.scope, overwrite: true });
    memory[flowKey(flow)] = { hash: saved.hash ?? '', folder: clean };
    persist();
}

export interface FolderNode { name: string; path: string; count: number; children: FolderNode[] }

/** The folder tree from every workflow's folder path, with how many workflows sit in each (sub)folder */
export function folderTree(folders: Record<string, string>): FolderNode[] {
    const root: FolderNode = { name: '', path: '', count: 0, children: [] };
    for (const path of Object.values(folders)) {
        if (!path) continue;
        let at = root;
        path.split('/').forEach((name, index, parts) => {
            const full = parts.slice(0, index + 1).join('/');
            let child = at.children.find(item => item.name === name);
            if (!child) { child = { name, path: full, count: 0, children: [] }; at.children.push(child); }
            child.count++;
            at = child;
        });
    }
    const sort = (nodes: FolderNode[]) => { nodes.sort((a, b) => a.name.localeCompare(b.name)); nodes.forEach(node => sort(node.children)); return nodes; };
    return sort(root.children);
}

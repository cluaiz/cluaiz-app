import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Play, Sparkles, Trash2 } from 'lucide-react';
import type { FlowProblem, FlowSummary, RunStep } from '../../../api/engine/automation';
import { CodeEditor } from '../../../components/ui/CodeEditor';
import { ActionListMenu } from '../../../components/ui/context-menu/ActionListMenu';
import { ConfirmationModal } from '../../../components/ui/modal/ConfirmationModal';
import { FlowCanvas } from '../canvas/FlowCanvas';
import type { StepStatus } from '../canvas/canvasContext';
import { lineRange, setValue, type InsertAt } from '../model/flowDoc';
import { askContext, flowGraph, type GraphNode } from '../model/flowGraph';
import { describePermissions } from '../useFlows';
import { addItem, connect, duplicate, insertPlace, move, paletteValue, pinnedPositions, removeNeed, removeNodes, tidy } from './flowActions';
import { Inspector } from './Inspector';
import { NodePalette, type PaletteItem } from './NodePalette';
import { StudioToolbar } from './StudioToolbar';
import { useFlowCatalog } from './useFlowCatalog';
import { useFlowDocument } from './useFlowDocument';
import { useFlowRuns } from './useFlowRuns';

const EMPTY_GRAPH = { nodes: [], edges: [], pointers: new Map<string, string>() };
const RANK: Record<string, number> = { running: 5, failed: 4, waiting: 3, cancelled: 2, succeeded: 1, skipped: 0 };

/** One status per step: a step run many times (each item) shows the most telling one */
function statusesOf(steps: RunStep[] | undefined): Record<string, StepStatus> {
    const out: Record<string, StepStatus> = {};
    for (const step of steps ?? []) {
        const status = step.status as StepStatus;
        if (!(status in RANK)) continue;
        if (!out[step.id] || RANK[status] > RANK[out[step.id]]) out[step.id] = status;
    }
    return out;
}

/** The flow builder in the chat's right pane: canvas, palette, inspector and runs, all editing one flow file */
export function FlowStudio({ target, onClose }: { target?: FlowSummary; onClose: (changed: boolean) => void }) {
    const doc = useFlowDocument(target);
    const { catalog, error: catalogError } = useFlowCatalog();
    const runs = useFlowRuns(doc.summary?.name, doc.summary?.scope);
    const [selected, setSelected] = useState<string | null>(null);
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [insertTarget, setInsertTarget] = useState<InsertAt | null>(null);
    const [miniMap, setMiniMap] = useState(false);
    const [yamlView, setYamlView] = useState(false);
    const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
    const [savedOnce, setSavedOnce] = useState(false);

    const graph = useMemo(() => doc.value ? flowGraph(doc.value) : EMPTY_GRAPH, [doc.value]);
    const pinned = useMemo(() => pinnedPositions(doc.value), [doc.value]);
    const node = (id: string | null) => graph.nodes.find(item => item.id === id);
    const selectedNode = node(selected);
    const flowName = typeof doc.value?.name === 'string' ? doc.value.name : doc.summary?.name ?? 'flow';

    /** Each problem goes to the step or trigger whose place holds it; the rest belong to the flow */
    const problems = useMemo(() => {
        const out: Record<string, FlowProblem[]> = {};
        const places = [...graph.pointers.entries()].sort((a, b) => b[0].length - a[0].length);
        for (const problem of doc.problems) {
            const id = places.find(([pointer]) => problem.path === pointer || problem.path.startsWith(`${pointer}/`))?.[1] ?? 'flow';
            (out[id] ??= []).push(problem);
        }
        return out;
    }, [doc.problems, graph]);

    const statuses = useMemo(() => statusesOf(runs.detail?.steps), [runs.detail]);
    const descriptions = useMemo(() => {
        const out: Record<string, string> = {};
        if (!catalog) return out;
        for (const of of ['step', 'trigger'] as const) {
            const defs = catalog.schema.$defs as Record<string, { oneOf?: { title?: string; properties?: Record<string, { description?: string }> }[] }> | undefined;
            for (const branch of defs?.[of]?.oneOf ?? []) {
                if (branch.title) out[`${of}:${branch.title}`] = branch.properties?.[branch.title]?.description ?? '';
            }
        }
        return out;
    }, [catalog]);

    useEffect(() => { if (selected && !selectedNode && selected !== 'flow') setSelected(null); }, [selected, selectedNode]);

    const pick = (item: PaletteItem) => {
        if (!doc.value) return;
        const made = paletteValue(item, doc.value);
        doc.change(addItem(insertPlace(insertTarget, selectedNode, doc.value), made, doc.value));
        setInsertTarget(null); setPaletteOpen(false);
        setSelected(made.trigger ? `trigger:${Array.isArray(doc.value.on) ? doc.value.on.length : 0}` : String(made.value.id));
    };

    /** Hands the chat the whole file as it is now, and which part the question is about */
    const askAi = (id: string) => {
        const target = node(id);
        if (!target || (target.type !== 'step' && target.type !== 'trigger') || doc.text === null) return;
        const lines = lineRange(doc.text, target.data.path);
        document.dispatchEvent(new CustomEvent('insert-chat-context', {
            detail: { name: `Flow ${flowName} · ${target.data.title}`, text: askContext(doc.text, flowName, target, lines) },
        }));
    };

    const save = useCallback(async () => {
        const result = await doc.save();
        if (result) setSavedOnce(true);
        return result;
    }, [doc]);

    const run = async () => {
        if (doc.dirty && !(await save())) return;
        void runs.start();
    };

    useEffect(() => {
        const keys = (event: KeyboardEvent) => {
            const typing = event.target instanceof HTMLElement && event.target.closest('input, textarea, [contenteditable="true"], .monaco-editor');
            if (!(event.ctrlKey || event.metaKey) || typing) return;
            const key = event.key.toLowerCase();
            if (key === 's') { event.preventDefault(); void save(); }
            else if (key === 'z' && !event.shiftKey) { event.preventDefault(); doc.undo(); }
            else if (key === 'y' || (key === 'z' && event.shiftKey)) { event.preventDefault(); doc.redo(); }
            else if (key === 'd' && selectedNode && doc.value) { event.preventDefault(); const edit = duplicate(selectedNode, doc.value); if (edit) doc.change(edit); }
        };
        window.addEventListener('keydown', keys);
        return () => window.removeEventListener('keydown', keys);
    }, [doc, save, selectedNode]);

    const menuNode = menu ? node(menu.id) : undefined;
    const menuActions = (target: GraphNode) => [
        { id: 'ask', label: 'Ask AI about this', icon: Sparkles },
        ...(target.type === 'step' ? [{ id: 'rerun', label: 'Run again from here', icon: Play, disabled: !runs.shown }] : []),
        { id: 'duplicate', label: 'Duplicate', icon: Copy, hint: 'Ctrl+D', divider: true },
        { id: 'up', label: 'Move up', icon: ArrowUp },
        { id: 'down', label: 'Move down', icon: ArrowDown },
        { id: 'delete', label: 'Delete', icon: Trash2, hint: 'Del', color: 'text-red-500', divider: true },
    ];
    const onMenu = (action: string) => {
        if (!menuNode || !doc.value) return;
        const edits = { duplicate: () => duplicate(menuNode, doc.value!), up: () => move(menuNode, -1), down: () => move(menuNode, 1),
            delete: () => removeNodes(graph, [menuNode.id]) } as Record<string, () => ReturnType<typeof duplicate>>;
        if (action === 'ask') askAi(menuNode.id);
        else if (action === 'rerun' && runs.shown && menuNode.type === 'step') void runs.start({ run: runs.shown, step: menuNode.data.stepId });
        else { const edit = edits[action]?.(); if (edit) doc.change(edit); }
    };

    const inspected = selected === 'flow' ? 'flow' : selectedNode;
    const records = selectedNode?.type === 'step' ? runs.detail?.steps.filter(step => step.id === selectedNode.id) ?? [] : [];

    return <div className="flex flex-col h-full min-h-0 bg-[var(--bg-primary)]">
        <StudioToolbar doc={doc} runs={runs} problems={doc.problems} miniMap={miniMap} yamlView={yamlView}
            paletteOpen={paletteOpen} onBack={() => onClose(savedOnce)} onPalette={() => { setPaletteOpen(open => !open); setInsertTarget(null); }}
            onTidy={() => doc.value && doc.change(tidy(doc.value))} onMiniMap={() => setMiniMap(on => !on)} onYaml={() => setYamlView(on => !on)}
            onRun={() => void run()} onSave={() => void save()} onFlowSettings={() => setSelected('flow')}
            onProblem={problem => { const id = Object.entries(problems).find(([, list]) => list.includes(problem))?.[0]; setSelected(id ?? 'flow'); setYamlView(false); }} />
        <div className="relative flex-1 min-h-0">
            {doc.error && <p role="alert" className="p-6 text-sm text-red-400">{doc.error}</p>}
            {!doc.error && doc.text === null && <p role="status" className="p-6 text-sm text-[var(--text-secondary)]">Reading the flow…</p>}
            {doc.text !== null && (yamlView || doc.parseError) && <div className="absolute inset-0 flex flex-col">
                {doc.parseError && <p role="alert" className="px-4 py-2 text-xs text-red-400 border-b border-[var(--border-color)]">The file does not read as YAML: {doc.parseError}</p>}
                <CodeEditor value={doc.text} onChange={value => doc.replace(value, 'yaml')} language={doc.format} height="100%" showToolbar={false}
                    filePath={doc.summary?.path} fileName={doc.summary?.path?.split(/[\\/]/).pop()} />
            </div>}
            {doc.text !== null && !yamlView && !doc.parseError && <>
                <FlowCanvas graph={graph} pinned={pinned} selected={selected} miniMap={miniMap} statuses={statuses} problems={problems}
                    insertTarget={insertTarget}
                    onInsert={at => { setInsertTarget(at); setPaletteOpen(true); }}
                    onRemoveNeed={edge => { const edit = doc.value && removeNeed(edge, doc.value); if (edit) doc.change(edit); }}
                    onSelect={setSelected}
                    onMoved={(id, at) => doc.change(setValue(['ui', 'cluaiz', 'positions', id], at))}
                    onConnect={(source, targetId) => { const edit = doc.value && connect(graph, doc.value, source, targetId); if (edit) doc.change(edit); }}
                    onRemove={ids => doc.change(removeNodes(graph, ids))}
                    onContextMenu={(id, x, y) => { setSelected(id); setMenu({ id, x, y }); }}
                    onDropItem={raw => { try { pick(JSON.parse(raw) as PaletteItem); } catch { /* not ours */ } }} />
                {paletteOpen && <NodePalette nodes={catalog?.nodes.nodes ?? []} descriptions={descriptions} inserting={Boolean(insertTarget)}
                    onPick={pick} onClose={() => { setPaletteOpen(false); setInsertTarget(null); }} />}
                {catalogError && <p className="absolute left-3 bottom-14 z-10 text-[11px] text-red-400">{catalogError}</p>}
                {inspected && catalog && !paletteOpen && <Inspector key={selected ?? ''} doc={doc} node={inspected} schema={catalog.schema} nodes={catalog.nodes.nodes}
                    problems={problems[selected ?? ''] ?? []} records={records} onClose={() => setSelected(null)} />}
            </>}
        </div>
        {menuNode && <ActionListMenu isOpen x={menu!.x} y={menu!.y} title={menuNode.type === 'step' || menuNode.type === 'trigger' ? menuNode.data.title : ''}
            actions={menuActions(menuNode)} onAction={onMenu} onClose={() => setMenu(null)} />}
        <ConfirmationModal open={Boolean(doc.confirming)} title="Confirm what this flow may do"
            message={doc.confirming ? describePermissions(doc.confirming) : ''} confirmText="Confirm and save"
            onCancel={doc.cancelConfirm} onConfirm={doc.confirm} />
    </div>;
}

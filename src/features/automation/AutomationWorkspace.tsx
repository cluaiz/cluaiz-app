import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bot, History, LayoutDashboard, RefreshCw, ShieldCheck, Workflow } from 'lucide-react';
import { ConfirmationModal } from '../../components/ui/modal/ConfirmationModal';
import { Button } from '../../components/ui/Button';
import { EngineOfflineGuard } from '../settings/EngineOfflineGuard';
import { flowsApi, type FlowSummary } from '../../api/engine/automation';
import { errorMessage } from '../../api/client/errors';
import { toast } from '../../components/ui/toast';
import { FlowStudio } from './studio/FlowStudio';
import { AutomationHome, type Section } from './home/AutomationHome';
import { isAgent } from './home/WorkflowRow';
import { WorkflowsPage } from './workflows/WorkflowsPage';
import { AgentsPage } from './agents/AgentsPage';
import { NewAgentDialog } from './agents/NewAgentDialog';
import { ApprovalsPage } from './approvals/ApprovalsPage';
import { RunList } from './RunList';
import { MoveDialog } from './folders/MoveDialog';
import { moveToFolder, useFlowFolders } from './folders/flowFolders';
import { describePermissions, flowKey, useFlows } from './useFlows';
import { readPlace, writePlace } from './automationRoute';

/** `undefined`: the sections; `null`: a new workflow; a flow: that flow's file */
type Editing = FlowSummary | null | undefined;

const Pane = ({ children }: { children: React.ReactNode }) =>
    <div className="flex h-full w-full min-w-0 flex-col overflow-hidden bg-[var(--bg-primary)] font-sans"><EngineOfflineGuard>{children}</EngineOfflineGuard></div>;

const TITLES: Record<Section, { title: string; text: string }> = {
    home: { title: 'Dashboard', text: 'What runs, what failed and what needs you' },
    workflows: { title: 'Workflows', text: 'Every workflow, in folders' },
    agents: { title: 'Agents', text: 'Workflows your chats can use as tools' },
    runs: { title: 'Runs', text: 'Every run, step by step' },
    approvals: { title: 'Approvals', text: 'Runs waiting for your yes' },
};

/** Owns Automation navigation and renders it in the App shell's sidebar slots. */
export function AutomationWorkspace({ sidebar, flyout }: { sidebar: HTMLDivElement | null; flyout: HTMLDivElement | null }) {
    // The address is the source of the place: a refresh or a copied link opens the same section or workflow
    const [section, setSection] = useState<Section>(() => readPlace().section);
    const [editing, setEditing] = useState<Editing>(() => readPlace().flow === 'new' ? null : undefined);
    /** A workflow named in the address, opened once the list has it */
    const [pendingFlow, setPendingFlow] = useState<string | null>(() => { const flow = readPlace().flow; return flow && flow !== 'new' ? flow : null; });
    const [removing, setRemoving] = useState<FlowSummary[] | null>(null);
    const [moving, setMoving] = useState<FlowSummary[] | null>(null);
    const [movingBusy, setMovingBusy] = useState(false);
    const [newAgent, setNewAgent] = useState(false);
    const editorDirty = useRef(false);
    const savedFlowKey = useRef<string | null>(null);
    const file = useRef<HTMLInputElement>(null);
    const data = useFlows();
    const { flows, runs, error, busy, refresh, setEnabled, run, remove, rerunFrom, confirmation, confirm, cancelConfirmation } = data;
    const { folders, reading } = useFlowFolders(flows);
    const agents = useMemo(() => (flows ?? []).filter(isAgent), [flows]);
    const waiting = (runs ?? []).filter(item => item.status === 'waiting').length;

    useEffect(() => {
        if (!pendingFlow || !flows) return;
        const found = flows.find(flow => flowKey(flow) === pendingFlow);
        setPendingFlow(null);
        if (found) setEditing(found); else { toast.error(`Workflow ${pendingFlow} was not found`); writePlace({ section, flow: null }, true); }
    }, [pendingFlow, flows]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (pendingFlow) return;
        if (editing === undefined) savedFlowKey.current = null;
        writePlace({ section, flow: editing === undefined ? null : editing === null ? savedFlowKey.current ?? 'new' : flowKey(editing) });
    }, [section, editing, pendingFlow]);
    // Back and Forward move between the places written above
    useEffect(() => {
        const back = () => {
            if (!window.location.pathname.startsWith('/automation')) return;
            if (editorDirty.current && !window.confirm('Leave this workflow and discard unsaved changes?')) {
                writePlace({ section, flow: editing ? flowKey(editing) : savedFlowKey.current ?? 'new' });
                return;
            }
            const place = readPlace();
            setSection(place.section);
            setPendingFlow(null);
            if (!place.flow) setEditing(undefined);
            else if (place.flow === 'new') setEditing(null);
            else setPendingFlow(place.flow);
        };
        window.addEventListener('popstate', back);
        return () => window.removeEventListener('popstate', back);
    }, [editing, section]);

    const importFile = async (picked: File) => {
        try {
            const saved = await flowsApi.save({ text: await picked.text(), format: /\.json$/i.test(picked.name) ? 'json' : 'yaml', scope: 'user' });
            toast.success(`${saved.name} imported`);
            await refresh();
        } catch (reason) {
            toast.error(`Could not import ${picked.name}: ${errorMessage(reason)}`);
        }
    };
    const moveAll = async (folder: string) => {
        if (!moving) return;
        setMovingBusy(true);
        const failed: string[] = [];
        for (const flow of moving) { try { await moveToFolder(flow, folder); } catch (reason) { failed.push(`${flow.name}: ${errorMessage(reason)}`); } }
        setMovingBusy(false); setMoving(null);
        if (failed.length) toast.error(`Not moved: ${failed.join('; ')}`); else toast.success(folder ? `Moved to ${folder}` : 'Removed from folder');
        await refresh();
    };
    const bulk = async (kind: 'on' | 'off' | 'remove', list: FlowSummary[]) => {
        if (kind === 'remove') { setRemoving(list); return; }
        for (const flow of list) if (flow.enabled !== (kind === 'on')) await setEnabled(flow, kind === 'on');
    };

    const nav: { id: Section; label: string; icon: typeof Workflow; count?: number }[] = [
        { id: 'home', label: TITLES.home.title, icon: LayoutDashboard },
        { id: 'workflows', label: 'Workflows', icon: Workflow, count: flows?.length },
        { id: 'agents', label: 'Agents', icon: Bot, count: agents.length },
        { id: 'runs', label: 'Runs', icon: History, count: runs?.length },
        { id: 'approvals', label: 'Approvals', icon: ShieldCheck, count: waiting || undefined },
    ];
    const ready = Boolean(flows && runs);
    const actions = { busy, onToggle: (flow: FlowSummary, on: boolean) => void setEnabled(flow, on), onRun: (flow: FlowSummary) => void run(flow),
        onOpen: setEditing, onRemove: (flow: FlowSummary) => setRemoving([flow]), onMove: setMoving };

    const activeSection = editing === undefined ? section : section === 'agents' ? 'agents' : 'workflows';
    const navigation = <nav aria-label="Automation" className="flex flex-col gap-1 p-3">
                {nav.map(item => <button key={item.id} type="button" aria-label={item.label} onClick={() => {
                    if (editorDirty.current && !window.confirm('Leave this workflow and discard unsaved changes?')) return;
                    setEditing(undefined);
                    setPendingFlow(null);
                    setSection(item.id);
                    void refresh();
                }} aria-current={activeSection === item.id ? 'page' : undefined}
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors cursor-pointer ${activeSection === item.id
                        ? 'bg-[var(--bg-tertiary)] font-medium text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/50 hover:text-[var(--text-primary)]'}`}>
                    <item.icon className="h-4 w-4 shrink-0" /><span className="flex-1 text-left">{item.label}</span>
                    {item.count !== undefined && <span className={`text-xs tabular-nums ${item.id === 'approvals' ? 'rounded-full bg-amber-400/15 px-1.5 text-amber-400' : 'text-[var(--text-muted)]'}`}>{item.count}</span>}
                </button>)}
            </nav>;

    return <>
        {sidebar && createPortal(navigation, sidebar)}
        {flyout && createPortal(navigation, flyout)}
        <Pane>
        {editing !== undefined ? <FlowStudio key={editing ? flowKey(editing) : 'new'} target={editing ?? undefined} dirtyRef={editorDirty}
            onClose={() => setEditing(undefined)} onSaved={saved => {
                savedFlowKey.current = flowKey(saved);
                writePlace({ section, flow: savedFlowKey.current }, true);
                void refresh();
            }} /> : <>
        <input ref={file} type="file" accept=".yaml,.yml,.json" hidden onChange={event => { const picked = event.target.files?.[0]; event.target.value = ''; if (picked) void importFile(picked); }} />
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[var(--border-color)]/80 px-6">
                    <div className="flex min-w-0 items-baseline gap-3">
                        <h1 className="text-base font-semibold text-[var(--text-primary)]">{TITLES[section].title}</h1>
                        <p className="hidden truncate text-xs text-[var(--text-muted)] sm:block">{TITLES[section].text}</p>
                    </div>
                    <Button size="icon" variant="ghost" title="Refresh" aria-label="Refresh" onClick={() => void refresh()}><RefreshCw className="h-4 w-4" /></Button>
                </header>
                <main className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="mx-auto w-full max-w-[1400px] px-6 py-6">
                        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
                        {!error && !ready && <p role="status" className="text-sm text-[var(--text-secondary)]">Reading workflows…</p>}
                        {ready && section === 'home' && <AutomationHome flows={flows!} runs={runs!} onGo={setSection} onOpen={setEditing}
                            onNew={() => setEditing(null)} onNewAgent={() => setNewAgent(true)} onImport={() => file.current?.click()} />}
                        {ready && section === 'workflows' && <WorkflowsPage flows={flows!} runs={runs!} folders={folders} reading={reading} actions={actions}
                            onNew={() => setEditing(null)} onImport={() => file.current?.click()} onBulk={(kind, list) => void bulk(kind, list)} />}
                        {ready && section === 'agents' && <AgentsPage agents={agents} busy={busy} onNew={() => setNewAgent(true)} onOpen={setEditing} onToggle={actions.onToggle} />}
                        {ready && section === 'runs' && <RunList runs={runs!} busy={busy} onRerun={(record, step) => void rerunFrom(record, step)} />}
                        {ready && section === 'approvals' && <ApprovalsPage runs={runs!} busy={busy} onRerun={(record, step) => void rerunFrom(record, step)} />}
                    </div>
                </main>
            </div>

        {moving && <MoveDialog count={moving.length} folders={[...new Set(Object.values(folders).filter(Boolean))].sort()} busy={movingBusy}
            start={moving.length === 1 ? folders[flowKey(moving[0])] ?? '' : ''} onMove={folder => void moveAll(folder)} onClose={() => setMoving(null)} />}
        {newAgent && <NewAgentDialog onClose={() => setNewAgent(false)} onCreated={flow => { setNewAgent(false); toast.success(`${flow.name} created. Turn on Use in chat to offer it to chats.`); setSection('agents'); void refresh(); }} />}
        <ConfirmationModal open={Boolean(confirmation)} title={`Enable ${confirmation?.flow.name ?? 'workflow'}?`}
            message={confirmation ? describePermissions(confirmation.missing) : ''} confirmText="Confirm and enable"
            onConfirm={confirm} onCancel={cancelConfirmation} />
        <ConfirmationModal open={Boolean(removing)} title={removing?.length === 1 ? `Remove ${removing[0].name}?` : `Remove ${removing?.length ?? 0} workflows?`} isDestructive confirmText="Remove"
            message="The workflow files and their run records are deleted. Runs in progress are not cancelled."
            onCancel={() => setRemoving(null)} onConfirm={() => { const list = removing ?? []; setRemoving(null); void (async () => { for (const flow of list) await remove(flow); })(); }} />
        </>}
        </Pane>
    </>;
}

export default AutomationWorkspace;

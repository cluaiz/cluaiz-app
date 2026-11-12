import { useState } from 'react';
import { Plus, RefreshCw, Workflow } from 'lucide-react';
import { WorkspaceHeader } from '../../components/layout/WorkspaceHeader';
import { Tabs } from '../../components/ui/Tabs';
import { Button } from '../../components/ui/Button';
import { ConfirmationModal } from '../../components/ui/modal/ConfirmationModal';
import { EngineOfflineGuard } from '../settings/EngineOfflineGuard';
import type { FlowSummary } from '../../api/engine/automation';
import { FlowEditor } from './FlowEditor';
import { FlowList } from './FlowList';
import { RunList } from './RunList';
import { describePermissions, useFlows } from './useFlows';

/** `undefined`: the lists; `null`: a new flow; a flow: that flow's file */
type Editing = FlowSummary | null | undefined;

function AutomationContent() {
    const [section, setSection] = useState<'flows' | 'runs'>('flows');
    const [editing, setEditing] = useState<Editing>(undefined);
    const [removing, setRemoving] = useState<FlowSummary | null>(null);
    const { flows, runs, error, busy, confirmation, refresh, setEnabled, run, remove, rerunFrom, confirm, cancelConfirmation } = useFlows();

    if (editing !== undefined) {
        return <FlowEditor target={editing ?? undefined} onClose={saved => { setEditing(undefined); if (saved) void refresh(); }} />;
    }
    return <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
            <Tabs items={[{ id: 'flows', label: 'Flows', count: flows?.length }, { id: 'runs', label: 'Runs', count: runs?.length }]}
                value={section} onChange={setSection} />
            <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => void refresh()}><RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh</Button>
                <Button size="sm" onClick={() => setEditing(null)}><Plus className="w-3.5 h-3.5 mr-1" /> New flow</Button>
            </div>
        </div>
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        {!error && (!flows || !runs) && <p role="status" className="text-sm text-[var(--text-secondary)]">Reading flows…</p>}
        {flows && runs && (section === 'flows'
            ? <FlowList flows={flows} busy={busy} onToggle={(flow, enabled) => void setEnabled(flow, enabled)}
                onRun={flow => void run(flow)} onEdit={setEditing} onRemove={setRemoving} />
            : <RunList runs={runs} busy={busy} onRerun={(record, step) => void rerunFrom(record, step)} />)}
        <ConfirmationModal open={Boolean(confirmation)} title={`Enable ${confirmation?.flow.name ?? 'flow'}?`}
            message={confirmation ? describePermissions(confirmation.missing) : ''} confirmText="Confirm and enable"
            onConfirm={confirm} onCancel={cancelConfirmation} />
        <ConfirmationModal open={Boolean(removing)} title={`Remove ${removing?.name ?? 'flow'}?`} isDestructive confirmText="Remove"
            message="The flow file and its run records are deleted. Runs in progress are not cancelled."
            onCancel={() => setRemoving(null)} onConfirm={() => { const flow = removing; setRemoving(null); if (flow) void remove(flow); }} />
    </div>;
}

export function AutomationWorkspace() {
    return <div className="flex flex-col h-full w-full min-w-0 overflow-hidden bg-[var(--bg-primary)] font-sans">
        <WorkspaceHeader icon={Workflow} title="Automation"
            description="Flows that run on a time, a file, a webhook or an event, and the record of every run." />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-[var(--bg-primary)]">
            <div className="max-w-7xl mx-auto">
                <EngineOfflineGuard><AutomationContent /></EngineOfflineGuard>
            </div>
        </main>
    </div>;
}

export default AutomationWorkspace;

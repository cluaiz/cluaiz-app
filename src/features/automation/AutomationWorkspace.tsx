import { useState } from 'react';
import { ConfirmationModal } from '../../components/ui/modal/ConfirmationModal';
import { EngineOfflineGuard } from '../settings/EngineOfflineGuard';
import type { FlowSummary } from '../../api/engine/automation';
import { FlowStudio } from './studio/FlowStudio';
import { ChatWorkspace } from '../chat/components/ChatWorkspace';
import { AutomationHome } from './home/AutomationHome';
import { describePermissions, useFlows } from './useFlows';

/** `undefined`: Home; `null`: a new workflow; a flow: that flow's file */
type Editing = FlowSummary | null | undefined;

const Pane = ({ children }: { children: React.ReactNode }) =>
    <div className="flex h-full w-full min-w-0 flex-col overflow-hidden bg-[var(--bg-primary)] font-sans"><EngineOfflineGuard>{children}</EngineOfflineGuard></div>;

/**
 * Automation: Home (the workflows, full page, no chat) and the editor of one workflow. The editor still sits beside
 * the chat; the closed-by-default chat panel replaces that in a later step of the blueprint.
 */
export function AutomationWorkspace() {
    const [editing, setEditing] = useState<Editing>(undefined);
    const [removing, setRemoving] = useState<FlowSummary | null>(null);
    const data = useFlows();
    const { confirmation, confirm, cancelConfirmation, remove, refresh } = data;

    if (editing !== undefined) {
        return <ChatWorkspace workspace={<Pane>
            <FlowStudio target={editing ?? undefined} onClose={saved => { setEditing(undefined); if (saved) void refresh(); }} />
        </Pane>} />;
    }
    return <Pane>
        <AutomationHome data={data} onOpen={setEditing} onNew={() => setEditing(null)} onRemove={setRemoving} />
        <ConfirmationModal open={Boolean(confirmation)} title={`Enable ${confirmation?.flow.name ?? 'workflow'}?`}
            message={confirmation ? describePermissions(confirmation.missing) : ''} confirmText="Confirm and enable"
            onConfirm={confirm} onCancel={cancelConfirmation} />
        <ConfirmationModal open={Boolean(removing)} title={`Remove ${removing?.name ?? 'workflow'}?`} isDestructive confirmText="Remove"
            message="The workflow file and its run records are deleted. Runs in progress are not cancelled."
            onCancel={() => setRemoving(null)} onConfirm={() => { const flow = removing; setRemoving(null); if (flow) void remove(flow); }} />
    </Pane>;
}

export default AutomationWorkspace;

import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/Dialog';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { CustomDropdown } from '../../../components/ui/dropdown/CustomDropdown';
import { errorMessage } from '../../../api/client/errors';
import { flowsApi, type FlowSummary } from '../../../api/engine/automation';
import { useFlowCatalog } from '../studio/useFlowCatalog';
import { agentFlowText, agentName, type AgentDraft } from './agentFlow';
import { describePermissions } from '../useFlows';

const CONFIRM = [
    { value: 'auto', label: 'As in Settings', description: 'Follow the global approval mode' },
    { value: 'strict', label: 'Ask every time', description: 'You approve every call from a chat' },
    { value: 'sandboxed', label: 'Ask when it changes something', description: 'Runs freely when it only reads' },
    { value: 'full_access', label: 'Never ask', description: 'Runs as soon as a chat calls it' },
];

/** Make an agent in one form: a name, what it does, how it works, which installed tools it may use, and when to ask */
export function NewAgentDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (flow: FlowSummary) => void }) {
    const { catalog, error: catalogError } = useFlowCatalog();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [instructions, setInstructions] = useState('');
    const [tools, setTools] = useState<string[]>([]);
    const [confirm, setConfirm] = useState<AgentDraft['confirm']>('auto');
    const [busy, setBusy] = useState(false);
    const [problem, setProblem] = useState('');
    /** What the Engine says this agent may touch; shown once, and the next click saves with the person's yes */
    const [asks, setAsks] = useState('');
    const toolOptions = useMemo(() => (catalog?.nodes.nodes ?? []).filter(node => node.step === 'tool')
        .map(node => ({ value: node.ref, label: node.title || node.ref, description: node.description })), [catalog]);
    const name = agentName(title);
    const ready = name && description.trim() && instructions.trim();

    const create = async () => {
        setBusy(true); setProblem('');
        try {
            const text = agentFlowText({ name, title: title.trim(), description: description.trim(), instructions: instructions.trim(), tools, confirm });
            const check = await flowsApi.validate({ text, format: 'yaml' });
            const errors = check.problems.filter(item => item.severity === 'error');
            if (errors.length) { setProblem(errors.map(item => item.message).join(' ')); return; }
            const needed = check.permissions_needed && Object.keys(check.permissions_needed).length ? describePermissions(check.permissions_needed) : '';
            if (needed && !asks) { setAsks(needed); return; }
            onCreated(await flowsApi.save({ text, format: 'yaml', scope: 'user', permissions_confirmed: Boolean(needed) }));
        } catch (reason) {
            setProblem(errorMessage(reason));
        } finally {
            setBusy(false);
        }
    };

    return createPortal(<Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
        <DialogContent className="max-w-lg p-6">
            <DialogHeader><DialogTitle>New agent</DialogTitle></DialogHeader>
            <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (ready) void create(); }}>
                <p className="text-xs text-[var(--text-muted)]">An agent is a workflow your chats can call as a tool. Turn it on and ask for it in any chat.</p>
                <label className="block space-y-1"><span className="text-xs font-medium text-[var(--text-secondary)]">Name</span>
                    <Input autoFocus value={title} onChange={event => { setTitle(event.target.value); setAsks(''); }} placeholder="Release notes writer" />
                    {name && <span className="text-[11px] text-[var(--text-muted)]">In chats: flow_{name.replace(/-/g, '_')}</span>}
                </label>
                <label className="block space-y-1"><span className="text-xs font-medium text-[var(--text-secondary)]">What it does (the chat model reads this to decide when to call it)</span>
                    <Input value={description} onChange={event => setDescription(event.target.value)} placeholder="Writes release notes from the commits since the last tag" />
                </label>
                <label className="block space-y-1"><span className="text-xs font-medium text-[var(--text-secondary)]">How it works</span>
                    <textarea value={instructions} onChange={event => setInstructions(event.target.value)} rows={4} placeholder="Read the commits, group them by feature and fix, and write short notes in plain English."
                        className="w-full resize-y rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-color)]" />
                </label>
                <div className="space-y-1"><span className="text-xs font-medium text-[var(--text-secondary)]">Tools it may use</span>
                    <CustomDropdown options={toolOptions} selectedValues={tools} onValuesChange={setTools} placeholder={catalogError ? 'Tools could not be read' : catalog ? (toolOptions.length ? 'None: it only answers with the model' : 'No tools installed') : 'Reading tools…'} />
                </div>
                <div className="space-y-1"><span className="text-xs font-medium text-[var(--text-secondary)]">When a chat calls it</span>
                    <CustomDropdown options={CONFIRM} value={confirm} onChange={value => setConfirm(value as AgentDraft['confirm'])} />
                </div>
                {asks && <p className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs text-[var(--text-secondary)]">{asks} Press Confirm to allow it and create the agent.</p>}
                {problem && <p role="alert" className="text-xs text-red-400">{problem}</p>}
                <DialogFooter>
                    <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
                    <Button type="submit" disabled={!ready || busy}>{busy ? 'Creating…' : asks ? 'Confirm and create' : 'Create agent'}</Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>, document.body);
}

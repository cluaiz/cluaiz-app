import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { CodeEditor } from '../../components/ui/CodeEditor';
import { Button } from '../../components/ui/Button';
import { Tabs } from '../../components/ui/Tabs';
import { ConfirmationModal } from '../../components/ui/modal/ConfirmationModal';
import { toast } from '../../components/ui/toast';
import { errorMessage } from '../../api/client/errors';
import { flowsApi, missingPermissions, type FlowFormat, type FlowProblem, type FlowScope, type FlowSummary,
    type MissingPermissions } from '../../api/engine/automation';
import { describePermissions } from './useFlows';

/** A new file that passes the checks: started by hand, one step to replace. */
const starter = (version: string) =>
    `flow: ${version}\nname: new-flow\non: [{ manual: {} }]\nsteps:\n  - id: first\n    set: { started: true }\n`;

interface FlowEditorProps {
    /** The saved flow to edit; absent for a new one */
    target?: FlowSummary;
    onClose: (saved: boolean) => void;
}

function Problems({ problems }: { problems: FlowProblem[] }) {
    return <ul className="space-y-1 text-xs">
        {problems.map((problem, index) => <li key={index} className={problem.severity === 'error' ? 'text-red-400' : 'text-[var(--text-secondary)]'}>
            {problem.line ? `Line ${problem.line}: ` : problem.path ? `${problem.path}: ` : ''}{problem.message}
        </li>)}
    </ul>;
}

/** Edit a flow file as text; the Engine checks it and asks the owner to confirm what it may do. */
export function FlowEditor({ target, onClose }: FlowEditorProps) {
    const [text, setText] = useState<string | null>(null);
    const [format, setFormat] = useState<FlowFormat>(target?.format === 'json' ? 'json' : 'yaml');
    const [scope, setScope] = useState<FlowScope>(target?.scope ?? 'user');
    const [problems, setProblems] = useState<FlowProblem[] | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [confirming, setConfirming] = useState<MissingPermissions | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        const read = target
            ? flowsApi.get({ name: target.name, scope: target.scope }, controller.signal).then(file => { setFormat(file.format); return file.text; })
            : flowsApi.schemaVersion(controller.signal).then(starter);
        read.then(setText).catch(reason => { if (!controller.signal.aborted) setError(errorMessage(reason)); });
        return () => controller.abort();
    }, [target]);

    const validate = async () => {
        if (text === null) return;
        setBusy(true); setError('');
        try {
            const result = await flowsApi.validate({ text, format });
            setProblems(result.problems);
            if (result.valid) toast.success('The flow is valid');
        } catch (reason) { setError(errorMessage(reason)); }
        finally { setBusy(false); }
    };

    const save = async (permissionsConfirmed = false) => {
        if (text === null) return;
        setBusy(true); setError('');
        try {
            const saved = await flowsApi.save({ text, format, scope, overwrite: Boolean(target),
                ...(permissionsConfirmed && { permissions_confirmed: true }) });
            toast.success(`${saved.name} saved`);
            onClose(true);
        } catch (reason) {
            const missing = permissionsConfirmed ? null : missingPermissions(reason);
            if (missing) setConfirming(missing);
            else setError(errorMessage(reason));
        } finally { setBusy(false); }
    };

    return <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
                <Button size="sm" variant="ghost" onClick={() => onClose(false)}><ArrowLeft className="w-3.5 h-3.5 mr-1" /> Flows</Button>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">{target ? target.name : 'New flow'}</h2>
            </div>
            <div className="flex items-center gap-2">
                {!target && <Tabs variant="pill" items={[{ id: 'user', label: 'User' }, { id: 'project', label: 'Project' }]}
                    value={scope} onChange={setScope} />}
                <Button size="sm" variant="outline" disabled={busy || text === null} onClick={() => void validate()}>
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Check
                </Button>
                <Button size="sm" disabled={busy || text === null} onClick={() => void save()}>Save</Button>
            </div>
        </div>
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        {text === null && !error && <p role="status" className="text-sm text-[var(--text-secondary)]">Reading the flow…</p>}
        {text !== null && <CodeEditor value={text} onChange={setText} language={format} height="60vh" showToolbar={false} />}
        {problems && (problems.length ? <Problems problems={problems} /> : <p className="text-xs text-[var(--text-secondary)]">No problems found.</p>)}
        <ConfirmationModal open={Boolean(confirming)} title="Confirm what this flow may do"
            message={confirming ? describePermissions(confirming) : ''} confirmText="Confirm and save"
            onCancel={() => setConfirming(null)} onConfirm={() => { setConfirming(null); void save(true); }} />
    </div>;
}

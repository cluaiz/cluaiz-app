import { useEffect, useState } from 'react';
import { History, RotateCcw, Save } from 'lucide-react';
import { SettingSection } from './SharedComponents';
import { CodeEditor } from '../../components/ui/CodeEditor';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { toast } from '../../components/ui/toast';
import { errorMessage } from '../../api/client/errors';
import { promptsApi, type EnginePrompt, type PromptVersion } from '../../api/engine/prompts';

/** The Engine writes history times as compact ISO (`20261101T101500.120Z`). */
const shown = (stamp: string) => {
    const iso = stamp.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6');
    const at = Date.parse(iso);
    return Number.isFinite(at) ? new Date(at).toLocaleString() : stamp;
};

function PromptRow({ prompt, onSaved }: { prompt: EnginePrompt; onSaved: (prompt: EnginePrompt) => void }) {
    const [draft, setDraft] = useState(prompt.text);
    const [busy, setBusy] = useState(false);
    const [history, setHistory] = useState<PromptVersion[] | null>(null);
    useEffect(() => setDraft(prompt.text), [prompt.text]);

    const act = async (action: () => Promise<EnginePrompt>, done: string) => {
        setBusy(true);
        try { onSaved(await action()); setHistory(null); toast.success(done); }
        catch (reason) { toast.error(errorMessage(reason)); }
        finally { setBusy(false); }
    };
    const toggleHistory = async () => {
        if (history) { setHistory(null); return; }
        try { setHistory(await promptsApi.history(prompt.id)); }
        catch (reason) { toast.error(errorMessage(reason)); }
    };
    const missing = prompt.variables.filter(name => !draft.includes(`{{${name}}}`));

    return <div className="p-4 space-y-3 border-b border-[var(--border-color)] last:border-b-0">
        <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-[var(--text-primary)]">{prompt.id}</span>
            {prompt.overridden && <Badge variant="secondary">edited</Badge>}
            {prompt.variables.map(name => <Badge key={name} variant="outline">{`{{${name}}}`}</Badge>)}
        </div>
        <p className="text-xs text-[var(--text-secondary)]">{prompt.description}</p>
        <CodeEditor value={draft} onChange={setDraft} language="markdown" height={140} showToolbar={false} />
        {missing.length > 0 && <p className="text-xs text-[var(--text-secondary)]">Not used in this text: {missing.map(name => `{{${name}}}`).join(', ')}</p>}
        <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" disabled={busy || draft === prompt.text} onClick={() => void act(() => promptsApi.set(prompt.id, draft), `${prompt.id} saved`)}>
                <Save className="w-3.5 h-3.5 mr-1" /> Save
            </Button>
            {prompt.overridden && <Button size="sm" variant="outline" disabled={busy}
                onClick={() => void act(() => promptsApi.reset(prompt.id), `${prompt.id} reset`)}>
                <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset to default
            </Button>}
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => void toggleHistory()}>
                <History className="w-3.5 h-3.5 mr-1" /> History
            </Button>
        </div>
        {history && (history.length ? <ul className="space-y-2">
            {history.map((version, index) => <li key={index} className="rounded-lg border border-[var(--border-color)] p-2 text-xs space-y-1">
                <div className="flex items-center justify-between gap-2 text-[var(--text-muted)]">
                    <span>Replaced {shown(version.replaced_at)}</span>
                    <Button size="sm" variant="ghost" onClick={() => setDraft(version.text)}>Use this text</Button>
                </div>
                <pre className="whitespace-pre-wrap text-[var(--text-secondary)]">{version.text}</pre>
            </li>)}
        </ul> : <p className="text-xs text-[var(--text-secondary)]">No earlier texts.</p>)}
    </div>;
}

/** Every prompt the Engine sends to a model, editable; a change applies to every later request. */
export function PromptsSettings() {
    const [prompts, setPrompts] = useState<EnginePrompt[] | null>(null);
    const [error, setError] = useState('');
    useEffect(() => {
        const controller = new AbortController();
        promptsApi.list(controller.signal).then(setPrompts)
            .catch(reason => { if (!controller.signal.aborted) setError(errorMessage(reason)); });
        return () => controller.abort();
    }, []);
    const replace = (next: EnginePrompt) => setPrompts(current => current?.map(item => item.id === next.id ? next : item) ?? null);

    return <div className="space-y-8">
        <SettingSection title="Model Prompts">
            {error && <p role="alert" className="p-4 text-sm text-red-400">{error}</p>}
            {!prompts && !error && <p role="status" className="p-4 text-sm text-[var(--text-secondary)]">Reading prompts…</p>}
            {prompts?.map(prompt => <PromptRow key={prompt.id} prompt={prompt} onSaved={replace} />)}
        </SettingSection>
    </div>;
}

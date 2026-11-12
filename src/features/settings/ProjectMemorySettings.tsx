import { useCallback, useEffect, useState } from 'react';
import { SettingSection } from './SharedComponents';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { ConfirmationModal } from '../../components/ui/modal/ConfirmationModal';
import { MarkdownRenderer } from '../../components/ui/MarkdownRenderer';
import { toast } from '../../components/ui/toast';
import { errorMessage } from '../../api/client/errors';
import { FACT_MAX_CHARS, projectAgentApi, type ProjectFact, type ProjectIndex, type ProjectItem } from '../../api/engine/fs/projectAgent';

const muted = 'text-xs text-[var(--text-secondary)]';

/** A name, a description and its text on demand. */
function ItemRow({ item, kind, label }: { item: ProjectItem | { name: string; path: string }; kind?: string; label?: string }) {
    const [text, setText] = useState<string | null>(null);
    const toggle = async () => {
        if (text !== null) { setText(null); return; }
        try { setText(await projectAgentApi.item(item.name, kind)); } catch (reason) { toast.error(errorMessage(reason)); }
    };
    const description = 'description' in item ? item.description : undefined;
    const trigger = 'trigger' in item ? item.trigger : undefined;
    return <div className="p-4 space-y-2 border-b border-[var(--border-color)] last:border-b-0">
        <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-[var(--text-primary)]">{label ?? item.name}</span>
            {trigger && <Badge variant="outline">{trigger}</Badge>}
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => void toggle()}>{text === null ? 'Show' : 'Hide'}</Button>
        </div>
        {description && <p className={muted}>{description}</p>}
        {text !== null && <div className="rounded-lg border border-[var(--border-color)] p-3 text-sm"><MarkdownRenderer content={text} /></div>}
    </div>;
}

function Group({ title, items, kind }: { title: string; items: ProjectItem[]; kind: string }) {
    if (!items.length) return null;
    return <SettingSection title={title}>{items.map(item => <ItemRow key={item.path} item={item} kind={kind} />)}</SettingSection>;
}

function Facts({ facts, onChanged }: { facts: ProjectFact[]; onChanged: () => void }) {
    const [name, setName] = useState('');
    const [fact, setFact] = useState('');
    const [replaces, setReplaces] = useState<string | null>(null);
    const [similar, setSimilar] = useState<string[]>([]);
    const [forgetting, setForgetting] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const live = facts.filter(item => item.status !== 'superseded' && !item.superseded_by);

    const save = async () => {
        setBusy(true);
        try {
            const result = await projectAgentApi.remember(name, fact, replaces ?? undefined);
            setSimilar(replaces ? [] : result.similar.filter(item => item !== result.saved));
            toast.success(`Saved ${result.saved}`);
            setName(''); setFact(''); setReplaces(null);
            onChanged();
        } catch (reason) { toast.error(errorMessage(reason)); }
        finally { setBusy(false); }
    };
    const forget = async (target: string) => {
        setBusy(true);
        try { await projectAgentApi.forget(target); toast.success(`Forgot ${target}`); onChanged(); }
        catch (reason) { toast.error(errorMessage(reason)); }
        finally { setBusy(false); }
    };

    return <SettingSection title="Project Memory Facts">
        {live.length === 0 && <p className={`p-4 ${muted}`}>No facts yet. Facts are files in the project's .agents/memory folder that every chat in this project reads.</p>}
        {live.map(item => <div key={item.path} className="p-4 space-y-1 border-b border-[var(--border-color)]">
            <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-[var(--text-primary)]">{item.name}</span>
                {item.status && <Badge variant="outline">{item.status}</Badge>}
                <span className="ml-auto flex gap-1">
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setName(item.name); setFact(item.text); setReplaces(item.name); }}>Edit</Button>
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => setForgetting(item.name)}>Forget</Button>
                </span>
            </div>
            <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{item.text}</p>
        </div>)}
        <div className="p-4 space-y-2">
            <p className="text-xs font-semibold text-[var(--text-primary)]">{replaces ? `Change ${replaces}` : 'Remember a fact'}</p>
            <Input placeholder="Short name, e.g. deploy-port" value={name} disabled={Boolean(replaces) || busy} onChange={event => setName(event.target.value)} />
            <textarea value={fact} maxLength={FACT_MAX_CHARS} disabled={busy} onChange={event => setFact(event.target.value)} rows={3}
                placeholder="The fact, in one or two sentences"
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] p-2 text-sm text-[var(--text-primary)]" />
            {similar.length > 0 && <p className={muted}>Facts that may be about the same thing: {similar.join(', ')}. Edit one of them to replace it.</p>}
            <div className="flex gap-2">
                <Button size="sm" disabled={busy || !name.trim() || !fact.trim()} onClick={() => void save()}>Save fact</Button>
                {replaces && <Button size="sm" variant="ghost" onClick={() => { setName(''); setFact(''); setReplaces(null); }}>Cancel</Button>}
            </div>
        </div>
        <ConfirmationModal open={Boolean(forgetting)} title={`Forget ${forgetting ?? ''}?`} isDestructive confirmText="Forget"
            message="Its file in .agents/memory is deleted. Chats in this project no longer read it."
            onCancel={() => setForgetting(null)} onConfirm={() => { const target = forgetting; setForgetting(null); if (target) void forget(target); }} />
    </SettingSection>;
}

/** The current project's agent files and memory facts, as the Engine reads them. */
export function ProjectMemorySettings() {
    const [index, setIndex] = useState<ProjectIndex | null>(null);
    const [facts, setFacts] = useState<ProjectFact[] | null>(null);
    const [error, setError] = useState('');
    const load = useCallback((signal?: AbortSignal) => {
        setError('');
        return Promise.all([projectAgentApi.index(signal), projectAgentApi.facts(signal)])
            .then(([nextIndex, nextFacts]) => { if (!signal?.aborted) { setIndex(nextIndex); setFacts(nextFacts); } })
            .catch(reason => { if (!signal?.aborted) setError(errorMessage(reason)); });
    }, []);
    useEffect(() => {
        const controller = new AbortController();
        void load(controller.signal);
        return () => controller.abort();
    }, [load]);

    if (error) return <p role="alert" className="text-sm text-red-400">{error}</p>;
    if (!index || !facts) return <p role="status" className={muted}>Reading the project…</p>;
    return <div className="space-y-8">
        <p className={muted}>Project folder: <span className="font-mono">{index.root}</span></p>
        {index.instructions.length > 0 && <SettingSection title="Instructions">
            {index.instructions.map(item => <ItemRow key={item.path} item={{ name: item.label, path: item.path }} label={`${item.label} · ${item.chars} characters`} />)}
        </SettingSection>}
        <Group title="Rules" items={index.rules} kind="rule" />
        <Group title="Workflows" items={index.workflows} kind="workflow" />
        <Group title="Skills" items={index.skills} kind="skill" />
        <Facts facts={facts} onChanged={() => void load()} />
    </div>;
}

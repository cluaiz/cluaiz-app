import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Document } from 'yaml';
import { errorMessage } from '../../../api/client/errors';
import { flowsApi, missingPermissions, type FlowFormat, type FlowProblem, type FlowScope, type FlowSummary,
    type MissingPermissions } from '../../../api/engine/automation';
import { toast } from '../../../components/ui/toast';
import { editFlow, readFlow } from '../model/flowDoc';

const VALIDATE_MS = 500;
const HISTORY = 100;
/** Edits of the same place this close together are one undo step (typing in a field) */
const MERGE_MS = 1_000;

const starter = (version: string) =>
    `flow: ${version}\nname: new-flow\non:\n  - manual: {}\nsteps:\n  - id: first\n    set: { started: true }\n`;

interface History { past: string[]; future: string[]; mark: string; at: number }

/**
 * One flow file being edited: its text (the single truth the canvas, the forms and the YAML view all change),
 * undo and redo, the Engine's checks as you go, and saving with the owner's confirmation of what it may do.
 */
export function useFlowDocument(target?: FlowSummary) {
    const [text, setText] = useState<string | null>(null);
    const [saved, setSaved] = useState<string | null>(null);
    const [format, setFormat] = useState<FlowFormat>(target?.format === 'json' ? 'json' : 'yaml');
    const [scope, setScope] = useState<FlowScope>(target?.scope ?? 'user');
    const [summary, setSummary] = useState<FlowSummary | undefined>(target);
    const [problems, setProblems] = useState<FlowProblem[]>([]);
    const [checking, setChecking] = useState(false);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [confirming, setConfirming] = useState<MissingPermissions | null>(null);
    const history = useRef<History>({ past: [], future: [], mark: '', at: 0 });
    const latest = useRef<string | null>(null);
    const put = useCallback((value: string) => { latest.current = value; setText(value); }, []);

    useEffect(() => {
        const controller = new AbortController();
        const read = target
            ? flowsApi.get({ name: target.name, scope: target.scope }, controller.signal).then(file => { setFormat(file.format); return file.text; })
            : flowsApi.schemaVersion(controller.signal).then(starter);
        read.then(value => { put(value); setSaved(target ? value : null); history.current = { past: [], future: [], mark: '', at: 0 }; })
            .catch(reason => { if (!controller.signal.aborted) setError(errorMessage(reason)); });
        return () => controller.abort();
    }, [target, put]);

    const parsed = useMemo(() => text === null ? { value: null, error: '' } : readFlow(text), [text]);

    useEffect(() => {
        if (text === null || parsed.error) { setProblems([]); return; }
        const controller = new AbortController();
        const timer = setTimeout(() => {
            setChecking(true);
            flowsApi.validate({ text, format }, controller.signal)
                .then(result => setProblems(result.problems))
                .catch(reason => { if (!controller.signal.aborted) setProblems([{ severity: 'error', code: 'unchecked', path: '', message: errorMessage(reason) }]); })
                .finally(() => { if (!controller.signal.aborted) setChecking(false); });
        }, VALIDATE_MS);
        return () => { clearTimeout(timer); controller.abort(); };
    }, [text, format, parsed.error]);

    /** Puts new text in, as one undo step (or merged into the last one when `mark` is the same place, typed just now) */
    const replace = useCallback((next: string, mark = '') => {
        const current = latest.current;
        if (current === null || current === next) return;
        const h = history.current, now = Date.now();
        if (!(mark && mark === h.mark && now - h.at < MERGE_MS)) h.past = [...h.past.slice(-HISTORY + 1), current];
        h.future = []; h.mark = mark; h.at = now;
        put(next);
    }, [put]);

    /** One change through the file's own structure; a file that does not parse is left for the YAML view to fix */
    const change = useCallback((edit: (doc: Document) => void, mark = '') => {
        if (latest.current === null) return;
        try { replace(editFlow(latest.current, format, edit), mark); } catch (reason) { toast.error(errorMessage(reason)); }
    }, [format, replace]);

    const step = useCallback((from: 'past' | 'future') => {
        const h = history.current;
        const to = from === 'past' ? 'future' : 'past';
        const value = h[from][h[from].length - 1];
        if (value === undefined || latest.current === null) return;
        h[from] = h[from].slice(0, -1);
        h[to] = [...h[to], latest.current];
        h.mark = '';
        put(value);
    }, [put]);

    const save = useCallback(async (permissionsConfirmed = false) => {
        if (text === null) return null;
        setSaving(true);
        try {
            const result = await flowsApi.save({ text, format, scope, overwrite: Boolean(saved !== null),
                ...(permissionsConfirmed && { permissions_confirmed: true }) });
            setSaved(text); setSummary(result);
            toast.success(`${result.name} saved`);
            return result;
        } catch (reason) {
            const missing = permissionsConfirmed ? null : missingPermissions(reason);
            if (missing) setConfirming(missing); else toast.error(errorMessage(reason));
            return null;
        } finally { setSaving(false); }
    }, [text, format, scope, saved]);

    return {
        text, format, scope, setScope, summary, value: parsed.value, parseError: parsed.error, error,
        problems, checking, saving, confirming, dirty: text !== null && text !== saved, isNew: saved === null && !target,
        canUndo: history.current.past.length > 0, canRedo: history.current.future.length > 0,
        replace, change, undo: () => step('past'), redo: () => step('future'), save,
        confirm: () => { setConfirming(null); void save(true); }, cancelConfirm: () => setConfirming(null),
    };
}

export type FlowDocument = ReturnType<typeof useFlowDocument>;

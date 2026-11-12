import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isCurrentNote, notesApi, type CreateNote, type EngineNote, type NoteChange, type NotesList } from '../../../api/engine/notes';
import { errorMessage } from '../../../api/client/errors';
import { useConnectionStore } from '../../../store/engine/useConnectionStore';
import { normalizePath } from '../../../utils/filePath';

interface Options { open: boolean; chatId?: string | null; workspacePath?: string; privateChat?: boolean }
interface State {
    key: string; workspace: string | null; notes: EngineNote[]; loading: boolean; pending: boolean;
    error: string | null; message: string | null; needsRefresh: boolean;
}
const empty = (key: string): State => ({ key, workspace: null, notes: [], loading: false, pending: false, error: null, message: null, needsRefresh: false });

/** Scope changes invalidate both rendered data and in-flight reads/writes before they can update UI. */
export function useAiMemory({ open, chatId, workspacePath, privateChat = false }: Options) {
    const connection = useConnectionStore(state => `${state.protocol}:${state.getBaseUrl()}`);
    const key = JSON.stringify([connection, chatId || null, workspacePath || null, privateChat]);
    const enabled = open && !privateChat;
    const live = useRef({ key, enabled }); live.current = { key, enabled };
    const read = useRef<AbortController | null>(null), write = useRef<AbortController | null>(null), revision = useRef(0);
    const [state, setState] = useState<State>(() => empty(key));
    const current = state.key === key && enabled ? state : empty(key);
    const currentRef = useRef(current); currentRef.current = current;
    const params = useMemo(() => chatId ? { chat_id: chatId } : {}, [chatId]);
    const contextual = useCallback((data: NotesList): NotesList => {
        if (workspacePath && normalizePath(workspacePath) !== normalizePath(data.workspace)) {
            throw new Error(`Engine workspace is ${data.workspace}; open the matching workspace before managing memory.`);
        }
        return { ...data, notes: data.notes.filter(item => item.scope === 'global'
            || (item.scope === 'workspace' && (item.owner === null || item.owner === data.workspace))
            || (item.scope === 'chat' && Boolean(chatId) && item.owner === chatId)) };
    }, [chatId, workspacePath]);
    const refresh = useCallback(async (): Promise<void> => {
        if (!enabled || write.current) return;
        read.current?.abort();
        const controller = new AbortController(), version = ++revision.current; read.current = controller;
        const valid = () => !controller.signal.aborted && live.current.enabled && live.current.key === key && revision.current === version;
        setState(previous => ({ ...(previous.key === key ? previous : empty(key)), loading: true, error: null, message: null }));
        try {
            const data = contextual(await notesApi.list(params, controller.signal));
            if (valid()) setState({ ...empty(key), ...data, needsRefresh: false });
        } catch (failure) {
            if (valid()) setState(previous => ({ ...previous, notes: [], workspace: null, error: errorMessage(failure), needsRefresh: true }));
        } finally {
            if (valid()) setState(previous => ({ ...previous, loading: false }));
        }
    }, [key, enabled, contextual, params]);
    useEffect(() => {
        if (enabled) void refresh();
        else setState(empty(key));
        return () => { revision.current++; read.current?.abort(); write.current?.abort(); write.current = null; };
    }, [refresh, enabled, key]);

    async function mutate(action: 'create' | 'confirm' | 'pin' | 'invalidate' | 'move', input: CreateNote | EngineNote, pinned?: boolean): Promise<boolean> {
        const snapshot = currentRef.current;
        if (!enabled || !live.current.enabled || live.current.key !== key || write.current
            || snapshot.loading || snapshot.needsRefresh || !snapshot.workspace) return false;
        const controller = new AbortController(); write.current = controller;
        read.current?.abort(); revision.current++;
        const valid = () => !controller.signal.aborted && live.current.enabled && live.current.key === key;
        setState(previous => ({ ...previous, pending: true, error: null, message: null }));
        try {
            // Recheck the Engine workspace/record immediately before a deliberate mutation.
            const fresh = contextual(await notesApi.list(params, controller.signal));
            if (!valid()) return false;
            if (fresh.workspace !== snapshot.workspace) throw new Error('Engine workspace changed. Refresh before saving.');
            let result: NoteChange;
            if (action === 'create') {
                const value = input as CreateNote;
                result = await notesApi.create({ text: value.text, scope: value.scope, pinned: value.pinned,
                    ...(value.scope === 'chat' && chatId ? { chat_id: chatId } : {}) }, controller.signal);
            } else {
                const target = fresh.notes.find(item => item.id === (input as EngineNote).id);
                if (!target || !snapshot.notes.some(item => item.id === target.id)) throw new Error('This note is no longer in the current view. Refresh first.');
                if (!isCurrentNote(target)) throw new Error('This note is no longer current. Refresh first.');
                if (action === 'confirm') {
                    if (target.status !== 'proposed') throw new Error('This note is no longer proposed. Refresh first.');
                    result = await notesApi.confirm(target.id, controller.signal);
                } else if (action === 'move') {
                    if (target.status !== 'confirmed' || target.scope !== 'workspace') throw new Error('Only a confirmed workspace note can move into project memory.');
                    const moved = await notesApi.move(target.id, controller.signal);
                    result = { note: { ...target, status: 'moved', moved_to: moved.moved_to }, superseded: null };
                } else if (action === 'pin') result = await notesApi.pin(target.id, Boolean(pinned), controller.signal);
                else result = await notesApi.invalidate(target.id, controller.signal);
            }
            if (!valid()) return false;
            if (!contextual({ workspace: fresh.workspace, notes: [result.note] }).notes.length) {
                throw new Error('Saved note belongs to a different scope. Refresh to inspect the actual result.');
            }
            const notes = new Map(fresh.notes.map(item => [item.id, item]));
            notes.set(result.note.id, result.note);
            if (result.superseded) notes.set(result.superseded.id, result.superseded);
            const message = action === 'create' ? (result.note.moved_to ? `Saved to project memory: ${result.note.moved_to}.` : 'Note saved by the Engine.') : action === 'invalidate' ? 'Note marked inactive; its history is retained.'
                : action === 'move' ? `Moved to project memory: ${result.note.moved_to}.`
                : action === 'confirm' ? 'Note confirmed.' : `Note ${result.note.pinned ? 'pinned' : 'unpinned'}. Status: ${result.note.status}.`;
            setState(previous => ({ ...previous, notes: [...notes.values()], message }));
            return true;
        } catch (failure) {
            if (valid()) setState(previous => ({ ...previous, error: `${errorMessage(failure)} Refresh before trying again; no automatic retry was sent.`, needsRefresh: true }));
            return false;
        } finally {
            if (write.current === controller) write.current = null;
            if (valid()) setState(previous => ({ ...previous, pending: false }));
        }
    }
    return { ...current, connection, refresh,
        create: (value: CreateNote) => mutate('create', value),
        confirm: (item: EngineNote) => mutate('confirm', item),
        pin: (item: EngineNote, pinned: boolean) => mutate('pin', item, pinned),
        invalidate: (item: EngineNote) => mutate('invalidate', item),
        move: (item: EngineNote) => mutate('move', item),
    };
}

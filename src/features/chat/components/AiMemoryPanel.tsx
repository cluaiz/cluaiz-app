import React, { useEffect, useId, useRef, useState } from 'react';
import { Brain, Pin, RefreshCw, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/Dialog';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { AlertBanner } from '../../../components/ui/AlertBanner';
import { CustomDropdown, FLOATING_MENU_ATTR } from '../../../components/ui/dropdown/CustomDropdown';
import { NOTE_TEXT_MAX_BYTES, isCurrentNote, noteTextBytes, type NoteScope } from '../../../api/engine/notes';
import { useAiMemory } from '../hooks/useAiMemory';

interface Props { open: boolean; onClose: () => void; chatId?: string | null; workspacePath?: string; privateChat?: boolean }

/** Human controls over existing Engine notes. This panel neither changes prompts nor owns storage. */
export function AiMemoryPanel({ open, onClose, chatId, workspacePath, privateChat }: Props) {
    const memory = useAiMemory({ open, chatId, workspacePath, privateChat });
    const [draft, setDraft] = useState(''), [scope, setScope] = useState<NoteScope>(chatId ? 'chat' : 'workspace');
    const [search, setSearch] = useState(''), [scopeFilter, setScopeFilter] = useState('all'), [statusFilter, setStatusFilter] = useState('current');
    const [inactiveId, setInactiveId] = useState<string | null>(null);
    const surface = useRef<HTMLDivElement>(null), titleId = useId();
    useEffect(() => {
        setDraft(''); setScope(chatId ? 'chat' : 'workspace'); setSearch(''); setScopeFilter('all'); setStatusFilter('current'); setInactiveId(null);
    }, [open, chatId, workspacePath, privateChat, memory.connection]);
    useEffect(() => {
        if (!open) return;
        const previous = document.activeElement as HTMLElement | null;
        surface.current?.querySelector<HTMLButtonElement>('[aria-label="Close AI memory"]')?.focus();
        return () => { if (previous?.isConnected) previous.focus(); };
    }, [open]);
    const bytes = noteTextBytes(draft);
    const busy = memory.loading || memory.pending;
    const writable = !busy && !memory.needsRefresh && Boolean(memory.workspace) && !privateChat;
    const notes = memory.notes.filter(item => (scopeFilter === 'all' || item.scope === scopeFilter)
        && (statusFilter === 'all' || (statusFilter === 'current' ? isCurrentNote(item) : item.status === statusFilter))
        && `${item.text} ${item.id} ${item.by} ${item.sources.join(' ')}`.toLowerCase().includes(search.trim().toLowerCase()));
    const keyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        const trigger = surface.current?.querySelector<HTMLButtonElement>('[aria-haspopup="listbox"][aria-expanded="true"]');
        if (event.key === 'Escape') { if (trigger) return; event.stopPropagation(); onClose(); return; }
        if (event.key !== 'Tab') return;
        const menu = (event.target as Element).closest('[' + FLOATING_MENU_ATTR + ']');
        const scope = menu || surface.current!;
        const elements = [...scope.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),summary,[href]')].filter(element => element.getClientRects().length);
        const first = elements[0], last = elements[elements.length - 1];
        if (menu) {
            if ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
                event.preventDefault(); trigger?.focus(); trigger?.click();
            }
            return;
        }
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    return <Dialog open={open} onOpenChange={value => { if (!value) onClose(); }}>
        <div ref={surface} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={keyDown}>
            <DialogContent className="flex max-h-[85dvh] flex-col overflow-hidden border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)]">
                <DialogHeader className="!mb-0 !flex-row shrink-0 items-center justify-between gap-2 border-b border-[var(--border-color)] !px-4 !py-3 !text-left">
                    <DialogTitle><span id={titleId} className="flex items-center gap-2"><Brain size={18} /> AI Memory</span></DialogTitle>
                    <div className="flex items-center gap-1">
                        <Button type="button" variant="ghost" size="icon" aria-label="Refresh AI memory" title="Read current Engine notes" disabled={busy || privateChat} onClick={() => void memory.refresh()}><RefreshCw size={15} /></Button>
                        <Button type="button" variant="ghost" size="icon" aria-label="Close AI memory" onClick={onClose}><X size={16} /></Button>
                    </div>
                </DialogHeader>
                <div className="min-h-0 space-y-4 overflow-y-auto p-4 text-sm">
                    {privateChat ? <AlertBanner variant="info" title="Private chat" message="Durable AI Memory is unavailable in private chats. No notes were read or saved." /> : <>
                        <p className="text-xs text-[var(--text-secondary)]">Facts and preferences stored by the Engine. Confirmation and pinning are separate; pinning alone does not approve a proposed note.</p>
                        {memory.workspace && <p className="break-all text-xs text-[var(--text-muted)]">Engine workspace: {memory.workspace}</p>}
                        {memory.error && <div role="alert"><AlertBanner variant="error" message={memory.error} /></div>}
                        {memory.message && <p role="status" className="text-xs text-[var(--accent-color)]">{memory.message}</p>}
                        <form className="space-y-2 rounded-lg border border-[var(--border-color)] p-3" onSubmit={async event => {
                            event.preventDefault();
                            if (writable && bytes > 0 && bytes <= NOTE_TEXT_MAX_BYTES && await memory.create({ text: draft, scope })) setDraft('');
                        }}>
                            <label className="block text-xs font-semibold" htmlFor={titleId + '-text'}>Add a fact or preference</label>
                            <textarea id={titleId + '-text'} aria-label="Memory note text" value={draft} onChange={event => setDraft(event.target.value)} disabled={!writable}
                                rows={3} className="ui-input !h-24 min-h-24 w-full resize-y" placeholder="What should be remembered?" />
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div role="group" aria-label="New memory scope"><CustomDropdown floating value={scope} onChange={value => setScope(value as NoteScope)} disabled={!writable}
                                    options={[...(chatId ? [{ value: 'chat', label: 'This chat' }] : []), { value: 'workspace', label: 'This workspace' }, { value: 'global', label: 'All chats (global)' }]} /></div>
                                <Button type="submit" size="sm" disabled={!writable || bytes === 0 || bytes > NOTE_TEXT_MAX_BYTES}>{memory.pending ? 'Saving…' : 'Save note'}</Button>
                            </div>
                            <p className={'text-[11px] ' + (bytes > NOTE_TEXT_MAX_BYTES ? 'text-red-500' : 'text-[var(--text-muted)]')}>{bytes} / {NOTE_TEXT_MAX_BYTES} UTF-8 bytes. Your note is confirmed on save.</p>
                            {scope === 'global' && <p className="text-xs text-[var(--text-secondary)]">This fact can apply across chats and workspaces on this Engine.</p>}
                        </form>
                        <div className="space-y-2">
                            <Input aria-label="Filter memory notes" value={search} onChange={event => setSearch(event.target.value)} placeholder="Find a note…" sizeVariant="sm" />
                            <div className="flex flex-wrap gap-2">
                                <div role="group" aria-label="Filter memory scope"><CustomDropdown floating value={scopeFilter} onChange={setScopeFilter} options={[
                                    { value: 'all', label: 'All applicable scopes' }, { value: 'chat', label: 'This chat' }, { value: 'workspace', label: 'Workspace' }, { value: 'global', label: 'Global' }]} /></div>
                                <div role="group" aria-label="Filter memory status"><CustomDropdown floating value={statusFilter} onChange={setStatusFilter} options={[
                                    { value: 'current', label: 'Current records' }, { value: 'all', label: 'All records' }, { value: 'proposed', label: 'Proposed' },
                                    { value: 'confirmed', label: 'Confirmed' }, { value: 'active', label: 'Active' }, { value: 'invalidated', label: 'Inactive' }, { value: 'superseded', label: 'Superseded' }, { value: 'moved', label: 'Moved to project' }]} /></div>
                            </div>
                        </div>
                        {memory.loading ? <p role="status">Reading Engine notes…</p> : !memory.error && notes.length === 0 ? <p role="status" className="text-[var(--text-secondary)]">{memory.notes.length ? 'No notes match these filters.' : 'No applicable notes yet.'}</p> : null}
                        <ul className="space-y-3" aria-label="AI memory notes">
                            {notes.map(item => {
                                const current = isCurrentNote(item);
                                return <li key={item.id} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] p-3" data-note-id={item.id}>
                                    <div className="mb-2 flex flex-wrap items-center gap-1.5"><Badge variant="outline">{item.status === 'invalidated' ? 'Inactive' : item.status}</Badge><Badge variant="secondary">{item.scope}</Badge>{item.pinned && <Badge variant="outline"><Pin size={11} /> Pinned</Badge>}</div>
                                    <p className="whitespace-pre-wrap break-words">{item.text}</p>
                                    <p className="mt-2 text-[11px] text-[var(--text-muted)]">By {item.by} · {new Date(item.updated_at).toLocaleString()}</p>
                                    <details className="mt-2 text-xs text-[var(--text-secondary)]"><summary className="cursor-pointer">Source and record details</summary>
                                        <p className="break-all">ID: {item.id} · Owner: {item.owner || 'All applicable scopes'}</p>
                                        <p>Valid from: {item.valid_from}</p>{item.invalid_at && <p>Inactive since: {item.invalid_at}</p>}
                                        {item.supersedes && <p>Supersedes: {item.supersedes}</p>}
                                        {item.moved_to && <p className="break-all">Moved to: {item.moved_to}</p>}
                                        <p className="break-all">Sources: {item.sources.length ? item.sources.join(', ') : 'No source reference supplied'}</p>
                                    </details>
                                    {current && <div className="mt-3 flex flex-wrap gap-2">
                                        {item.status === 'proposed' && <Button type="button" size="sm" variant="outline" disabled={!writable} onClick={() => void memory.confirm(item)}>Confirm note</Button>}
                                        <Button type="button" size="sm" variant="ghost" disabled={!writable} onClick={() => void memory.pin(item, !item.pinned)}>{item.pinned ? 'Unpin' : 'Pin'}</Button>
                                        {item.status === 'confirmed' && item.scope === 'workspace' && <Button type="button" size="sm" variant="ghost" disabled={!writable}
                                            title="Save it as a fact in the project's .agents/memory folder" onClick={() => void memory.move(item)}>Move to project memory</Button>}
                                        <Button type="button" size="sm" variant="ghost" disabled={!writable} onClick={() => setInactiveId(item.id)}>Mark inactive</Button>
                                    </div>}
                                    {inactiveId === item.id && current && <div className="mt-2 space-y-2 rounded border border-[var(--border-color)] p-2">
                                        <p className="text-xs">Stop using this note? Its record will remain in history.</p>
                                        <Button type="button" size="sm" variant="destructive" disabled={!writable} onClick={async () => { if (await memory.invalidate(item)) setInactiveId(null); }}>Confirm inactive</Button>
                                        <Button type="button" size="sm" variant="ghost" onClick={() => setInactiveId(null)}>Keep note</Button>
                                    </div>}
                                </li>;
                            })}
                        </ul>
                        {memory.pending && <p role="status" className="text-xs text-[var(--text-muted)]">Waiting for the Engine. Closing does not undo an in-flight save; reopen and Refresh to check.</p>}
                    </>}
                </div>
            </DialogContent>
        </div>
    </Dialog>;
}

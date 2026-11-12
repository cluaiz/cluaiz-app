import { callCep } from '../../client/cep';
import { ApiError } from '../../client/errors';
import type { CreateNote, EngineNote, NoteChange, NoteMove, NotesList, NotesListParams } from './notes.types';

export const NOTE_TEXT_MAX_BYTES = 2000;
export const noteTextBytes = (text: string) => new TextEncoder().encode(text.trim()).length;
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const nullable = (value: unknown) => value === null || text(value);
const invalid = () => new ApiError('Engine returned an invalid notes response', 200, 'INVALID_NOTES_RESPONSE');
const inputError = (message: string) => new ApiError(message, 400, 'INVALID_NOTE_INPUT');
const scopes = new Set(['chat', 'workspace', 'global']);
const statuses = new Set(['proposed', 'confirmed', 'active', 'superseded', 'invalidated', 'moved']);
const ended = new Set(['superseded', 'invalidated', 'moved']);

/** A note the Engine still uses: not replaced, made inactive or moved into project memory. */
export const isCurrentNote = (note: Pick<EngineNote, 'status'>) => !ended.has(note.status);

function note(value: unknown): EngineNote {
  if (!object(value) || !text(value.id) || !text(value.text) || !text(value.scope) || !scopes.has(value.scope)
    || !text(value.status) || !statuses.has(value.status) || !nullable(value.owner) || typeof value.pinned !== 'boolean'
    || !text(value.by) || !Array.isArray(value.sources) || !value.sources.every(text)
    || !text(value.valid_from) || !text(value.updated_at) || !nullable(value.invalid_at) || !nullable(value.supersedes)
    || !Number.isFinite(Date.parse(value.valid_from)) || !Number.isFinite(Date.parse(value.updated_at))
    || (value.invalid_at !== null && !Number.isFinite(Date.parse(String(value.invalid_at))))
    || (value.scope === 'chat' && !text(value.owner))) throw invalid();
  return value as unknown as EngineNote;
}
function change(value: unknown): NoteChange {
  if (!object(value)) throw invalid();
  const result = { note: note(value.note), superseded: value.superseded === null ? null : note(value.superseded) };
  if (result.superseded && (result.superseded.status !== 'superseded' || result.superseded.id === result.note.id
    || result.note.supersedes !== result.superseded.id || result.superseded.scope !== result.note.scope
    || result.superseded.owner !== result.note.owner)) throw invalid();
  return result;
}
function id(value: string) { if (!text(value)) throw inputError('A note id is required'); }

/** One typed notes boundary. Mutations are never retried by this adapter. */
export const notesApi = {
  list: async (params: NotesListParams = {}, signal?: AbortSignal): Promise<NotesList> => {
    if ((params.chat_id !== undefined && !text(params.chat_id))
      || (params.scope !== undefined && !scopes.has(params.scope))
      || (params.status !== undefined && !statuses.has(params.status))) throw inputError('Invalid notes filter');
    const result = await callCep<unknown>('notes.list', params, { signal });
    if (!object(result) || !text(result.workspace) || !Array.isArray(result.notes)) throw invalid();
    const notes = result.notes.map(note);
    if (new Set(notes.map(item => item.id)).size !== notes.length) throw invalid();
    if (notes.some(item => (params.scope && item.scope !== params.scope) || (params.status && item.status !== params.status))) throw invalid();
    return { workspace: result.workspace, notes };
  },
  create: async (params: CreateNote, signal?: AbortSignal): Promise<NoteChange> => {
    const trimmed = params.text.trim();
    if (!trimmed || noteTextBytes(trimmed) > NOTE_TEXT_MAX_BYTES) throw inputError('Note text must be 1–2000 UTF-8 bytes');
    if (!scopes.has(params.scope) || (params.scope === 'chat' && !text(params.chat_id))
      || (params.pinned !== undefined && typeof params.pinned !== 'boolean')) throw inputError('Invalid note scope or pin state');
    const result = change(await callCep('notes.create', { ...params, text: trimmed }, { signal }));
    // In a project the Engine keeps a workspace note as a project memory fact: it comes back `moved`.
    const saved = result.note.status === 'confirmed' || (params.scope === 'workspace' && result.note.status === 'moved' && text(result.note.moved_to));
    if (result.note.text !== trimmed || result.note.scope !== params.scope || !saved
      || result.note.by !== 'user' || (params.scope === 'chat' && result.note.owner !== params.chat_id)
      || (params.pinned === true && !result.note.pinned)) throw invalid();
    // The Engine can carry an existing pin forward when superseding a live note.
    return result;
  },
  confirm: (noteId: string, signal?: AbortSignal) => update('notes.confirm', noteId, {}, item => item.status === 'confirmed', signal),
  invalidate: (noteId: string, signal?: AbortSignal) => update('notes.invalidate', noteId, {}, item => item.status === 'invalidated' && item.invalid_at !== null, signal),
  pin: (noteId: string, pinned: boolean, signal?: AbortSignal) => {
    if (typeof pinned !== 'boolean') throw inputError('Pin state must be true or false');
    return update('notes.pin', noteId, { pinned }, item => item.pinned === pinned, signal);
  },
  /** A confirmed workspace note becomes a fact in the project's `.agents/memory/`. */
  move: async (noteId: string, signal?: AbortSignal): Promise<NoteMove> => {
    id(noteId);
    const result = await callCep<unknown>('notes.move', { id: noteId }, { signal });
    if (!object(result) || !object(result.note) || result.note.id !== noteId || result.note.status !== 'moved'
      || !text(result.note.moved_to) || !object(result.project_fact) || !text(result.project_fact.name)) throw invalid();
    return { note_id: noteId, moved_to: result.note.moved_to, fact: result.project_fact.name };
  },
};

async function update(method: string, noteId: string, params: object, matches: (item: EngineNote) => boolean, signal?: AbortSignal): Promise<NoteChange> {
  id(noteId);
  const result = change(await callCep(method, { id: noteId, ...params }, { signal }));
  if (result.note.id !== noteId || !matches(result.note)) throw invalid();
  return result;
}

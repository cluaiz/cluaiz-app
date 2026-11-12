/** Durable Engine NoteStore records, separate from UI notebooks and saved KV. */
export type NoteScope = 'chat' | 'workspace' | 'global';
export type NoteStatus = 'proposed' | 'confirmed' | 'active' | 'superseded' | 'invalidated' | 'moved';

export interface EngineNote {
  id: string;
  text: string;
  scope: NoteScope;
  owner: string | null;
  status: NoteStatus;
  pinned: boolean;
  by: string;
  sources: string[];
  valid_from: string;
  updated_at: string;
  invalid_at: string | null;
  supersedes: string | null;
  /** For a `moved` note: the project memory file it became */
  moved_to?: string;
}
export interface NotesListParams { chat_id?: string; scope?: NoteScope; status?: NoteStatus }
export interface NotesList { workspace: string; notes: EngineNote[] }
export interface CreateNote { text: string; scope: NoteScope; chat_id?: string; pinned?: boolean }
export interface NoteChange { note: EngineNote; superseded: EngineNote | null }
export interface NoteMove { note_id: string; moved_to: string; fact: string }

import { callCepTask } from '../../client/cepTask';
import { ApiError } from '../../client/errors';

export interface AppChatImportRow {
    chat_id: string; status: string; from?: string; messages?: number; tool_calls?: number; events?: number; error?: string;
}
export interface AppChatImport { roots?: string[]; chats: AppChatImportRow[] }

const object = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);

/** Copies the App's old chats into Engine event logs; chats that already have one are skipped. */
export async function importAppChats(dryRun: boolean, signal?: AbortSignal): Promise<AppChatImport> {
    const result = await callCepTask<unknown>('chat.import_app', { all: true, dry_run: dryRun }, signal);
    if (!object(result) || !Array.isArray(result.chats)
        || !result.chats.every(row => object(row) && typeof row.chat_id === 'string' && typeof row.status === 'string')) {
        throw new ApiError('Engine returned an invalid import result', 200, 'INVALID_CHAT_RESPONSE', 'chat.import_app');
    }
    return result as unknown as AppChatImport;
}

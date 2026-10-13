import { ipc, isTauri } from '../../client';
import { TAURI_COMMANDS } from '../native';
import { fsApi } from '../../engine/fs';

export const dialogApi = {
  /**
   * Triggers host native folder picker dialog.
   * - Desktop Mode (Tauri WebView): Direct Tauri IPC to pick_folder.
   * - Web Browser Mode: Cluaiz Engine native endpoint POST /v1/fs/pick_folder.
   */
  pickFolder: async (): Promise<string | null> => {
    // 1. Desktop Mode (Tauri WebView) — Direct IPC
    if (isTauri()) {
      try {
        return (await ipc.invoke<string | null>(TAURI_COMMANDS.PICK_FOLDER)) ?? null;
      } catch (err: any) {
        console.error('[dialogApi.pickFolder] Tauri IPC error:', err);
        throw new Error(err?.message || 'Tauri folder picker failed');
      }
    }

    // 2. Browser Mode — Cluaiz Engine native folder picker
    const res = await fsApi.pickFolder();
    if (res && res.status === 'success' && res.path) {
      return res.path;
    }

    return null;
  },
};

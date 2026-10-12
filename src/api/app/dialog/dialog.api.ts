import { ipc, isTauri } from '../../client';
import { TAURI_COMMANDS } from '../native';
import { fsApi } from '../../engine/fs';

export const dialogApi = {
  /**
   * Triggers host native folder picker dialog.
   * - Desktop Mode (Tauri WebView): Direct Tauri IPC to pick_folder.
   * - Web Browser Mode: Direct Cluaiz Engine native endpoint (/v1/fs/pick_folder) with Bearer token authentication.
   */
  pickFolder: async (): Promise<string | null> => {
    // 1. Desktop Mode (Tauri WebView) — Direct IPC to mod.rs pick_folder
    if (isTauri()) {
      try {
        return (await ipc.invoke<string | null>(TAURI_COMMANDS.PICK_FOLDER)) ?? null;
      } catch (err: any) {
        console.error('[dialogApi.pickFolder] Tauri IPC pick_folder error:', err);
        throw new Error(err?.message || 'Tauri folder picker failed');
      }
    }

    // 2. Web Browser Mode — Direct Cluaiz Engine native endpoint with Bearer auth token
    const res = await fsApi.pickFolder();
    if (res && res.status === 'success' && res.path) {
      return res.path;
    }
    return null;
  },
};



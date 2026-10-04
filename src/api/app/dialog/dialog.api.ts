import { ipc, isTauri } from '../../client';
import { TAURI_COMMANDS, getNativeBridgeUrl } from '../native';
import { DIALOG_ENDPOINTS } from './dialog.endpoints';

export const dialogApi = {
  /**
   * Triggers native OS folder picker dialog via Tauri IPC.
   * On Windows, forces foreground top-most focus so the dialog never hides behind windows.
   */
  pickFolder: async (): Promise<string | null> => {
    // 1. Desktop Mode (Tauri WebView) — Direct IPC to mod.rs pick_folder
    if (isTauri()) {
      return (await ipc.invoke<string | null>(TAURI_COMMANDS.PICK_FOLDER)) ?? null;
    }

    // 2. Web Browser Mode (Chrome / Edge at http://localhost:1420 or LAN IP / custom domain)
    // Calls the local Tauri HTTP bridge dynamically resolved from active host & port
    try {
      const bridgeUrl = getNativeBridgeUrl();
      const res = await fetch(`${bridgeUrl}${DIALOG_ENDPOINTS.PICK_FOLDER}`);
      if (res.ok) {
        const data = await res.json();
        return data.path ?? null;
      }
    } catch (err) {
      console.warn('[dialogApi.pickFolder] Local Tauri bridge unavailable:', err);
    }

    return null;
  },
};

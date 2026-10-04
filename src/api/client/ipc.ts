import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ApiError } from './errors';

/**
 * Checks if running inside a Tauri Desktop WebView
 */
export const isTauri = (): boolean => {
  return (
    typeof window !== 'undefined' &&
    ('__TAURI_INTERNALS__' in window ||
      '__TAURI__' in window ||
      '__TAURI_IPC__' in window ||
      Boolean((window as unknown as { __TAURI__?: unknown }).__TAURI__))
  );
};

export const ipc = {
  /**
   * Invokes a native Tauri command safely with error normalization
   */
  invoke: async <T = unknown>(command: string, args?: Record<string, unknown>): Promise<T> => {
    if (!isTauri()) {
      console.warn(`[IPC Mock] Skipped invoke('${command}') in Web mode.`);
      return undefined as unknown as T;
    }

    try {
      return await invoke<T>(command, args);
    } catch (err: unknown) {
      throw new ApiError(
        `IPC Command '${command}' failed: ${(err as Error)?.message || String(err)}`,
        500,
        'IPC_ERROR',
        `tauri://${command}`,
        err
      );
    }
  },

  /**
   * Subscribes to a native Tauri event
   */
  listen: async <T = unknown>(
    event: string,
    callback: (payload: T) => void
  ): Promise<() => void> => {
    if (!isTauri()) {
      return () => {};
    }

    try {
      const unlisten: UnlistenFn = await listen<T>(event, (ev) => {
        callback(ev.payload);
      });
      return () => unlisten();
    } catch (err) {
      console.error(`[IPC Listen Error] Failed to listen to '${event}':`, err);
      return () => {};
    }
  },

  /**
   * Window Controls (TitleBar bindings)
   */
  minimize: async (): Promise<void> => {
    if (isTauri()) {
      await getCurrentWindow().minimize();
    }
  },

  toggleMaximize: async (): Promise<void> => {
    if (isTauri()) {
      const win = getCurrentWindow();
      if (await win.isMaximized()) {
        await win.unmaximize();
      } else {
        await win.maximize();
      }
    }
  },

  close: async (): Promise<void> => {
    if (isTauri()) {
      await getCurrentWindow().close();
    }
  },
};

export const isTauriAvailable = isTauri;
export const invokeIpc = ipc.invoke;

import { ipc, isTauri } from '../../client';
import { NATIVE_COMMANDS } from './native.endpoints';
import { dialogApi } from '../dialog';

export const nativeApi = {
  isDesktop: (): boolean => isTauri(),

  bootEngine: async (): Promise<boolean> => {
    return (await ipc.invoke<boolean>(NATIVE_COMMANDS.BOOT_ENGINE)) ?? false;
  },

  updateEngineSettings: async (settings: Record<string, any>): Promise<boolean> => {
    return (await ipc.invoke<boolean>(NATIVE_COMMANDS.UPDATE_SETTINGS, { settings })) ?? false;
  },

  getSessionToken: async (): Promise<string | null> => {
    return (await ipc.invoke<string | null>(NATIVE_COMMANDS.GET_SESSION_TOKEN)) ?? null;
  },

  /**
   * Delegates folder picking to the dedicated dialogApi domain
   */
  pickFolder: async (): Promise<string | null> => {
    return dialogApi.pickFolder();
  },
};

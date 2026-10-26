import { callCep } from '../../client/cep';
import { getConfig, setConfig } from '../config/config.api';
import type {
  StorageStatus,
  StorageSettings,
  CleanStorageResponse,
} from './storage.types';

/**
 * Pure Stateless Storage API Service
 */
export const storageApi = {
  /**
   * Fetches temporary media usage statistics from the engine
   */
  getTempMediaStatus: (): Promise<StorageStatus> => {
    return callCep<StorageStatus>('storage.status');
  },

  /**
   * Cleans all temporary media stored in the engine workspace
   */
  cleanTempMedia: (): Promise<CleanStorageResponse> => {
    return callCep<CleanStorageResponse>('storage.clean');
  },

  /**
   * Fetches active storage control settings
   */
  getStorageSettings: (): Promise<StorageSettings> => {
    return getConfig('storage');
  },

  /**
   * Updates storage control settings on the engine
   */
  updateStorageSettings: async (
    settings: Partial<StorageSettings>
  ): Promise<{ status: string; storage: StorageSettings }> => {
    return { status: 'success', storage: await setConfig('storage', settings) };
  },
};

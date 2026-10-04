import { client } from '../../client';
import { STORAGE_ENDPOINTS } from './storage.endpoints';
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
    return client.get<StorageStatus>(STORAGE_ENDPOINTS.TEMP_MEDIA);
  },

  /**
   * Cleans all temporary media stored in the engine workspace
   */
  cleanTempMedia: (): Promise<CleanStorageResponse> => {
    return client.post<CleanStorageResponse>(STORAGE_ENDPOINTS.CLEAN_TEMP_MEDIA, {});
  },

  /**
   * Fetches active storage control settings
   */
  getStorageSettings: (): Promise<StorageSettings> => {
    return client.get<StorageSettings>(STORAGE_ENDPOINTS.SETTINGS);
  },

  /**
   * Updates storage control settings on the engine
   */
  updateStorageSettings: (
    settings: Partial<StorageSettings>
  ): Promise<{ status: string; message?: string }> => {
    return client.post<{ status: string; message?: string }>(
      STORAGE_ENDPOINTS.SETTINGS,
      settings
    );
  },
};

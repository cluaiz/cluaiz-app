/**
 * Cluaiz Engine Storage Type Definitions
 * Temporary-media CEP results and the saved config.storage section.
 */

export interface StorageStatus {
  status?: string;
  file_count: number;
  total_size_bytes: number;
  total_size_mb?: string;
  human_size?: string;
  [key: string]: unknown;
}

export interface StorageSettings {
  cleanup_policy: 'Immediate' | 'Hourly' | 'Daily' | 'Never' | string;
}

export interface CleanStorageResponse {
  removed_files: number;
  freed_bytes: number;
}

/**
 * Cluaiz Engine Storage Type Definitions
 * Matched 1:1 to Rust schema in cluaiz/inference-engine/api/src/handlers/storage.rs
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
  max_temp_media_gb?: number;
  auto_clean_interval_hours?: number;
  enable_auto_clean?: boolean;
  [key: string]: unknown;
}

export interface CleanStorageResponse {
  status: string;
  message: string;
}

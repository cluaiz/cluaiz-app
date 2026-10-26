/**
 * Cluaiz Engine Models Type Definitions
 * App-facing model containers. models.list returns an array on the CEP wire;
 * the adapter retains installed/models/count for existing App consumers.
 */

export interface ModelMetadata {
  context_window?: number;
  parameters?: string;
  architecture?: string;
  quantization?: string;
  tts_family?: string;
  stt_family?: string;
  [key: string]: unknown;
}

export interface ModelFileEntry {
  name: string;
  size_bytes?: number;
  is_primary?: boolean;
}

export interface ModelRegistryEntry {
  id: string;
  name?: string;
  category?: string;
  format?: string;
  format_type?: string;
  local_dir?: string;
  supported_tasks?: string[];
  metadata?: ModelMetadata;
  files?: ModelFileEntry[];
  [key: string]: unknown;
}

export interface InstalledModelsResponse {
  status?: string;
  count: number;
  installed: ModelRegistryEntry[];
  models?: ModelRegistryEntry[];
  installed_models?: Record<string, ModelRegistryEntry>;
}

export interface OpenAiModelRecord {
  id: string;
  object: string;
  created: number;
  owned_by: string;
  category?: string;
  context_window?: number;
}

export interface OpenAiModelsResponse {
  object: string;
  data: OpenAiModelRecord[];
}

export interface AvailableModelsResponse {
  success: boolean;
  system_ram_gb: string;
  available_models: unknown[];
}

export type { HardwareDetectorStats, HardwareStatusResponse } from '../system/system.types';

export interface InspectHeaderResponse {
  model: string;
  file: string;
  metadata: Record<string, unknown>;
  int_arrays: Record<string, number[]>;
  speech_languages: string[];
  tensors: Array<{name: string; dims: number[]; ggml_type: number; offset: number; size_bytes: number}>;
}

export interface TagModelDetails {
  format?: string;
  family?: string;
  parameter_size?: string;
}

export interface TagModelItem {
  name: string;
  size: number;
  details?: TagModelDetails;
}

export interface TagsResponse {
  models: TagModelItem[];
}

export interface DownloadModelPayload {
  model_id?: string;
  [key: string]: unknown;
}

export interface DownloadModelResponse {
  status: 'success';
  model: string;
  path: string | null;
  downloaded: boolean;
}

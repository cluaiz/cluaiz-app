/**
 * Cluaiz Engine Models Type Definitions
 * Matched 1:1 to Rust schema in cluaiz/inference-engine/api/src/handlers/models.rs
 */

export interface ModelMetadata {
  context_window?: number;
  parameters?: string;
  architecture?: string;
  quantization?: string;
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
  local_dir?: string;
  supported_tasks?: string[];
  metadata?: ModelMetadata;
  files?: ModelFileEntry[];
  [key: string]: unknown;
}

export interface InstalledModelsResponse {
  status: string;
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

export interface HardwareDetectorStats {
  vram_gb?: number;
  ram_gb?: number;
  gpu_name?: string;
  cpu_cores?: number;
  has_gpu?: boolean;
  [key: string]: unknown;
}

export interface HardwareStatusResponse {
  success: boolean;
  hardware: HardwareDetectorStats;
}

export interface InspectHeaderResponse {
  status: string;
  model_id: string;
  supported_tasks?: string[];
  file_path?: string;
  format?: 'GGUF' | 'ONNX' | string;
  tensor_count?: number;
  metadata_kv?: Record<string, unknown>;
  tensors_shape_map?: Record<string, unknown>;
  message?: string;
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
  success: boolean;
  status: string;
}

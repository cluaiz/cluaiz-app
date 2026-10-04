/**
 * Cluaiz Engine Inference Type Definitions
 * Matched 1:1 to Rust structs:
 * - cluaiz/inference-engine/engines/core/src/hardware/schema/gguf_metadata.rs
 * - cluaiz/inference-engine/engines/core/src/hardware/schema/onnx_metadata.rs
 */

export interface GgufHardwareExecution {
  n_gpu_layers: number;
  n_ctx: number;
  no_mmap: boolean;
  override_tensor: string;
  batch_size: number;
  ubatch_size: number;
  parallel: number;
  spec_type: string;
  spec_draft_n_max: number;
}

export interface GgufTemplatingFlags {
  chat_template_file: string;
  chat_template_kwargs: string;
  jinja: boolean;
  fit: string;
}

export interface GgufSamplers {
  temp: number;
  top_p: number;
  top_k: number;
  min_p: number;
  presence_penalty: number;
  frequency_penalty: number;
  repeat_penalty: number;
  seed?: number | null;
}

export interface UserMovedFlags {
  think_mode: string;
  response_length: string;
}

export interface GgufMetadataHeaders {
  hardware_and_execution: GgufHardwareExecution;
  templating_flags: GgufTemplatingFlags;
  samplers: GgufSamplers;
  user_moved_flags: UserMovedFlags;
}

// Authoritative Gguf and Onnx engine types
export type GgufConfig = GgufMetadataHeaders;

export interface OnnxMetadataHeaders {
  n_gpu_layers: number;
  n_ctx: number;
  intra_op_num_threads: number;
  graph_optimization_level: string;
  enable_profiling: boolean;
  inter_op_num_threads: number;
  enable_mem_pattern: boolean;
  enable_cpu_mem_arena: boolean;
  execution_mode: string;
  gpu_mem_limit_bytes: number;
  arena_extend_strategy: string;
  enable_ort_transformers_optimization: boolean;
  kv_cache_data_type: string;
  use_deterministic_compute: boolean;
  user_moved_flags: UserMovedFlags;
  [key: string]: any;
}

export type OnnxConfig = OnnxMetadataHeaders;



export interface HardwareCalibrationResult {
  status: string;
  fingerprint?: string;
  message?: string;
}

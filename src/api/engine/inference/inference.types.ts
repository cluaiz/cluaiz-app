/**
 * Cluaiz Engine Inference Settings Types
 * Matched 1:1 to the engine API (cluaiz/api/src/handlers/system.rs: get/update_gguf_config,
 * get/update_onnx_config); every field is stored in settings.json.
 */

/** llama.cpp meanings: n_gpu_layers -1 = Auto, n_ctx 0 = Auto / -1 = Max / N tokens.
 *  null = automatic (engine default); a null sent back leaves the setting as it is. */
export interface GgufHardwareExecution {
  n_gpu_layers: number;
  n_ctx: number;
  no_mmap: boolean | null;
  batch_size: number | null;
  ubatch_size: number | null;
}

/** null = not set: the model's own default (then llama.cpp's) */
export interface GgufSamplers {
  temp: number | null;
  top_p: number | null;
  top_k: number | null;
  min_p: number | null;
  presence_penalty: number | null;
  frequency_penalty: number | null;
  repeat_penalty: number | null;
  seed?: number | null;
}

export interface UserMovedFlags {
  think_mode: 'Auto' | 'On' | 'Off' | string;
}

export interface GgufMetadataHeaders {
  hardware_and_execution: GgufHardwareExecution;
  samplers: GgufSamplers;
  user_moved_flags: UserMovedFlags;
}

export type GgufConfig = GgufMetadataHeaders;

/** ONNX engine settings (settings.json "onnx") */
export interface OnnxMetadataHeaders {
  /** -1 = GPU when available, 0 = CPU only */
  n_gpu_layers: number;
  intra_op_num_threads: number;
  enable_cpu_mem_arena: boolean;
  gpu_mem_limit_bytes: number;
  arena_extend_strategy: string;
  use_deterministic_compute: boolean;
}

export type OnnxConfig = OnnxMetadataHeaders;



export interface HardwareCalibrationResult {
  status: string;
  fingerprint?: string;
  message?: string;
}

/**
 * Cluaiz Engine LLM Optimization Type Definitions
 * Matched 1:1 to the Rust struct cluaiz/engine/core/src/settings.rs (OptimizationControl)
 */

export type FeatureState = 'On' | 'Off' | 'Auto';

export type KvCacheQuantization = 'Auto' | 'Kv16' | 'Kv8' | 'Kv4';

export type ContextShiftingMode =
  | 'Auto'
  | 'Off'
  | 'Minimal'
  | 'Standard'
  | 'Aggressive'
  | 'Extreme';

export interface ThinkingShare {
  share: number;
  max_tokens: number;
}

/** Same fields as the engine's OptimizationControl (settings.json "optimization"); null = automatic. */
export interface OptimizationControl {
  flash_attention: FeatureState;
  kv_cache_quantization: KvCacheQuantization;
  context_shifting: ContextShiftingMode;
  custom_vram_buffer_gb: number | null;
  custom_ram_buffer_gb: number | null;
  n_gpu_layers: number | null;
  think_mode: FeatureState;
  batch_size: number | null;
  ubatch_size: number | null;
  use_mmap: boolean | null;
  custom_context_window: number | null;
  n_cpu_moe: number | null;
  offload_kqv: boolean | null;
  n_threads: number | null;
  n_threads_batch: number | null;
  op_offload: boolean | null;
  reasoning_effort: string | number;
  thinking_presets: { low: ThinkingShare; medium: ThinkingShare; high: ThinkingShare };
  reasoning_budget_message: string | null;
}

export interface OptimizationStatusResponse {
  status: string;
  optimization: OptimizationControl;
  message?: string;
}

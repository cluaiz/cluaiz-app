/**
 * Cluaiz Engine LLM Optimization Type Definitions
 * Matched 1:1 to Rust schema:
 * cluaiz/inference-engine/engines/core/src/hardware/schema/optimization.rs
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

export interface OptimizationControl {
  flash_attention: FeatureState;
  kv_cache_quantization: KvCacheQuantization;
  hybrid_memory: FeatureState;
  force_memory_lock: FeatureState;
  context_shifting: ContextShiftingMode;
  speculative_decoding: FeatureState;
  draft_model_path?: string | null;
  extreme_moe_streaming: FeatureState;
  custom_vram_buffer_gb?: number | null;
  custom_ram_buffer_gb?: number | null;
  [key: string]: unknown;
}

export interface OptimizationStatusResponse {
  status: string;
  optimization: OptimizationControl;
  message?: string;
}

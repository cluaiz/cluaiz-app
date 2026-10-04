export interface EmbeddingRequest {
  input: string | string[];
  model?: string;
  encoding_format?: 'float' | 'base64' | string;
  user?: string;
}

export interface EmbeddingData {
  object: string;
  embedding: number[];
  index: number;
}

export interface EmbeddingUsage {
  prompt_tokens: number;
  total_tokens: number;
}

export interface EmbeddingResponse {
  object: string;
  data: EmbeddingData[];
  model: string;
  usage: EmbeddingUsage;
}

export interface OutputControls {
  return_text?: boolean;
  return_embeddings?: boolean;
}

export interface ChunkingStrategy {
  type?: string;
  max_chunk_size?: number;
  overlap?: number;
}

export interface VisionSettings {
  use_vision?: boolean;
  detail_level?: 'low' | 'high' | 'auto' | string;
  system_instruction?: string;
}

export interface IngestPayload {
  source: string | string[];
  namespace?: string;
  model?: string;
  output_controls?: OutputControls;
  chunking_strategy?: ChunkingStrategy;
  vision_settings?: VisionSettings;
}

export interface IngestResponse {
  status: string;
  chunks_processed: number;
  namespace?: string;
  message?: string;
  [key: string]: any;
}

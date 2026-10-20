export interface EmbeddingRequest {
  input: string | string[] | Array<{ type: 'text'; text: string } | { type: 'image'; source: string }>;
  model?: string;
  encoding_format?: 'float';
  user?: string;
  /** Minutes; 0 unloads after execution and -1 retains indefinitely. */
  keep_alive?: number;
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
  return_embeddings?: false;
}

export interface ChunkingStrategy {
  type?: 'semantic';
  /** Maximum UTF-8 bytes, not model tokens. */
  max_chunk_size?: number;
  overlap?: 0;
}

export interface IngestPayload {
  source: string | string[];
  output_controls?: OutputControls;
  chunking_strategy?: ChunkingStrategy;
}

export interface DocumentPart {
  page: number | null;
  method: string;
  text?: string;
  omissions: string[];
  warnings: string[];
  ocr_confidence?: number;
}

export interface IngestSource {
  source: string;
  status: 'ingested' | 'partial' | 'error';
  mime_type?: string;
  chunk_size?: number;
  chunks_count?: number;
  parts?: DocumentPart[];
  chunks?: string[];
  error?: string;
}

export interface IngestResponse {
  status: 'success' | 'partial' | 'error';
  total_sources: number;
  processed_sources: IngestSource[];
}

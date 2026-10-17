/**
 * Pure Chat Types (Zero Tools Pollution)
 * Matches routes.rs:22-25
 */
export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export type ChatMessagePart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } }
  | { type: 'file_url'; file_url: { url: string; name?: string; detail?: 'full' | 'summary' | 'auto' } }
  | { type: 'video_url'; video_url: { url: string; fps?: number } }
  | { type: 'input_audio'; input_audio: { data: string; format: 'wav' | 'mp3' } };

export interface ChatMessage {
  role: ChatRole;
  content: string | ChatMessagePart[];
  name?: string;
  tool_calls?: any[];
  tool_call_id?: string;
}

export type TemporaryChatMode = 'lite' | 'strict';

/** Actual request stages; work counts are absent when the engine cannot measure them. */
export interface ProcessingEvent {
  stage: 'queued' | 'model_loading' | 'reading' | 'decoding' | 'projector_loading' | 'encoding' | 'prefill' | 'generation' | 'request';
  state: 'running' | 'completed' | 'reused' | 'failed' | 'cancelled';
  elapsed_ms: number;
  attachment?: { message_index: number; part_index: number; frame_index?: number };
  work?: { completed: number; total: number; unit: string };
}

export interface ChatCompletionRequest {
  model?: string;
  messages: ChatMessage[];
  stream?: boolean;
  return_progress?: boolean;
  temporary_chat?: TemporaryChatMode;
  session_id?: string;
  think_mode?: boolean | string;
  /** Thinking budget: 'auto' | 'low' | 'medium' | 'high' | 'max' or a number of tokens */
  reasoning_effort?: 'auto' | 'low' | 'medium' | 'high' | 'max' | string | number;
  skip_reasoning?: boolean;
  keep_alive?: number;
  min_p?: number;
  repetition_penalty?: number;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  top_k?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
  seed?: number;
  response_format?: { type: 'json_object' | 'text'; [key: string]: any };
  tools?: any[];
  tool_choice?: any;
  [key: string]: any;
}

export interface ChatChoice {
  index: number;
  message: ChatMessage;
  finish_reason: string | null;
}

export interface ChatUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChatChoice[];
  usage?: ChatUsage;
}

export interface StreamControlRequest {
  stream_id: string;
  reason?: string;
}

export interface StreamControlResponse {
  status: 'cancelled' | 'skipped' | string;
  stream_id: string;
  message: string;
}

export interface ContextTelemetryQuery {
  model?: string;
  session_id?: string;
  tools?: string;
}

export interface ContextTelemetryResponse {
  model: string;
  session_id: string;
  max_context: number;
  current_usage: number;
  remaining_tokens: number;
  usage_percentage: number;
  active_tools_count: number;
  [key: string]: any;
}

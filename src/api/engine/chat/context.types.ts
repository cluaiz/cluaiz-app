import type { ChatCompletionRequest } from './chat.types';

/** Engine context planning, retained preflight reports, and idle indexer jobs (`context.*` over CEP). */
export type ContextHistoryMode = 'recent' | 'adaptive' | 'none';

export interface ContextPolicyConfig {
  mode?: string;
  history_mode?: string;
  cross_chat?: string;
  indexer?: string;
  confirm_remember?: boolean;
  recall_max_tokens?: number;
  max_notes?: number;
  reserve_answer_tokens?: number;
  reserve_thinking_tokens?: number;
  safety_margin_tokens?: number;
  protect_recent_turns?: number;
  protect_max_share?: number;
  compact_trigger_ratio?: number;
  compact_target_ratio?: number;
  [key: string]: unknown;
}

export interface ContextReserveBreakdown {
  answer: number;
  thinking: number;
  margin: number;
}

export interface ContextCompactionInfo {
  from_position?: number;
  to_position?: number;
  messages_replaced?: number;
  tokens_replaced?: number;
  summary_tokens?: number;
  summary?: string;
  [key: string]: unknown;
}

export interface ContextPlanNotes {
  system?: string[];
  with_message?: string[];
}

export interface ContextPlanReport {
  history_mode?: ContextHistoryMode | string;
  policy?: ContextPolicyConfig;
  n_ctx?: number;
  prompt_tokens?: number;
  reserve?: ContextReserveBreakdown;
  protected_tokens?: number;
  available_tokens?: number;
  used_tokens?: number;
  messages_over_budget?: number;
  needs_compaction?: boolean;
  compaction?: ContextCompactionInfo | null;
  recall?: Record<string, unknown> | null;
  notes?: ContextPlanNotes | null;
  task?: Record<string, unknown> | null;
  error?: string;
  [key: string]: unknown;
}

export interface ContextToolsReport {
  suggested?: unknown[];
  search_offered?: boolean;
  loaded_in_chat?: string[];
  bound?: string[];
  meta_tools?: boolean;
  auto_loaded?: string | null;
  hint_tokens?: number;
  system_tools_tokens?: number;
  format?: 'inline' | 'native' | string;
  template_tools_tokens?: number;
  conversation_tokens?: number;
  load_room_tokens?: number | null;
  token_counts?: string;
  estimate?: string;
  events?: unknown[];
  cards?: unknown[];
  [key: string]: unknown;
}

export interface ContextPreviewParams {
  chat_id: string;
  request: ChatCompletionRequest;
}

export interface ContextPreviewResponse {
  plan: ContextPlanReport;
  tools: ContextToolsReport;
}

export interface ContextReportsResponse {
  chat_id: string;
  reports: string[];
}

export interface ContextReportRecord {
  plan?: ContextPlanReport;
  tools?: ContextToolsReport;
  timing?: Record<string, number>;
}

export interface ContextReportResponse {
  chat_id: string;
  request_id: string;
  context_report: ContextReportRecord;
}

export interface ContextJobQueueItem {
  chat_id: string;
  answer_pos: number;
  kind: string;
}

export interface ContextJobCounts {
  done: number;
  failed: number;
  stopped: number;
  skipped: number;
}

export interface ContextJobRecentItem {
  chat: string;
  answer_pos: number;
  cold: boolean;
  outcome: string;
  ms: number;
}

export interface ContextJobsResponse {
  indexer: string;
  requests_in_flight: number;
  running: boolean;
  queue: ContextJobQueueItem[];
  counts: ContextJobCounts;
  recent: ContextJobRecentItem[];
}

/** Engine conversation memory contracts (`memory.*` over CEP). */
export type ConversationSearchScope = 'chat' | 'workspace' | 'all';

export interface ConversationEvent {
  v?: number;
  id?: string;
  chat?: string;
  seq: number;
  ts?: string;
  kind: string;
  [key: string]: unknown;
}

export interface ConversationEventsParams {
  chat_id: string;
  from_seq?: number;
  limit?: number;
}

export interface ConversationEventsResponse {
  chat_id: string;
  total: number;
  skipped_lines: number;
  next_from_seq: number | null;
  events: ConversationEvent[];
}

export interface ConversationCardEnrichment {
  title: string;
  motive?: string | null;
  summary?: string | null;
  keywords?: string[];
  by?: string;
}

export interface ConversationCardEntities {
  files: string[];
  urls: string[];
  numbers: string[];
  quoted: string[];
}

export interface ConversationCard {
  id?: string;
  pos: number;
  role: string;
  ts?: string;
  tokens?: number;
  trivial?: boolean;
  keywords?: string[];
  entities?: ConversationCardEntities;
  tools?: string[];
  files?: string[];
  signals?: string[];
  importance?: number;
  enrichment?: ConversationCardEnrichment | null;
  title?: string;
}

export interface ConversationEpisodeSummary {
  title: string;
  summary: string;
  by?: string;
}

export interface ConversationEpisode {
  id: string;
  first_pos: number;
  last_pos: number;
  start: string;
  end: string;
  messages: number;
  title: string;
  keywords: string[];
  files: string[];
  tools: string[];
  key_moments: number[];
  summary?: ConversationEpisodeSummary | null;
}

export interface ConversationTask {
  id: string;
  title: string;
  stage: string;
  from_pos: number;
  to_pos: number;
  files: string[];
  tools: string[];
  checkpoint: string;
  source: string;
}

export interface ConversationGraph {
  nodes?: Array<{ id: string; kind: string }>;
  edges?: Array<{ from: string; to: string; kind: string }>;
}

export interface ConversationIndexResponse {
  chat_id: string;
  cards: ConversationCard[];
  episodes: ConversationEpisode[];
  tasks: ConversationTask[];
  graph: ConversationGraph;
}

export interface ConversationSearchParams {
  chat_id: string;
  query: string;
  limit?: number;
  scope?: ConversationSearchScope;
  from?: string;
  to?: string;
  within_hours?: number;
}

export interface ConversationSearchHit {
  ref: string;
  score: number;
  why: string[];
  card: ConversationCard;
}

export interface ConversationSearchResponse {
  chat_id: string;
  query: string;
  scope: ConversationSearchScope;
  results: ConversationSearchHit[];
  text: string | null;
}

export interface ConversationItemResponse {
  chat_id: string;
  ref: string;
  card: ConversationCard;
  text: string;
}

export interface ConversationExportResponse {
  format: 'cluaiz-chat-export';
  version: 1;
  chat_id: string;
  events: ConversationEvent[];
  cards: ConversationCard[];
}

export interface ConversationToolGrant {
  tool: string;
  minutes_left: number;
}

export interface ConversationGrantsResponse {
  chat_id: string;
  grants: ConversationToolGrant[];
}

export interface RevokeGrantsResponse {
  chat_id: string;
  removed: number;
}

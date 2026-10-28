import { callCep } from '../../client/cep';
import { ApiError } from '../../client/errors';
import type {
  ConversationCard,
  ConversationEpisode,
  ConversationEvent,
  ConversationEventsParams,
  ConversationEventsResponse,
  ConversationExportResponse,
  ConversationGrantsResponse,
  ConversationIndexResponse,
  ConversationItemResponse,
  ConversationSearchParams,
  ConversationSearchResponse,
  ConversationTask,
  RevokeGrantsResponse,
} from './history.types';

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const count = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const refPattern = /^m:\d+$/;
const searchScopes = new Set(['chat', 'workspace', 'all']);
const invalid = (method: string) =>
  new ApiError('Engine returned an invalid conversation memory response', 200, 'INVALID_HISTORY_RESPONSE', method);
const inputError = (message: string, code = 'INVALID_HISTORY_INPUT') => new ApiError(message, 400, code);

function chatIdOf(value: string): string {
  if (!text(value)) throw inputError('A chat id is required', 'INVALID_CHAT_ID');
  return value;
}

function eventRecord(value: unknown, chatId: string, method: string): ConversationEvent {
  if (!object(value) || !count(value.seq) || value.seq < 1 || !text(value.kind)
    || (value.chat !== undefined && value.chat !== chatId)
    || (value.id !== undefined && !text(value.id))
    || (value.ts !== undefined && (!text(value.ts) || !Number.isFinite(Date.parse(value.ts))))) {
    throw invalid(method);
  }
  return value as unknown as ConversationEvent;
}

function cardRecord(value: unknown, method: string): ConversationCard {
  if (!object(value) || !count(value.pos) || !text(value.role)
    || (value.tokens !== undefined && !count(value.tokens))
    || (value.trivial !== undefined && typeof value.trivial !== 'boolean')
    || (value.keywords !== undefined && (!Array.isArray(value.keywords) || !value.keywords.every(k => typeof k === 'string')))
    || (value.tools !== undefined && (!Array.isArray(value.tools) || !value.tools.every(t => typeof t === 'string')))
    || (value.files !== undefined && (!Array.isArray(value.files) || !value.files.every(f => typeof f === 'string')))) {
    throw invalid(method);
  }
  return value as unknown as ConversationCard;
}

function episodeRecord(value: unknown): ConversationEpisode {
  if (!object(value) || !text(value.id) || !count(value.first_pos) || !count(value.last_pos)
    || value.last_pos < value.first_pos || !text(value.start) || !text(value.end) || !count(value.messages)
    || typeof value.title !== 'string' || !Array.isArray(value.keywords) || !Array.isArray(value.files)
    || !Array.isArray(value.tools) || !Array.isArray(value.key_moments) || !value.key_moments.every(count)) {
    throw invalid('memory.index');
  }
  return value as unknown as ConversationEpisode;
}

function taskRecord(value: unknown): ConversationTask {
  if (!object(value) || !text(value.id) || !text(value.title) || !text(value.stage)
    || !count(value.from_pos) || !count(value.to_pos) || value.to_pos < value.from_pos
    || !Array.isArray(value.files) || !Array.isArray(value.tools)
    || typeof value.checkpoint !== 'string' || !text(value.source)) {
    throw invalid('memory.index');
  }
  return value as unknown as ConversationTask;
}

/** Engine-owned conversation memory (`memory.*`); saved-KV-only controls remain in chatMemoryApi. */
export const chatHistoryApi = {
  getEvents: async (params: ConversationEventsParams, signal?: AbortSignal): Promise<ConversationEventsResponse> => {
    const chatId = chatIdOf(params.chat_id);
    if ((params.from_seq !== undefined && (!count(params.from_seq) || params.from_seq < 1))
      || (params.limit !== undefined && (!count(params.limit) || params.limit < 1 || params.limit > 5000))) {
      throw inputError('Invalid event pagination parameters');
    }
    const result = await callCep<unknown>('memory.events', {
      chat_id: chatId,
      ...(params.from_seq !== undefined && { from_seq: params.from_seq }),
      ...(params.limit !== undefined && { limit: params.limit }),
    }, { signal });
    if (!object(result) || result.chat_id !== chatId || !count(result.total) || !count(result.skipped_lines)
      || (result.next_from_seq !== null && (!count(result.next_from_seq) || result.next_from_seq < 1))
      || !Array.isArray(result.events)) {
      throw invalid('memory.events');
    }
    const events = result.events.map(item => eventRecord(item, chatId, 'memory.events'));
    if (params.from_seq !== undefined && events.some(item => item.seq < params.from_seq!)) throw invalid('memory.events');
    if (params.limit !== undefined && events.length > params.limit) throw invalid('memory.events');
    return { chat_id: chatId, total: result.total, skipped_lines: result.skipped_lines, next_from_seq: result.next_from_seq, events };
  },

  getIndex: async (chatId: string, signal?: AbortSignal): Promise<ConversationIndexResponse> => {
    chatIdOf(chatId);
    const result = await callCep<unknown>('memory.index', { chat_id: chatId }, { signal });
    if (!object(result) || result.chat_id !== chatId || !Array.isArray(result.cards)
      || !Array.isArray(result.episodes) || !Array.isArray(result.tasks) || !object(result.graph)) {
      throw invalid('memory.index');
    }
    const graph = result.graph;
    if ((graph.nodes !== undefined && (!Array.isArray(graph.nodes) || !graph.nodes.every(n => object(n) && text(n.id) && text(n.kind))))
      || (graph.edges !== undefined && (!Array.isArray(graph.edges) || !graph.edges.every(e => object(e) && text(e.from) && text(e.to) && text(e.kind))))) {
      throw invalid('memory.index');
    }
    return {
      chat_id: chatId,
      cards: result.cards.map(item => cardRecord(item, 'memory.index')),
      episodes: result.episodes.map(episodeRecord),
      tasks: result.tasks.map(taskRecord),
      graph: graph as ConversationIndexResponse['graph'],
    };
  },

  search: async (params: ConversationSearchParams, signal?: AbortSignal): Promise<ConversationSearchResponse> => {
    const chatId = chatIdOf(params.chat_id);
    const query = typeof params.query === 'string' ? params.query.trim() : '';
    const scope = params.scope ?? 'chat';
    if (!query || !searchScopes.has(scope)
      || (params.limit !== undefined && (!count(params.limit) || params.limit < 1 || params.limit > 50))
      || (params.within_hours !== undefined && (!count(params.within_hours) || params.within_hours < 1))
      || (params.from !== undefined && !text(params.from))
      || (params.to !== undefined && !text(params.to))) {
      throw inputError('Invalid conversation search query or filter');
    }
    const result = await callCep<unknown>('memory.search', {
      chat_id: chatId,
      query,
      ...(params.scope !== undefined && { scope: params.scope }),
      ...(params.limit !== undefined && { limit: params.limit }),
      ...(params.from !== undefined && { from: params.from.trim() }),
      ...(params.to !== undefined && { to: params.to.trim() }),
      ...(params.within_hours !== undefined && { within_hours: params.within_hours }),
    }, { signal });
    if (!object(result) || result.chat_id !== chatId || result.query !== query) throw invalid('memory.search');
    if (scope === 'workspace' || scope === 'all') {
      if (result.scope !== scope || typeof result.text !== 'string') throw invalid('memory.search');
      return { chat_id: chatId, query, scope, results: [], text: result.text };
    }
    if (!Array.isArray(result.results)) throw invalid('memory.search');
    const results = result.results.map(hit => {
      if (!object(hit) || !text(hit.ref) || !refPattern.test(hit.ref) || typeof hit.score !== 'number'
        || !Number.isFinite(hit.score) || !Array.isArray(hit.why) || !hit.why.every(w => typeof w === 'string')) {
        throw invalid('memory.search');
      }
      const card = cardRecord(hit.card, 'memory.search');
      if (`m:${card.pos}` !== hit.ref) throw invalid('memory.search');
      return { ref: hit.ref, score: hit.score, why: hit.why as string[], card };
    });
    return { chat_id: chatId, query, scope: 'chat', results, text: null };
  },

  getItem: async (chatId: string, ref: string, signal?: AbortSignal): Promise<ConversationItemResponse> => {
    chatIdOf(chatId);
    if (!text(ref) || !refPattern.test(ref)) throw inputError('A message reference must look like m:<position>');
    const result = await callCep<unknown>('memory.item', { chat_id: chatId, ref }, { signal });
    if (!object(result) || result.chat_id !== chatId || result.ref !== ref || typeof result.text !== 'string') {
      throw invalid('memory.item');
    }
    const card = cardRecord(result.card, 'memory.item');
    if (`m:${card.pos}` !== ref) throw invalid('memory.item');
    return { chat_id: chatId, ref, card, text: result.text };
  },

  exportChat: async (chatId: string, signal?: AbortSignal): Promise<ConversationExportResponse> => {
    chatIdOf(chatId);
    const result = await callCep<unknown>('memory.export', { chat_id: chatId }, { signal });
    if (!object(result) || result.format !== 'cluaiz-chat-export' || result.version !== 1
      || result.chat_id !== chatId || !Array.isArray(result.events) || !Array.isArray(result.cards)) {
      throw invalid('memory.export');
    }
    return {
      format: 'cluaiz-chat-export',
      version: 1,
      chat_id: chatId,
      events: result.events.map(item => eventRecord(item, chatId, 'memory.export')),
      cards: result.cards.map(item => cardRecord(item, 'memory.export')),
    };
  },

  getGrants: async (chatId: string, signal?: AbortSignal): Promise<ConversationGrantsResponse> => {
    chatIdOf(chatId);
    const result = await callCep<unknown>('memory.grants', { chat_id: chatId }, { signal });
    if (!object(result) || result.chat_id !== chatId || !Array.isArray(result.grants)) throw invalid('memory.grants');
    const grants = result.grants.map(grant => {
      if (!object(grant) || !text(grant.tool) || !count(grant.minutes_left)) throw invalid('memory.grants');
      return { tool: grant.tool, minutes_left: grant.minutes_left };
    });
    if (new Set(grants.map(g => g.tool)).size !== grants.length) throw invalid('memory.grants');
    return { chat_id: chatId, grants };
  },

  revokeGrants: async (chatId: string, tool?: string, signal?: AbortSignal): Promise<RevokeGrantsResponse> => {
    chatIdOf(chatId);
    if (tool !== undefined && !text(tool)) throw inputError('Tool name cannot be empty when revoking a grant');
    const result = await callCep<unknown>('memory.revoke_grants', {
      chat_id: chatId,
      ...(tool !== undefined && { tool: tool.trim() }),
    }, { signal });
    if (!object(result) || result.chat_id !== chatId || !count(result.removed)) throw invalid('memory.revoke_grants');
    return { chat_id: chatId, removed: result.removed };
  },

  deleteChat: async (chatId: string, signal?: AbortSignal): Promise<void> => {
    chatIdOf(chatId);
    const result = await callCep<Record<string, unknown>>('memory.delete', { chat_id: chatId }, { signal });
    const events = result?.events as { files?: unknown; bytes?: unknown } | undefined;
    if (!result || result.chat_id !== chatId || result.ledger !== true || typeof result.saved_kv !== 'boolean'
      || typeof result.folder_removed !== 'boolean' || !events
      || ![events.files, events.bytes].every(n => Number.isSafeInteger(n) && Number(n) >= 0)) {
      throw new ApiError('Engine returned an invalid chat deletion acknowledgment', 200, 'INVALID_HISTORY_RESPONSE');
    }
    if (!result.folder_removed) throw new ApiError('Engine chat folder remains; cleanup is incomplete', 200, 'PARTIAL_CHAT_DELETE');
  },
};

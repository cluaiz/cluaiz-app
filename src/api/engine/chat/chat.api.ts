import { http, streamSse, type SseOptions } from '../../client';
import { CHAT_ENDPOINTS } from './chat.endpoints';
import { callCep } from '../../client/cep';
import { ApiError } from '../../client/errors';
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  StreamControlRequest,
  StreamControlResponse,
  ContextTelemetryQuery,
  ContextTelemetryResponse,
} from './chat.types';

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const invalid = (method: string) => new ApiError('Engine returned an invalid chat control/context result',
  200, 'INVALID_CHAT_RESPONSE', method);

export interface ChatStreamOptions extends SseOptions {
  onStreamId?: (id: string) => void;
}

async function control(method: string, payload: StreamControlRequest, status: StreamControlResponse['status']) {
  if (typeof payload.stream_id !== 'string' || !payload.stream_id.trim()) {
    throw new ApiError('An actual Engine stream id is required', 400, 'INVALID_CHAT_REQUEST', method);
  }
  const value = await callCep<unknown>(method, { stream_id: payload.stream_id,
    ...(payload.reason !== undefined && { reason: payload.reason }) });
  if (!object(value) || value.stream_id !== payload.stream_id || value.status !== status) throw invalid(method);
  return value as unknown as StreamControlResponse;
}

function contextResult(value: unknown, query: ContextTelemetryQuery): ContextTelemetryResponse {
  if (!object(value) || typeof value.model !== 'string' || typeof value.chat_id !== 'string'
    || (query.model !== undefined && value.model !== query.model)
    || (query.session_id !== undefined && value.chat_id !== query.session_id)
    || !object(value.telemetry)) throw invalid('chat.telemetry');
  const telemetry = value.telemetry;
  const breakdown = telemetry.context_breakdown;
  if (!object(breakdown) || telemetry.active_session_id !== value.chat_id
    || !Number.isFinite(telemetry.kv_cache_vram_bytes_allocated) || Number(telemetry.kv_cache_vram_bytes_allocated) < 0) {
    throw invalid('chat.telemetry');
  }
  for (const field of ['total_context_limit', 'model_native_context', 'total_active_tokens', 'messages_tokens',
    'system_prompt_tokens', 'skills_tokens', 'plugins_tokens', 'mcp_tools_tokens', 'free_space_tokens',
    'active_percentage', 'messages_percentage', 'system_prompt_percentage', 'skills_percentage',
    'plugins_percentage', 'mcp_tools_percentage', 'free_space_percentage']) {
    const measurement = breakdown[field];
    if (!Number.isFinite(measurement) || Number(measurement) < 0
      || (field.endsWith('_percentage') ? Number(measurement) > 100 : !Number.isSafeInteger(measurement))) {
      throw invalid('chat.telemetry');
    }
  }
  const groups = Object.fromEntries(['skills', 'plugins', 'mcp_tools'].map(key => {
    const group = breakdown[key];
    if (!object(group) || !Array.isArray(group.items) || !Number.isSafeInteger(group.count) || Number(group.count) < 0
      || !Number.isSafeInteger(group.tokens) || Number(group.tokens) < 0
      || !Number.isFinite(group.percent) || Number(group.percent) < 0 || Number(group.percent) > 100) throw invalid('chat.telemetry');
    const items = group.items.map(item => {
      if (!object(item) || typeof item.name !== 'string' || !item.name || typeof item.status !== 'string'
        || !Number.isSafeInteger(item.tokens) || Number(item.tokens) < 0) {
        throw invalid('chat.telemetry');
      }
      return { ...item, id: item.name };
    });
    return [key, { ...group, items }];
  }));
  return { ...value, telemetry: { ...telemetry, context_breakdown: { ...breakdown, ...groups } } } as unknown as ContextTelemetryResponse;
}

export const chatApi = {
  /**
   * Non-streaming Chat Completion request.
   */
  createCompletion: async (payload: ChatCompletionRequest, signal?: AbortSignal): Promise<ChatCompletionResponse> => {
    return http.post<ChatCompletionResponse>(CHAT_ENDPOINTS.COMPLETIONS, {
      ...payload,
      stream: false,
    }, { signal });
  },

  /**
   * Real-time Streaming SSE Chat Completion with reasoning and token delta callbacks.
   */
  streamCompletion: async (
    payload: ChatCompletionRequest,
    options: ChatStreamOptions = {}
  ): Promise<void> => {
    return streamSse(
      CHAT_ENDPOINTS.COMPLETIONS,
      { ...payload, stream: true },
      { ...options, onEvent: event => {
        if (object(event)) {
          const id = typeof event.id === 'string' && event.id ? event.id : event.stream_id;
          if (typeof id === 'string' && id) options.onStreamId?.(id);
        }
        options.onEvent?.(event);
      } }
    );
  },

  /**
   * Cancels an active in-flight streaming LLM task and interrupts hardware inference.
   */
  cancelStream: async (payload: StreamControlRequest): Promise<StreamControlResponse> => {
    return control('chat.cancel', payload, 'cancelled');
  },

  /**
   * Requests the active native stream to end reasoning; unsupported models return a real refusal.
   */
  skipReasoning: async (payload: StreamControlRequest): Promise<StreamControlResponse> => {
    return control('chat.skip_reasoning', payload, 'skip_requested');
  },

  /**
   * Fetches context window telemetry (token budget, active tools, usage percentage).
   */
  getContextTelemetry: async (query: ContextTelemetryQuery = {}, signal?: AbortSignal): Promise<ContextTelemetryResponse> => {
    return contextResult(await callCep('chat.telemetry', {
      ...(query.model !== undefined && { model: query.model }),
      ...(query.session_id !== undefined && { chat_id: query.session_id }),
    }, { signal }), query);
  },
};

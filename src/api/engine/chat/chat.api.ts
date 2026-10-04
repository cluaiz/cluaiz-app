import { http, streamSse, type SseOptions } from '../../client';
import { CHAT_ENDPOINTS } from './chat.endpoints';
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  StreamControlRequest,
  StreamControlResponse,
  ContextTelemetryQuery,
  ContextTelemetryResponse,
} from './chat.types';

export const chatApi = {
  /**
   * Non-streaming Chat Completion request.
   */
  createCompletion: async (payload: ChatCompletionRequest): Promise<ChatCompletionResponse> => {
    return http.post<ChatCompletionResponse>(CHAT_ENDPOINTS.COMPLETIONS, {
      ...payload,
      stream: false,
    });
  },

  /**
   * Real-time Streaming SSE Chat Completion with reasoning and token delta callbacks.
   */
  streamCompletion: async (
    payload: ChatCompletionRequest,
    options: SseOptions = {}
  ): Promise<void> => {
    return streamSse(
      CHAT_ENDPOINTS.COMPLETIONS,
      { ...payload, stream: true },
      options
    );
  },

  /**
   * Cancels an active in-flight streaming LLM task and interrupts hardware inference.
   */
  cancelStream: async (payload: StreamControlRequest): Promise<StreamControlResponse> => {
    return http.post<StreamControlResponse>(CHAT_ENDPOINTS.CANCEL, payload);
  },

  /**
   * Forces the model to stop internal chain-of-thought thinking and jump to final answer.
   */
  skipReasoning: async (payload: StreamControlRequest): Promise<StreamControlResponse> => {
    return http.post<StreamControlResponse>(CHAT_ENDPOINTS.SKIP_REASONING, payload);
  },

  /**
   * Fetches context window telemetry (token budget, active tools, usage percentage).
   */
  getContextTelemetry: async (query: ContextTelemetryQuery): Promise<ContextTelemetryResponse> => {
    const params: Record<string, string | undefined> = {
      model: query.model,
      session_id: query.session_id,
      tools: query.tools,
    };
    return http.get<ContextTelemetryResponse>(CHAT_ENDPOINTS.CONTEXT_TELEMETRY, { params });
  },
};

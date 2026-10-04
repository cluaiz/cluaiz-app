import { create } from 'zustand';
import { type Status, errorMessage } from '../../client';
import { chatApi } from './chat.api';
import type {
  ChatCompletionRequest,
  ContextTelemetryResponse,
} from './chat.types';

export interface ChatState {
  activeStreamId: string | null;
  isStreaming: boolean;
  streamingContent: string;
  reasoningContent: string;
  telemetry: ContextTelemetryResponse | null;
  status: Status;
  error: string | null;

  // Actions
  streamChat: (
    req: ChatCompletionRequest,
    callbacks?: {
      onToken?: (token: string) => void;
      onReasoning?: (reasoning: string) => void;
    }
  ) => Promise<string>;
  cancelActiveStream: () => Promise<void>;
  skipThinking: () => Promise<void>;
  fetchTelemetry: (model?: string, sessionId?: string) => Promise<void>;
  clearStream: () => void;
  reset: () => void;
}

export const useChatStore = create<ChatState>((set, get) => {
  let abortController: AbortController | null = null;

  return {
    activeStreamId: null,
    isStreaming: false,
    streamingContent: '',
    reasoningContent: '',
    telemetry: null,
    status: 'idle',
    error: null,

    streamChat: async (req, callbacks) => {
      // Abort any prior stream if still active
      if (abortController) {
        abortController.abort();
      }
      abortController = new AbortController();

      const streamId = `chatcmpl-${Date.now()}`;
      set({
        activeStreamId: streamId,
        isStreaming: true,
        streamingContent: '',
        reasoningContent: '',
        status: 'pending',
        error: null,
      });

      let accumulatedContent = '';
      let accumulatedReasoning = '';

      try {
        await chatApi.streamCompletion(req, {
          signal: abortController.signal,
          onReasoning: (reasoning) => {
            accumulatedReasoning += reasoning;
            set({ reasoningContent: accumulatedReasoning });
            callbacks?.onReasoning?.(reasoning);
          },
          onToken: (token) => {
            accumulatedContent += token;
            set({ streamingContent: accumulatedContent });
            callbacks?.onToken?.(token);
          },
          onError: (err) => {
            const msg = errorMessage(err);
            set({ status: 'error', error: msg, isStreaming: false });
          },
        });

        set({ isStreaming: false, status: 'success' });
        return accumulatedContent;
      } catch (err: unknown) {
        const isAbort = (err as Error)?.name === 'AbortError';
        const msg = isAbort ? 'Chat generation cancelled' : errorMessage(err);
        set({ isStreaming: false, status: isAbort ? 'idle' : 'error', error: msg });
        throw err;
      } finally {
        abortController = null;
      }
    },

    cancelActiveStream: async () => {
      const { activeStreamId } = get();
      if (abortController) {
        abortController.abort();
        abortController = null;
      }

      if (activeStreamId) {
        try {
          await chatApi.cancelStream({ stream_id: activeStreamId });
        } catch {
          // Ignore network cancel errors if connection already closed
        }
      }

      set({ isStreaming: false, activeStreamId: null });
    },

    skipThinking: async () => {
      const { activeStreamId } = get();
      if (activeStreamId) {
        try {
          await chatApi.skipReasoning({ stream_id: activeStreamId });
        } catch (err) {
          set({ error: errorMessage(err) });
        }
      }
    },

    fetchTelemetry: async (model, sessionId) => {
      try {
        const res = await chatApi.getContextTelemetry({
          model,
          session_id: sessionId,
        });
        set({ telemetry: res, error: null });
      } catch (err) {
        set({ error: errorMessage(err) });
      }
    },

    clearStream: () => {
      set({
        activeStreamId: null,
        isStreaming: false,
        streamingContent: '',
        reasoningContent: '',
        status: 'idle',
        error: null,
      });
    },

    reset: () => {
      if (abortController) {
        abortController.abort();
        abortController = null;
      }
      set({
        activeStreamId: null,
        isStreaming: false,
        streamingContent: '',
        reasoningContent: '',
        telemetry: null,
        status: 'idle',
        error: null,
      });
    },
  };
});

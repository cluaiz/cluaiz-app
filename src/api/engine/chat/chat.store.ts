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
      const controller = new AbortController();
      abortController = controller;
      const ownsRequest = () => abortController === controller;

      set({
        activeStreamId: null,
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
          signal: controller.signal,
          onStreamId: id => { if (ownsRequest()) set({ activeStreamId: id }); },
          onReasoning: (reasoning) => {
            if (!ownsRequest()) return;
            accumulatedReasoning += reasoning;
            set({ reasoningContent: accumulatedReasoning });
            callbacks?.onReasoning?.(reasoning);
          },
          onToken: (token) => {
            if (!ownsRequest()) return;
            accumulatedContent += token;
            set({ streamingContent: accumulatedContent });
            callbacks?.onToken?.(token);
          },
          onError: (err) => {
            if (!ownsRequest()) return;
            const msg = errorMessage(err);
            set({ status: 'error', error: msg, isStreaming: false });
          },
        });

        if (ownsRequest()) set({ isStreaming: false, activeStreamId: null, status: 'success' });
        return accumulatedContent;
      } catch (err: unknown) {
        const isAbort = (err as Error)?.name === 'AbortError';
        const msg = isAbort ? 'Chat generation cancelled' : errorMessage(err);
        if (ownsRequest()) set({ isStreaming: false, activeStreamId: null, status: isAbort ? 'idle' : 'error', error: msg });
        throw err;
      } finally {
        if (ownsRequest()) abortController = null;
      }
    },

    cancelActiveStream: async () => {
      const { activeStreamId } = get();
      const controller = abortController;
      abortController = null;
      controller?.abort();
      set({ isStreaming: false, activeStreamId: null, status: 'idle' });

      if (activeStreamId) {
        try {
          await chatApi.cancelStream({ stream_id: activeStreamId });
        } catch (err) {
          const ended = (err as { data?: { type?: string } })?.data?.type === 'stream_not_found';
          // Local abort is immediate; other failures must not claim Engine acknowledgement.
          if (!ended && abortController === null) set({ error: errorMessage(err) });
        }
      }
    },

    skipThinking: async () => {
      const { activeStreamId } = get();
      if (activeStreamId) {
        try {
          await chatApi.skipReasoning({ stream_id: activeStreamId });
        } catch (err) {
          if (get().activeStreamId === activeStreamId) set({ error: errorMessage(err) });
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

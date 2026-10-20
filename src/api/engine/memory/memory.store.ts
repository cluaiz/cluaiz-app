import { create } from 'zustand';
import { type Status, errorMessage } from '../../client';
import { memoryApi } from './memory.api';
import type {
  EmbeddingRequest,
  EmbeddingData,
  IngestPayload,
  IngestResponse,
} from './memory.types';

export interface MemoryState {
  lastEmbeddings: EmbeddingData[];
  isIngesting: boolean;
  lastIngestResult: IngestResponse | null;
  status: Status | 'partial';
  error: string | null;

  // Actions
  generateEmbeddings: (req: EmbeddingRequest) => Promise<EmbeddingData[]>;
  ingestContent: (payload: IngestPayload) => Promise<IngestResponse | null>;
  reset: () => void;
}

export const useMemoryStore = create<MemoryState>((set) => ({
  lastEmbeddings: [],
  isIngesting: false,
  lastIngestResult: null,
  status: 'idle',
  error: null,

  generateEmbeddings: async (req) => {
    set({ status: 'pending', error: null, lastEmbeddings: [] });
    try {
      const res = await memoryApi.generateEmbeddings(req);
      const data = res.data || [];
      set({ lastEmbeddings: data, status: 'success', error: null });
      return data;
    } catch (err) {
      const msg = errorMessage(err);
      set({ status: 'error', error: msg });
      return [];
    }
  },

  ingestContent: async (payload) => {
    set({ isIngesting: true, status: 'pending', error: null, lastIngestResult: null });
    try {
      const res = await memoryApi.ingest(payload);
      set({
        isIngesting: false,
        lastIngestResult: res,
        status: res.status,
        error: res.status === 'success' ? null : res.processed_sources.flatMap(source => [
          ...(source.error ? [source.error] : []),
          ...(source.parts || []).flatMap(part => [...part.warnings, ...part.omissions]),
        ]).join('; ') || 'Document extraction is incomplete. Inspect the returned sources.',
      });
      return res;
    } catch (err) {
      const msg = errorMessage(err);
      set({ isIngesting: false, status: 'error', error: msg });
      return null;
    }
  },

  reset: () => {
    set({
      lastEmbeddings: [],
      isIngesting: false,
      lastIngestResult: null,
      status: 'idle',
      error: null,
    });
  },
}));

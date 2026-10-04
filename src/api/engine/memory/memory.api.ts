import { client } from '../../client';
import { MEMORY_ENDPOINTS } from './memory.endpoints';
import type {
  EmbeddingRequest,
  EmbeddingResponse,
  IngestPayload,
  IngestResponse,
} from './memory.types';

export const memoryApi = {
  /**
   * Generates high-dimension vector embeddings using active embedding slot model.
   */
  generateEmbeddings: async (payload: EmbeddingRequest): Promise<EmbeddingResponse> => {
    return client.post<EmbeddingResponse>(MEMORY_ENDPOINTS.EMBEDDINGS, payload);
  },

  /**
   * Ingests files or raw content into the local vector database with chunking and embeddings.
   */
  ingest: async (payload: IngestPayload): Promise<IngestResponse> => {
    return client.post<IngestResponse>(MEMORY_ENDPOINTS.INGEST, payload);
  },

  /**
   * File-specific ingestion endpoint.
   */
  ingestFile: async (payload: IngestPayload): Promise<IngestResponse> => {
    return client.post<IngestResponse>(MEMORY_ENDPOINTS.INGEST_FILE, payload);
  },
};

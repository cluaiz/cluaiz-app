import { callCep } from '../../client/cep';
import { ApiError } from '../../client/errors';
import type { LoadHistoryPage } from './models.types';

export interface LoadHistoryQuery {
  model?: string;
  from_seq?: number;
  limit?: number;
}

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const count = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;

/** Reads chat-model load, refusal, failure, and unload history from `models.load_history`. */
export async function readLoadHistory(query: LoadHistoryQuery = {}, signal?: AbortSignal): Promise<LoadHistoryPage> {
  const params: Record<string, unknown> = {};
  if (query.model !== undefined && query.model.trim()) params.model = query.model.trim();
  if (query.from_seq !== undefined) params.from_seq = query.from_seq;
  if (query.limit !== undefined) params.limit = query.limit;
  const result = await callCep<unknown>('models.load_history', params, { signal });
  if (!object(result) || !Array.isArray(result.records) || !count(result.total) || !count(result.skipped_lines)
    || (result.next_from_seq !== null && result.next_from_seq !== undefined && !count(result.next_from_seq))
    || result.records.some(record => !object(record) || !count(record.seq) || typeof record.at !== 'string'
      || typeof record.model !== 'string' || !count(record.ms))) {
    throw new ApiError('Engine returned an invalid load history page', 200, 'INVALID_MODELS_RESPONSE', 'models.load_history');
  }
  return {
    records: result.records as unknown as LoadHistoryPage['records'],
    total: result.total as number,
    skipped_lines: result.skipped_lines as number,
    next_from_seq: (result.next_from_seq ?? null) as number | null,
  };
}

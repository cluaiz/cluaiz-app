import { callCep } from '../../client/cep';
import { ApiError } from '../../client/errors';

export interface SystemEventRecord {
  seq: number;
  name: string;
  at: string;
  data: Record<string, unknown>;
}

export interface SystemEventsPage {
  events: SystemEventRecord[];
  next: number;
  latest_seq: number;
}

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const count = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;

/** Reads recent Engine events (`model.load_started`, `model.load_step`, …) after a cursor. */
export async function readSystemEvents(
  params: { after?: number; limit?: number; wait_ms?: number } = {},
  signal?: AbortSignal,
): Promise<SystemEventsPage> {
  const timeoutMs = params.wait_ms && params.wait_ms > 0 ? Math.min(30_000, params.wait_ms) + 5_000 : undefined;
  const result = await callCep<unknown>('system.events', params, { signal, ...(timeoutMs !== undefined && { timeoutMs }) });
  if (!object(result) || !Array.isArray(result.events) || !count(result.next) || !count(result.latest_seq)
    || result.events.some(event => !object(event) || !count(event.seq) || typeof event.name !== 'string'
      || typeof event.at !== 'string' || !object(event.data))) {
    throw new ApiError('Engine returned an invalid system events page', 200, 'INVALID_SYSTEM_RESPONSE', 'system.events');
  }
  return result as unknown as SystemEventsPage;
}

import { client } from './client';
import { ApiError } from './errors';
import type { RequestOptions } from './types';

export const CEP_ENDPOINT = '/v1/cep';
let requestId = 0;
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** HTTP success can contain a CEP failure; keep its domain code and approval data. */
export class CepError extends ApiError {
  constructor(public readonly code: number, message: string, public readonly data?: unknown) {
    super(message, 200, 'CEP_ERROR', CEP_ENDPOINT, { code, message, data });
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = 'CepError';
  }
}

/** All authentication, retry, timeout and transport ownership stays in ApiClient. */
export async function callCep<T>(method: string, params: object = {}, options?: RequestOptions): Promise<T> {
  requestId = requestId >= Number.MAX_SAFE_INTEGER ? 1 : requestId + 1;
  const id = requestId;
  const reply = await client.post<unknown>(CEP_ENDPOINT, { jsonrpc: '2.0', id, method, params }, options);
  const invalid = () => new ApiError('Engine returned an invalid CEP response', 200,
    'INVALID_CEP_RESPONSE', CEP_ENDPOINT);
  if (!object(reply) || reply.jsonrpc !== '2.0' || reply.id !== id) throw invalid();
  const hasResult = Object.prototype.hasOwnProperty.call(reply, 'result');
  const hasError = Object.prototype.hasOwnProperty.call(reply, 'error');
  if (hasResult === hasError) throw invalid();
  if (hasError) {
    if (!object(reply.error) || !Number.isInteger(reply.error.code) || typeof reply.error.message !== 'string') {
      throw invalid();
    }
    throw new CepError(reply.error.code as number, reply.error.message, reply.error.data);
  }
  return reply.result as T;
}

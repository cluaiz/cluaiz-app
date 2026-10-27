import { callCep } from '../../client/cep';
import { ApiError } from '../../client/errors';
import type { TokenListResponse, TokenGenerateResponse, TokenRevokeResponse } from './permission.types';

function invalid(method: string): never {
  // Never attach a token-bearing response to errors or logs.
  throw new ApiError('Engine returned an invalid API-key acknowledgment', 200, 'INVALID_TOKENS_RESPONSE', method);
}

function keys(value: unknown, method: string): TokenListResponse {
  const result = value as TokenListResponse | null;
  if (!result || !Array.isArray(result.tokens) || typeof result.api_auth_required !== 'boolean'
    || !result.tokens.every(token => typeof token === 'string' && token.trim().length > 0)
    || new Set(result.tokens).size !== result.tokens.length) invalid(method);
  return { tokens: result.tokens, api_auth_required: result.api_auth_required };
}

export async function listTokens(signal?: AbortSignal): Promise<TokenListResponse> {
  return keys(await callCep('tokens.list', {}, { signal }), 'tokens.list');
}

export async function createToken(): Promise<TokenGenerateResponse> {
  const method = 'tokens.create';
  const value = await callCep<{ token: string }>(method);
  const result = keys(value, method);
  if (typeof value.token !== 'string' || !result.tokens.includes(value.token)) invalid(method);
  return { ...result, token: value.token };
}

export async function revokeToken(token: string): Promise<TokenRevokeResponse> {
  if (typeof token !== 'string' || !token.trim() || token !== token.trim()) {
    throw new ApiError('An API key is required', 400, 'INVALID_TOKEN_REQUEST', 'tokens.revoke');
  }
  const method = 'tokens.revoke';
  const value = await callCep<{ revoked_token: string }>(method, { token });
  const result = keys(value, method);
  // App sends the complete key, not an index or ambiguous masked key.
  if (value.revoked_token !== token || result.tokens.includes(token)
    || (!result.tokens.length && result.api_auth_required)) invalid(method);
  return { ...result, revoked_token: value.revoked_token };
}

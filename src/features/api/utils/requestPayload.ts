import type { ApiEndpoint } from '../types';

/** Keep CEP's wire envelope intact while existing controls edit its params. */
export function requestParams(endpoint: ApiEndpoint | null, payload: Record<string, any>): Record<string, any> {
    if (!endpoint?.transport_path) return payload;
    if (payload.jsonrpc !== '2.0' || payload.method !== endpoint.path || !payload.params
        || typeof payload.params !== 'object' || Array.isArray(payload.params)) {
        throw new Error('CEP body does not match the selected method');
    }
    return payload.params;
}

export function parsedParams(body: string): Record<string, any> {
    const payload = JSON.parse(body || '{}');
    return payload?.jsonrpc === '2.0' ? payload.params || {} : payload;
}

/** Logical method identity is for selection; HTTP/native always receive the real route. */
export const requestPath = (endpoint: ApiEndpoint) => endpoint.transport_path || endpoint.path;
export const methodPath = (path: string) => path.includes('/') ? path.toLowerCase() : '/' + path.replace(/\./g, '/').toLowerCase();

export function isSpeechRequest(endpoint: ApiEndpoint | null, body: string): boolean {
    if (endpoint?.path === '/v1/audio/speech') return true;
    if (endpoint?.path !== 'audio.run') return false;
    try { return String(parsedParams(body).input_source?.type).toLowerCase() === 'text'; }
    catch { return false; }
}

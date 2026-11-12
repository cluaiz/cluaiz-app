import { callCep } from '../../client/cep';
import { ApiError } from '../../client/errors';

export interface AuditLine {
    ts: string; method: string; principal: string; scope?: string;
    ms?: number; code?: number | null; params_sha256?: string;
}
export interface AuditLog { path: string; lines: AuditLine[] }
export interface UpdateCheck {
    current: string; update_available: boolean;
    latest: { version: string; tag: string; url: string; prerelease: boolean; published_at?: string } | null;
}

const object = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const invalid = (method: string) => new ApiError('Engine returned an invalid response', 200, 'INVALID_SYSTEM_RESPONSE', method);

/** The newest lines of the CEP audit log, newest first. */
export async function readAuditLog(limit = 100, signal?: AbortSignal): Promise<AuditLog> {
    const result = await callCep<unknown>('system.audit', { limit }, { signal });
    if (!object(result) || !text(result.path) || !Array.isArray(result.lines)
        || !result.lines.every(line => object(line) && text(line.ts) && text(line.method) && text(line.principal))) {
        throw invalid('system.audit');
    }
    return result as unknown as AuditLog;
}

/** Whether a newer release is published. Installs nothing. */
export async function checkForUpdate(signal?: AbortSignal): Promise<UpdateCheck> {
    const result = await callCep<unknown>('system.update_check', {}, { signal });
    if (!object(result) || !text(result.current) || typeof result.update_available !== 'boolean'
        || (result.latest !== null && !(object(result.latest) && text(result.latest.version) && text(result.latest.url)))
        || (result.update_available && result.latest === null)) throw invalid('system.update_check');
    return result as unknown as UpdateCheck;
}

import { EXTENSION_STATE_LIMIT_BYTES } from '../storage';
import { MAX_EXTENSION_ACTIVE_JOBS, MAX_EXTENSION_JOB_HISTORY } from '../jobs';
import { ExtensionError, type GuestErrorCode } from './contract';

export const GUEST_PROTOCOL_VERSION = 1;
/** Control data + at most one small audio Blob. Large assets need a later owned transfer API. */
export const GUEST_LIMITS = Object.freeze({
    messageBytes: EXTENSION_STATE_LIMIT_BYTES + 64 * 1024,
    depth: 32, nodes: 24000, activeRequests: MAX_EXTENSION_ACTIVE_JOBS,
    handles: MAX_EXTENSION_JOB_HISTORY, handshakeMs: 10000,
    streamEvents: MAX_EXTENSION_JOB_HISTORY, streamTextBytes: 16 * 1024,
});
export const GUEST_METHODS = Object.freeze({
    'storage.get': 'storage.read', 'storage.set': 'storage.write', 'storage.remove': 'storage.write',
    'models.list': 'models.list', 'ai.generate': 'ai.generate', 'ai.stream': 'ai.stream',
    'audio.speech': 'audio.speech', 'audio.transcribe': 'audio.transcribe',
    'chat.create': 'chat.sessions', 'chat.open': 'chat.sessions',
    'chat.read': 'chat.sessions', 'chat.send': 'chat.send',
} as const);
export type GuestMethod = keyof typeof GUEST_METHODS;
export type WireValue = null | boolean | number | string | Blob | WireValue[] | { [key: string]: WireValue };
export type GuestMessage = { v: number; type: string; [key: string]: WireValue };
const encoder = new TextEncoder();
const fail = (): never => { throw new ExtensionError('PROTOCOL'); };

/** Bound before serialization. Reject cycles, non-JSON objects and callable/accessor payloads. */
export function wireCopy(input: unknown): WireValue {
    let nodes = 0;
    let bytes = 0;
    const ancestors = new Set<object>();
    function copy(value: unknown, depth: number): WireValue {
        if (++nodes > GUEST_LIMITS.nodes || depth > GUEST_LIMITS.depth) return fail();
        function charge(amount: number) {
            bytes += amount;
            if (bytes > GUEST_LIMITS.messageBytes) fail();
        }
        if (typeof value === 'string') {
            if (value.length > GUEST_LIMITS.messageBytes) return fail();
            charge(encoder.encode(JSON.stringify(value)).byteLength); return value;
        }
        if (value === null || typeof value === 'boolean') { charge(5); return value; }
        if (typeof value === 'number' && Number.isFinite(value)) { charge(24); return value; }
        if (typeof Blob !== 'undefined' && value instanceof Blob) { charge(value.size + 64); return value.slice(0, value.size, value.type); }
        if (!value || typeof value !== 'object' || ancestors.has(value)) return fail();
        const array = Array.isArray(value);
        if (!array && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return fail();
        ancestors.add(value);
        charge(2);
        const output: WireValue[] | Record<string, WireValue> = array ? [] : {};
        for (const key of Object.keys(value)) {
            const property = Object.getOwnPropertyDescriptor(value, key);
            if (!property || !('value' in property)) return fail();
            // Match JSON optional-property semantics; undefined array entries still fail.
            if (!array && property.value === undefined) continue;
            charge(encoder.encode(JSON.stringify(key)).byteLength + 2);
            const item = copy(property.value, depth + 1);
            if (array) {
                if (String((output as WireValue[]).length) !== key) return fail();
                (output as WireValue[]).push(item);
            } else {
                if (key === '__proto__' || key === 'prototype' || key === 'constructor') return fail();
                (output as Record<string, WireValue>)[key] = item;
            }
        }
        if (array && (output as WireValue[]).length !== (value as unknown[]).length) return fail();
        ancestors.delete(value);
        return output;
    }
    return copy(input, 0);
}
export function wireRecord(value: unknown): Record<string, WireValue> {
    if (!value || typeof value !== 'object' || Array.isArray(value) || value instanceof Blob) return fail();
    return value as Record<string, WireValue>;
}
export function exactKeys(value: Record<string, unknown>, keys: readonly string[]): void {
    if (Object.keys(value).length !== keys.length || keys.some(key => !Object.prototype.hasOwnProperty.call(value, key))) fail();
}
export function errorCode(value: unknown): GuestErrorCode {
    if (!['PROTOCOL', 'CLOSED', 'DENIED', 'UNAVAILABLE', 'INVALID_REQUEST', 'SERVICE_FAILED'].includes(value as string)) return fail();
    return value as GuestErrorCode;
}
/** Shape validation happens at ingress; operation-specific arguments are checked by the host. */
export function parseGuestMessage(input: unknown): GuestMessage {
    const message = wireRecord(wireCopy(input));
    if (message.v !== GUEST_PROTOCOL_VERSION || typeof message.type !== 'string') return fail();
    const fields: Record<string, string[]> = {
        hello: [], ready: ['host', 'theme'], request: ['id', 'method', 'args'],
        result: ['id', 'value'], error: ['id', 'code'], event: ['id', 'seq', 'event'],
        ack: ['id', 'seq'], cancel: ['id'], theme: ['value'], close: ['code'],
    };
    const required = fields[message.type];
    if (!required || !Object.prototype.hasOwnProperty.call(fields, message.type)) return fail();
    exactKeys(message, ['v', 'type', ...required]);
    if ('id' in message && (!Number.isSafeInteger(message.id) || (message.id as number) <= 0)) return fail();
    if ('seq' in message && (!Number.isSafeInteger(message.seq) || (message.seq as number) <= 0)) return fail();
    if (message.type === 'request' && (typeof message.method !== 'string' || !Array.isArray(message.args))) return fail();
    if (message.type === 'close' || message.type === 'error') errorCode(message.code);
    return message as GuestMessage;
}
export function guestMessage(type: string, body: Record<string, unknown> = {}): GuestMessage {
    return parseGuestMessage({ v: GUEST_PROTOCOL_VERSION, type, ...body });
}

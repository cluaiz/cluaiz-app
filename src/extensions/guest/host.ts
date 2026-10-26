import type { createExtensionSession } from '../sdk';
import type { ExtensionChatHandle, ExtensionTextRequest, ExtensionChatOptions, ExtensionTranscriptionRequest } from '../client';
import type { ExtensionJob } from '../jobs';
import { EXTENSION_CAPABILITIES, type ExtensionCapability } from '../manifest';
import type { SpeechRequest } from '../../api/engine/audio/audio.types';
import type { JsonValue } from '../storage';
import { ExtensionError, type GuestHost, type GuestErrorCode, type GuestChatReference } from './contract';
import { GUEST_LIMITS, GUEST_METHODS, guestMessage, parseGuestMessage, wireRecord, type GuestMethod, type WireValue } from './protocol';
import type { GuestTransport } from './transport';
import { validateGuestTheme, type GuestThemeSource } from './theme';

interface GuestHostOptions {
    transport: GuestTransport;
    /** Dedicated session created by the trusted host, never supplied by a guest message. */
    session: ReturnType<typeof createExtensionSession>;
    kind: GuestHost['kind'];
    supportedCapabilities: readonly ExtensionCapability[];
    theme?: GuestThemeSource;
}
const attachedSessions = new WeakSet<object>();
function invalid(): never { throw new ExtensionError('INVALID_REQUEST'); }
function string(value: unknown): string { if (typeof value !== 'string') return invalid(); return value; }
function fields(value: unknown, allowed: Record<string, 'string' | 'number' | 'boolean'>, required: readonly string[]) {
    const record = wireRecord(value);
    if (Object.keys(record).some(key => !Object.prototype.hasOwnProperty.call(allowed, key) || typeof record[key] !== allowed[key])
        || required.some(key => !Object.prototype.hasOwnProperty.call(record, key))) return invalid();
    return record;
}

/** Attach only after platform sender isolation is proven. This module does not authenticate a surface. */
export function attachExtensionHost(options: GuestHostOptions) {
    const { transport, session } = options;
    const supported = Object.freeze([...new Set(options.supportedCapabilities)]);
    if (supported.some(cap => !EXTENSION_CAPABILITIES.includes(cap))
        || !['web', 'desktop'].includes(options.kind)) throw new ExtensionError('INVALID_REQUEST');
    if (attachedSessions.has(session)) throw new ExtensionError('INVALID_REQUEST');
    attachedSessions.add(session);
    const granted = Object.freeze(session.sdk.grantedCapabilities.filter(cap => supported.includes(cap)));
    const descriptor: GuestHost = Object.freeze({ kind: options.kind, identity: session.sdk.identity,
        supportedCapabilities: supported, grantedCapabilities: granted });
    const active = new Map<number, { cancel(): void; emitted: number; acknowledged: number }>();
    const handles = new Map<string, ExtensionChatHandle>();
    let handleSequence = 0;
    let lastRequest = 0;
    let ready = false;
    let closed = false;
    let unsubscribe = () => {};
    let unwatchTheme = () => {};
    function close(code: GuestErrorCode = 'CLOSED', notify = true) {
        if (closed) return;
        closed = true;
        if (notify) { try { transport.send(guestMessage('close', { code })); } catch { /* already unavailable */ } }
        unsubscribe(); unwatchTheme();
        session.dispose(); active.clear(); handles.clear(); transport.close();
    }
    function send(type: string, body: Record<string, unknown>) {
        if (closed) return;
        try { transport.send(guestMessage(type, body)); } catch { close('PROTOCOL'); }
    }
    function issue(handle: ExtensionChatHandle): GuestChatReference {
        let token = [...handles].find(([, value]) => value.id === handle.id)?.[0];
        if (!token) {
            if (handles.size >= GUEST_LIMITS.handles) throw new ExtensionError('UNAVAILABLE');
            token = session.sdk.identity.instanceId + ':' + ++handleSequence;
            handles.set(token, handle);
        }
        return { id: handle.id, token };
    }
    function own(value: unknown): ExtensionChatHandle {
        const handle = handles.get(string(value));
        if (!handle) throw new ExtensionError('DENIED');
        return handle;
    }
    function dispatch(method: GuestMethod, args: WireValue[], event: (value: unknown) => void): ExtensionJob<unknown> | Promise<unknown> {
        const sdk = session.sdk;
        const arity: Record<GuestMethod, number> = { 'storage.get': 1, 'storage.set': 2, 'storage.remove': 1,
            'models.list': 0, 'ai.generate': 1, 'ai.stream': 1, 'audio.speech': 1, 'audio.transcribe': 1,
            'chat.create': 1, 'chat.open': 1, 'chat.read': 1, 'chat.send': 2 };
        if (args.length !== arity[method]) return invalid();
        switch (method) {
            case 'storage.get': return Promise.resolve(sdk.storage.get(string(args[0])));
            case 'storage.set': {
                // JSON state must never contain Blob/non-JSON data.
                const json = JSON.stringify(args[1], (_key, value) => { if (value instanceof Blob) invalid(); return value; });
                sdk.storage.set(string(args[0]), JSON.parse(json) as JsonValue); return Promise.resolve(null);
            }
            case 'storage.remove': sdk.storage.remove(string(args[0])); return Promise.resolve(null);
            case 'models.list': return sdk.models.list();
            case 'ai.generate': case 'ai.stream': {
                const request = fields(args[0], { model: 'string', input: 'string', maxTokens: 'number' }, ['model', 'input']);
                if (method === 'ai.generate') return sdk.ai.generate(request as unknown as ExtensionTextRequest);
                return sdk.ai.stream(request as unknown as ExtensionTextRequest, event);
            }
            case 'audio.speech': {
                const request = fields(args[0], { model: 'string', input: 'string', voice: 'string', language: 'string',
                    response_format: 'string', speed: 'number', keep_alive: 'number', stream: 'boolean' }, ['input']);
                if (request.stream === true) throw new ExtensionError('UNAVAILABLE');
                return sdk.audio.speech(request as unknown as SpeechRequest);
            }
            case 'audio.transcribe': {
                const request = fields(args[0], { file: 'string', model: 'string', language: 'string' }, ['file']);
                // No guest-supplied OS path or URL. Source-handle/file-picker authority is a later API.
                if (!/^data:audio\/[a-z0-9.+-]+;base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/i.test(string(request.file))) {
                    throw new ExtensionError('DENIED');
                }
                return sdk.audio.transcribe(request as unknown as ExtensionTranscriptionRequest);
            }
            case 'chat.create': {
                if (handles.size >= GUEST_LIMITS.handles) throw new ExtensionError('UNAVAILABLE');
                const options = args[0] === null ? undefined : fields(args[0], { title: 'string', incognito: 'boolean' }, []) as ExtensionChatOptions;
                const job = sdk.chat.create(options);
                return { ...job, result: job.result.then(issue) };
            }
            case 'chat.open': {
                const job = sdk.chat.open(string(args[0]));
                return { ...job, result: job.result.then(issue) };
            }
            case 'chat.read': return sdk.chat.read(own(args[0]));
            case 'chat.send': {
                const request = fields(args[1], { model: 'string', input: 'string', maxTokens: 'number' }, ['model', 'input']);
                return sdk.chat.send(own(args[0]), request as unknown as ExtensionTextRequest, event);
            }
        }
    }
    function receive(input: unknown) {
        try {
            const message = parseGuestMessage(input);
            if (message.type === 'close') { close('CLOSED', false); return; }
            if (message.type === 'hello' && !ready) {
                ready = true;
                send('ready', { host: descriptor, theme: options.theme ? validateGuestTheme(options.theme.current()) : null });
                if (!closed && options.theme) unwatchTheme = options.theme.subscribe(() => {
                    try { send('theme', { value: validateGuestTheme(options.theme!.current()) }); } catch { close('PROTOCOL'); }
                });
                return;
            }
            if (!ready) throw new ExtensionError('PROTOCOL');
            const id = message.id as number;
            if (message.type === 'cancel') { active.get(id)?.cancel(); return; }
            if (message.type === 'ack') {
                const job = active.get(id);
                if (!job) return; // Completion/cancellation can precede delivery of the last ack.
                if (message.seq !== job.acknowledged + 1 || (message.seq as number) > job.emitted) throw new ExtensionError('PROTOCOL');
                job.acknowledged++;
                return;
            }
            if (message.type !== 'request' || id <= lastRequest) throw new ExtensionError('PROTOCOL');
            lastRequest = id;
            if (active.size >= GUEST_LIMITS.activeRequests) { close('PROTOCOL'); return; }
            if (!Object.prototype.hasOwnProperty.call(GUEST_METHODS, message.method as string)) {
                send('error', { id, code: 'UNAVAILABLE' }); return;
            }
            const method = message.method as GuestMethod;
            const capability = GUEST_METHODS[method];
            if (!supported.includes(capability)) { send('error', { id, code: 'UNAVAILABLE' }); return; }
            if (!granted.includes(capability)) { send('error', { id, code: 'DENIED' }); return; }
            try {
                const event = (value: unknown) => {
                    const owned = active.get(id);
                    if (!owned) return;
                    const data = wireRecord(value);
                    if (typeof data.text !== 'string'
                        || data.text.length > GUEST_LIMITS.streamTextBytes
                        || new TextEncoder().encode(data.text).byteLength > GUEST_LIMITS.streamTextBytes
                        || owned.emitted - owned.acknowledged >= GUEST_LIMITS.streamEvents) {
                        active.delete(id); owned.cancel();
                        send('error', { id, code: 'UNAVAILABLE' }); return;
                    }
                    send('event', { id, seq: ++owned.emitted, event: value });
                };
                const result = dispatch(method, message.args as WireValue[], event);
                const job = 'result' in result ? result : { result, cancel() {} };
                active.set(id, { cancel: () => job.cancel(), emitted: 0, acknowledged: 0 });
                void job.result.then(value => {
                    if (!active.delete(id) || closed) return;
                    send('result', { id, value: value === undefined ? null : value });
                }, error => {
                    if (!active.delete(id) || closed) return;
                    send('error', { id, code: error instanceof ExtensionError ? error.code : 'SERVICE_FAILED' });
                });
            } catch (error) {
                send('error', { id, code: error instanceof ExtensionError ? error.code : 'INVALID_REQUEST' });
            }
        } catch { close('PROTOCOL'); }
    }
    try { unsubscribe = transport.subscribe(receive, () => close('CLOSED', false)); }
    catch (error) { close('CLOSED', false); throw error; }
    return Object.freeze({ close: () => close(), descriptor });
}

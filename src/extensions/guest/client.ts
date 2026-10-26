import { ExtensionJobs } from '../jobs';
import type { ExtensionJob } from '../jobs';
import { EXTENSION_CAPABILITIES, EXTENSION_HOST_API, type ExtensionCapability } from '../manifest';
import { validExtensionId, validReleaseVersion } from '../validation';
import type { ExtensionChatHandle, ExtensionStreamListener } from '../client';
import { ExtensionError, type GuestHost, type ExtensionConnection, type GuestExtensionSDK } from './contract';
import { errorCode, exactKeys, GUEST_LIMITS, guestMessage, parseGuestMessage, wireRecord, type GuestMethod } from './protocol';
import type { GuestTransport } from './transport';
import { validateGuestTheme, type GuestTheme } from './theme';

interface ConnectOptions { handshakeMs?: number; signal?: AbortSignal; }
type JobValue<T> = T extends ExtensionJob<infer Value> ? Value : never;
function hostDescriptor(input: unknown): GuestHost {
    const host = wireRecord(input);
    exactKeys(host, ['kind', 'identity', 'supportedCapabilities', 'grantedCapabilities']);
    const identity = wireRecord(host.identity);
    exactKeys(identity, ['id', 'version', 'hostApi', 'instanceId']);
    if ((host.kind !== 'web' && host.kind !== 'desktop') || !validExtensionId(identity.id)
        || !validReleaseVersion(identity.version) || identity.hostApi !== EXTENSION_HOST_API
        || typeof identity.instanceId !== 'string' || !/^[a-f0-9]{32}$/.test(identity.instanceId)) throw new ExtensionError('PROTOCOL');
    function capabilities(value: unknown): readonly ExtensionCapability[] {
        if (!Array.isArray(value) || value.length > EXTENSION_CAPABILITIES.length
            || new Set(value).size !== value.length
            || value.some(cap => !EXTENSION_CAPABILITIES.includes(cap))) throw new ExtensionError('PROTOCOL');
        return Object.freeze([...value]);
    }
    const supported = capabilities(host.supportedCapabilities);
    const granted = capabilities(host.grantedCapabilities);
    if (granted.some(cap => !supported.includes(cap))) throw new ExtensionError('PROTOCOL');
    return Object.freeze({ kind: host.kind, identity: Object.freeze({ id: identity.id as string,
        version: identity.version as string, hostApi: EXTENSION_HOST_API, instanceId: identity.instanceId }),
        supportedCapabilities: supported, grantedCapabilities: granted });
}

/** Connect to a platform-issued private endpoint. Does not discover or trust a window/global URL. */
export function connectExtension(transport: GuestTransport, options: ConnectOptions = {}): Promise<ExtensionConnection> {
    const handshakeMs = options.handshakeMs ?? GUEST_LIMITS.handshakeMs;
    if (!Number.isSafeInteger(handshakeMs) || handshakeMs <= 0) throw new ExtensionError('INVALID_REQUEST');
    let closed = false;
    let descriptor: GuestHost | undefined;
    let theme: GuestTheme | null = null;
    let jobs: ExtensionJobs | undefined;
    let sequence = 0;
    let unsubscribe = () => {};
    let timer: ReturnType<typeof setTimeout> | undefined;
    const themeListeners = new Set<(value: GuestTheme) => void>();
    const handles = new WeakMap<ExtensionChatHandle, string>();
    const pending = new Map<number, { resolve(value: unknown): void; reject(error: unknown): void;
        dispose(): void; onEvent?: ExtensionStreamListener; sequence: number }>();
    let resolveConnection!: (value: ExtensionConnection) => void;
    let rejectConnection!: (error: unknown) => void;
    const connected = new Promise<ExtensionConnection>((resolve, reject) => { resolveConnection = resolve; rejectConnection = reject; });
    function close(error = new ExtensionError('CLOSED'), notify = true) {
        if (closed) return;
        closed = true;
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', aborted);
        if (notify) { try { transport.send(guestMessage('close', { code: error.code })); } catch { /* lost endpoint */ } }
        unsubscribe(); transport.close(); jobs?.dispose(); themeListeners.clear();
        for (const call of pending.values()) { call.dispose(); call.reject(error); }
        pending.clear(); rejectConnection(error);
    }
    function send(type: string, body: Record<string, unknown>) {
        if (closed) throw new ExtensionError('CLOSED');
        try { transport.send(guestMessage(type, body)); }
        catch (error) { close(new ExtensionError('PROTOCOL')); throw error; }
    }
    function aborted() { close(); }
    function request(method: GuestMethod, args: unknown[], signal: AbortSignal, onEvent?: ExtensionStreamListener): Promise<unknown> {
        if (closed || signal.aborted) return Promise.reject(new ExtensionError('CLOSED'));
        return new Promise((resolve, reject) => {
            const id = ++sequence;
            const dispose = () => signal.removeEventListener('abort', cancel);
            const cancel = () => {
                if (!pending.delete(id)) return;
                dispose();
                try { send('cancel', { id }); } catch { /* connection closed */ }
                reject(new DOMException('Extension request cancelled.', 'AbortError'));
            };
            pending.set(id, { resolve, reject, dispose, onEvent, sequence: 0 });
            signal.addEventListener('abort', cancel, { once: true });
            try { send('request', { id, method, args }); }
            catch (error) { pending.delete(id); dispose(); reject(error); }
        });
    }
    function run<T>(method: GuestMethod, args: unknown[], onEvent?: ExtensionStreamListener, map?: (value: unknown) => T): ExtensionJob<T> {
        if (closed || !jobs) throw new ExtensionError('CLOSED');
        return jobs.run(method, async signal => {
            const value = await request(method, args, signal, onEvent);
            return map ? map(value) : value as T;
        });
    }
    function issue(raw: unknown): ExtensionChatHandle {
        const ref = wireRecord(raw);
        exactKeys(ref, ['id', 'token']);
        if (typeof ref.id !== 'string' || !ref.id || typeof ref.token !== 'string'
            || !ref.token.startsWith(descriptor!.identity.instanceId + ':')) throw new ExtensionError('PROTOCOL');
        const handle = Object.freeze({ id: ref.id });
        handles.set(handle, ref.token);
        return handle;
    }
    function own(handle: ExtensionChatHandle): string {
        const token = handle && handles.get(handle);
        if (!token) throw new ExtensionError('DENIED');
        return token;
    }
    function stream(listener: ExtensionStreamListener): ExtensionStreamListener {
        if (typeof listener !== 'function') throw new ExtensionError('INVALID_REQUEST');
        return listener;
    }
    function createSDK(host: GuestHost): GuestExtensionSDK {
        return Object.freeze({
            identity: host.identity, host, grantedCapabilities: host.grantedCapabilities,
            storage: Object.freeze({
                get: (key: string) => run<Awaited<ReturnType<GuestExtensionSDK['storage']['get']>>>('storage.get', [key]).result,
                set: (key: string, value: Parameters<GuestExtensionSDK['storage']['set']>[1]) =>
                    run<void>('storage.set', [key, value], undefined, () => undefined).result,
                remove: (key: string) => run<void>('storage.remove', [key], undefined, () => undefined).result,
            }),
            models: Object.freeze({ list: () => run<JobValue<ReturnType<GuestExtensionSDK['models']['list']>>>('models.list', []) }),
            ai: Object.freeze({
                generate: (request: Parameters<GuestExtensionSDK['ai']['generate']>[0]) =>
                    run<JobValue<ReturnType<GuestExtensionSDK['ai']['generate']>>>('ai.generate', [request]),
                stream: (request: Parameters<GuestExtensionSDK['ai']['stream']>[0], listener: ExtensionStreamListener) =>
                    run<void>('ai.stream', [request], stream(listener), () => undefined),
            }),
            audio: Object.freeze({
                speech: (request: Parameters<GuestExtensionSDK['audio']['speech']>[0]) =>
                    run<JobValue<ReturnType<GuestExtensionSDK['audio']['speech']>>>('audio.speech', [request]),
                transcribe: (request: Parameters<GuestExtensionSDK['audio']['transcribe']>[0]) =>
                    run<JobValue<ReturnType<GuestExtensionSDK['audio']['transcribe']>>>('audio.transcribe', [request]),
            }),
            chat: Object.freeze({
                create: (options?: Parameters<GuestExtensionSDK['chat']['create']>[0]) => run('chat.create', [options ?? null], undefined, issue),
                open: (id: string) => run('chat.open', [id], undefined, issue),
                read: (handle: ExtensionChatHandle) =>
                    run<JobValue<ReturnType<GuestExtensionSDK['chat']['read']>>>('chat.read', [own(handle)]),
                send: (handle: ExtensionChatHandle, request: Parameters<GuestExtensionSDK['chat']['send']>[1], listener: ExtensionStreamListener) =>
                    run<void>('chat.send', [own(handle), request], stream(listener), () => undefined),
            }),
            jobs: Object.freeze({ list: () => jobs!.list(), cancel: (id: string) => jobs!.cancel(id),
                subscribe: (listener: () => void) => jobs!.subscribe(listener) }),
            theme: Object.freeze({
                current: () => theme,
                subscribe: (listener: (value: GuestTheme) => void) => {
                    if (closed) throw new ExtensionError('CLOSED');
                    themeListeners.add(listener);
                    return () => { themeListeners.delete(listener); };
                },
            }),
        });
    }
    function receive(raw: unknown) {
        try {
            const message = parseGuestMessage(raw);
            if (message.type === 'close') { close(new ExtensionError(errorCode(message.code)), false); return; }
            if (message.type === 'ready' && !descriptor) {
                descriptor = hostDescriptor(message.host);
                theme = message.theme === null ? null : validateGuestTheme(message.theme);
                jobs = new ExtensionJobs(descriptor.identity.id + ':' + descriptor.identity.instanceId + ':guest');
                clearTimeout(timer);
                resolveConnection(Object.freeze({ sdk: createSDK(descriptor), close: () => close() }));
                return;
            }
            if (!descriptor) throw new ExtensionError('PROTOCOL');
            if (message.type === 'theme') {
                theme = validateGuestTheme(message.value);
                for (const listener of themeListeners) { try { listener(theme); } catch { /* observer only */ } }
                return;
            }
            if (!['result', 'error', 'event'].includes(message.type) || (message.id as number) > sequence) throw new ExtensionError('PROTOCOL');
            const call = pending.get(message.id as number);
            if (!call) return; // Cancelled or already terminal: never deliver late/duplicate values.
            if (message.type === 'event') {
                const event = wireRecord(message.event);
                exactKeys(event, ['type', 'text']);
                if (!call.onEvent || (event.type !== 'text' && event.type !== 'reasoning') || typeof event.text !== 'string'
                    || message.seq !== call.sequence + 1) throw new ExtensionError('PROTOCOL');
                try {
                    call.onEvent(Object.freeze({ type: event.type, text: event.text }));
                    call.sequence++;
                    send('ack', { id: message.id, seq: message.seq });
                }
                catch (error) {
                    pending.delete(message.id as number); call.dispose();
                    send('cancel', { id: message.id }); call.reject(error);
                }
            } else {
                pending.delete(message.id as number); call.dispose();
                if (message.type === 'error') call.reject(new ExtensionError(errorCode(message.code)));
                else call.resolve(message.value);
            }
        } catch { close(new ExtensionError('PROTOCOL')); }
    }
    try {
        unsubscribe = transport.subscribe(receive, () => close(new ExtensionError('CLOSED'), false));
        if (options.signal?.aborted) close();
        else {
            options.signal?.addEventListener('abort', aborted, { once: true });
            timer = setTimeout(() => close(new ExtensionError('UNAVAILABLE')), handshakeMs);
            send('hello', {});
        }
    } catch { close(new ExtensionError('CLOSED'), false); }
    return connected;
}

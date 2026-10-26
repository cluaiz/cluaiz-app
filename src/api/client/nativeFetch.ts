/** Native transport ceiling, independent of lower per-operation Engine media guards. */
export const MAX_NATIVE_REQUEST_BYTES = 128 * 1024 * 1024;
export const MAX_NATIVE_CHUNK_BYTES = 64 * 1024;
export type NativeInvoke = <T>(command: string, args: Record<string, unknown>) => Promise<T>;
export type EngineFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
interface NativeHead { status: number; headers: [string, string][]; }
interface NativeChunk { data: number[]; done: boolean; }
const abortError = () => new DOMException('Engine request cancelled.', 'AbortError');
const hostHeaders = new Set(['authorization', 'proxy-authorization', 'host', 'content-length',
    'connection', 'transfer-encoding', 'keep-alive', 'upgrade', 'trailer', 'te']);

function targetUrl(input: RequestInfo | URL, engineBaseUrl: string): URL {
    const raw = input instanceof Request ? input.url : String(input);
    const base = new URL(engineBaseUrl);
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.hash) {
        throw new TypeError('Invalid configured Engine URL.');
    }
    if (/[\\\u0000-\u0020\u007f]/.test(raw) || raw.includes('#')
        || (!raw.startsWith('/') && !/^https?:\/\//i.test(raw)) || raw.startsWith('//')) {
        throw new TypeError('Native Engine request requires a root-relative path or configured Engine URL.');
    }
    const url = new URL(raw, base.origin);
    if (url.origin !== base.origin || url.username || url.password || url.hash) {
        throw new TypeError('Native Engine request cannot select another origin.');
    }
    return url;
}

async function requestBytes(request: Request, wait: <T>(task: Promise<T>) => Promise<T>): Promise<number[]> {
    if (!request.body) return [];
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
        while (true) {
            const { done, value } = await wait(reader.read());
            if (done) break;
            size += value.byteLength;
            if (size > MAX_NATIVE_REQUEST_BYTES) throw new RangeError('Native Engine request exceeds transport byte limit.');
            chunks.push(value);
        }
    } catch (error) {
        void reader.cancel(error).catch(() => {});
        throw error;
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return Array.from(bytes);
}

/** Response-compatible native IPC; no network fallback or caller-selected native endpoint. */
export function createNativeFetch(invoke: NativeInvoke, engineBaseUrl: string | (() => string)): EngineFetch {
    return async (input, init) => {
        const url = targetUrl(input, typeof engineBaseUrl === 'function' ? engineBaseUrl() : engineBaseUrl);
        // Request owns body encoding (including FormData boundary) and input/init precedence.
        const request = input instanceof Request ? new Request(input, init) : new Request(url, init);
        const signal = request.signal;
        if (signal.aborted) throw abortError();
        let id: string | undefined;
        let ended = false;
        let cancelled = false;
        let failure: unknown;
        let bodyController: ReadableStreamDefaultController<Uint8Array> | undefined;
        let rejectStopped!: (error: unknown) => void;
        const stopped = new Promise<never>((_, reject) => { rejectStopped = reject; });
        void stopped.catch(() => {});
        const call = <T>(command: string, args: Record<string, unknown>) => Promise.resolve().then(() => invoke<T>(command, args));
        const release = () => {
            if (!id || cancelled) return;
            cancelled = true;
            void call<boolean>('engine_native_cancel', { id }).catch(() => {});
        };
        const finish = () => {
            ended = true;
            signal.removeEventListener('abort', onAbort);
            release();
        };
        const stop = (error: unknown) => {
            if (ended) return;
            failure = error;
            finish();
            rejectStopped(error);
            bodyController?.error(error);
        };
        function onAbort() { stop(abortError()); }
        const wait = async <T>(task: Promise<T>): Promise<T> => {
            if (ended) {
                void task.catch(() => {});
                throw failure || abortError();
            }
            return Promise.race([task, stopped]);
        };
        signal.addEventListener('abort', onAbort, { once: true });
        try {
            const body = await requestBytes(request, wait);
            if (ended || signal.aborted) throw failure || abortError();
            const headers = [...request.headers.entries()].filter(([name]) => !hostHeaders.has(name.toLowerCase()));
            const started = call<string>('engine_native_start', { request: {
                method: request.method, path: url.pathname + url.search, headers, body,
            } }).then(value => {
                if (typeof value !== 'string' || !value || value.length > 256) throw new Error('Invalid native Engine request identity.');
                id = value;
                if (ended || signal.aborted) release();
                return value;
            });
            await wait(started);
            const head = await wait(call<NativeHead>('engine_native_head', { id }));
            if (!head || !Number.isInteger(head.status) || head.status < 200 || head.status > 599
                || !Array.isArray(head.headers) || head.headers.some(pair => !Array.isArray(pair)
                    || pair.length !== 2 || pair.some(value => typeof value !== 'string'))) {
                throw new Error('Invalid native Engine response headers.');
            }
            const responseHeaders = new Headers(head.headers);
            if (request.method === 'HEAD' || [204, 205, 304].includes(head.status)) {
                finish();
                return new Response(null, { status: head.status, headers: responseHeaders });
            }
            const stream = new ReadableStream<Uint8Array>({
                start(controller) { bodyController = controller; },
                async pull(controller) {
                    try {
                        const chunk = await wait(call<NativeChunk>('engine_native_read', { id }));
                        if (ended) return;
                        if (!chunk || typeof chunk.done !== 'boolean' || !Array.isArray(chunk.data)
                            || chunk.data.length > MAX_NATIVE_CHUNK_BYTES
                            || chunk.data.some(byte => !Number.isInteger(byte) || byte < 0 || byte > 255)
                            || (!chunk.done && !chunk.data.length)) {
                            throw new Error('Invalid native Engine response chunk.');
                        }
                        if (chunk.data.length) controller.enqueue(Uint8Array.from(chunk.data));
                        if (chunk.done) { controller.close(); finish(); }
                    } catch (error) { stop(error); }
                },
                cancel() { stop(abortError()); },
            }, { highWaterMark: 0 });
            return new Response(stream, { status: head.status, headers: responseHeaders });
        } catch (error) {
            stop(error);
            throw error;
        }
    };
}

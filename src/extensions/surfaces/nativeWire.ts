/** Self-contained factory: the trusted native host serializes this function into
 * its initialization script. Keep every runtime dependency inside the function. */
export function nativeWire(view: Window & typeof globalThis, limits: {
    bytes: number; nodes: number; depth: number; pending: number; version: number; portMessage: string;
}) {
    async function convert(value: unknown, encode: boolean, depth = 0, budget = { nodes: 0 }): Promise<unknown> {
        if (depth > limits.depth || ++budget.nodes > limits.nodes) throw new Error('Native extension wire limit exceeded.');
        if (encode && value instanceof view.Blob) {
            if (value.size > limits.bytes) throw new Error('Native extension Blob is too large.');
            const bytes = new Uint8Array(await value.arrayBuffer());
            const parts: string[] = [];
            for (let i = 0; i < bytes.length; i += 16384) parts.push(String.fromCharCode(...bytes.subarray(i, i + 16384)));
            return { $cluaizBlob: view.btoa(parts.join('')), mime: value.type };
        }
        if (!encode && value && typeof value === 'object' && !Array.isArray(value)
            && Object.keys(value).length === 2 && '$cluaizBlob' in value && 'mime' in value) {
            const encoded = value as { $cluaizBlob: unknown; mime: unknown };
            if (typeof encoded.$cluaizBlob !== 'string' || typeof encoded.mime !== 'string' || encoded.mime.length > 256) throw new Error('Invalid native Blob envelope.');
            const binary = view.atob(encoded.$cluaizBlob);
            if (binary.length > limits.bytes) throw new Error('Native extension Blob is too large.');
            return new view.Blob([Uint8Array.from(binary, character => character.charCodeAt(0))], { type: encoded.mime });
        }
        if (Array.isArray(value)) return Promise.all(value.map(item => convert(item, encode, depth + 1, budget)));
        if (value && typeof value === 'object') {
            // Tag every ordinary object so valid user JSON resembling a Blob
            // envelope cannot silently become binary data during decoding.
            if (encode) return { $cluaizObject: await Promise.all(Object.entries(value)
                .map(async ([key, item]) => [key, await convert(item, true, depth + 1, budget)])) };
            const entries = (value as { $cluaizObject?: unknown }).$cluaizObject;
            if (Object.keys(value).length !== 1 || !Array.isArray(entries)
                || entries.some(entry => !Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string')
                || new Set(entries.map(entry => entry[0])).size !== entries.length) throw new Error('Invalid native object envelope.');
            return Object.fromEntries(await Promise.all(entries
                .map(async ([key, item]) => [key, await convert(item, false, depth + 1, budget)])));
        }
        return value;
    }
    async function encode(value: unknown): Promise<string> {
        const raw = JSON.stringify(await convert(value, true));
        if (typeof raw !== 'string' || new view.TextEncoder().encode(raw).length > limits.bytes * 2) throw new Error('Native extension message is too large.');
        return raw;
    }
    async function decode(raw: string): Promise<unknown> {
        if (typeof raw !== 'string' || new view.TextEncoder().encode(raw).length > limits.bytes * 2) throw new Error('Native extension message is too large.');
        return convert(JSON.parse(raw), false);
    }
    function install() {
        const invoke = (view as typeof view & { __TAURI_INTERNALS__: { invoke(command: string, args: object): Promise<unknown> } }).__TAURI_INTERNALS__.invoke;
        const channel = new view.MessageChannel();
        let closed = false;
        let queued = 0;
        let outgoing = Promise.resolve();
        let incoming = Promise.resolve();
        const close = () => {
            if (closed) return;
            closed = true;
            channel.port2.postMessage({ v: limits.version, type: 'close', code: 'CLOSED' });
            channel.port2.close();
            void invoke('extension_guest_message', { message: JSON.stringify({ v: limits.version, type: 'close', code: 'CLOSED' }) }).catch(() => {});
        };
        Object.defineProperty(view, '__CLUAIZ_EXTENSION_SURFACE__', { value: true });
        Object.defineProperty(view, '__CLUAIZ_EXTENSION_DELIVER__', { value: (raw: string) => {
            if (closed || ++queued > limits.pending) { close(); return; }
            incoming = incoming.then(async () => { if (!closed) channel.port2.postMessage(await decode(raw)); })
                .catch(close).finally(() => { queued--; });
        } });
        channel.port2.onmessage = event => {
            if (closed || ++queued > limits.pending) { close(); return; }
            outgoing = outgoing.then(async () => { if (!closed) await invoke('extension_guest_message', { message: await encode(event.data) }); })
                .catch(close).finally(() => { queued--; });
        };
        channel.port2.onmessageerror = close;
        const handoff = () => { if (!closed) view.postMessage({ type: limits.portMessage }, view.location.origin, [channel.port1]); };
        if (view.document.readyState === 'loading') view.addEventListener('DOMContentLoaded', handoff, { once: true });
        else view.queueMicrotask(handoff);
        view.addEventListener('pagehide', close, { once: true });
    }
    return { encode, decode, install };
}

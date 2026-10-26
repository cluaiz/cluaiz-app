import { connectExtension } from './client';
import type { ExtensionConnection } from './contract';
import { ExtensionError } from './contract';
import { GUEST_LIMITS } from './protocol';
import { messagePortTransport } from './transport';

export const EXTENSION_PORT_MESSAGE = 'cluaiz.extension.port';
export const EXTENSION_SURFACE_NAME = 'cluaiz.extension.surface';

/** Standalone returns null. An App surface receives one source-bound private port. */
export function bootstrapExtension(options: { signal?: AbortSignal } = {}): Promise<ExtensionConnection | null> {
    const native = (window as Window & { __CLUAIZ_EXTENSION_SURFACE__?: boolean }).__CLUAIZ_EXTENSION_SURFACE__ === true;
    if (!native && (window.parent === window || window.name !== EXTENSION_SURFACE_NAME)) return Promise.resolve(null);
    return new Promise((resolve, reject) => {
        let timer: ReturnType<typeof setTimeout>;
        let accepted = false;
        const cleanup = () => {
            clearTimeout(timer);
            window.removeEventListener('message', receive);
            options.signal?.removeEventListener('abort', abort);
        };
        const abort = () => { cleanup(); reject(new ExtensionError('CLOSED')); };
        function receive(event: MessageEvent) {
            if (accepted || event.source !== (native ? window : window.parent)
                || event.data?.type !== EXTENSION_PORT_MESSAGE || event.ports.length !== 1) return;
            accepted = true;
            cleanup();
            connectExtension(messagePortTransport(event.ports[0]), { signal: options.signal }).then(resolve, reject);
        }
        timer = setTimeout(() => { cleanup(); reject(new ExtensionError('UNAVAILABLE')); }, GUEST_LIMITS.handshakeMs);
        window.addEventListener('message', receive);
        options.signal?.addEventListener('abort', abort, { once: true });
        if (options.signal?.aborted) abort();
    });
}

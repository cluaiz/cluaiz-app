/** The platform owns authenticating the endpoint before giving it to guest code. */
export interface GuestTransport {
    send(value: unknown): void;
    subscribe(receive: (value: unknown) => void, disconnected: () => void): () => void;
    close(): void;
}

/** Private port only. No window listener, wildcard origin bootstrap, HTTP or native invoke. */
export function messagePortTransport(port: MessagePort): GuestTransport {
    let closed = false;
    let unsubscribe: (() => void) | undefined;
    return Object.freeze({
        send(value: unknown) {
            if (closed) throw new Error('Message port is closed.');
            port.postMessage(value);
        },
        subscribe(receive: (value: unknown) => void, disconnected: () => void) {
            if (closed || unsubscribe) throw new Error('Message port already has an owner or is closed.');
            const onMessage = (event: MessageEvent) => receive(event.data);
            const onClose = () => { if (!closed) { closed = true; unsubscribe?.(); port.close(); disconnected(); } };
            port.addEventListener('message', onMessage);
            port.addEventListener('messageerror', onClose);
            // Node exposes close; browser surface owners must also explicitly close on navigation/unmount.
            port.addEventListener('close', onClose);
            const cleanup = () => {
                port.removeEventListener('message', onMessage);
                port.removeEventListener('messageerror', onClose);
                port.removeEventListener('close', onClose);
            };
            unsubscribe = cleanup;
            port.start();
            return cleanup;
        },
        close() { if (!closed) { closed = true; unsubscribe?.(); port.close(); } },
    });
}

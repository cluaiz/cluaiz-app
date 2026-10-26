import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { attachExtensionHost } from '../guest/host';
import { GUEST_LIMITS, GUEST_PROTOCOL_VERSION } from '../guest/protocol';
import { EXTENSION_PORT_MESSAGE } from '../guest/bootstrap';
import { documentThemeSource } from '../guest/theme';
import type { GuestTransport } from '../guest/transport';
import type { createExtensionSession } from '../sdk';
import type { DeveloperDocument } from './document';
import { nativeWire } from './nativeWire';

interface Packet { label: string; message?: string; closed?: boolean; }
const EVENT = 'cluaiz-extension-message';
export async function openNativeSurface(container: HTMLElement, source: DeveloperDocument,
    session: ReturnType<typeof createExtensionSession>, failed: (error: Error) => void,
    options: { floating?: boolean; onClosed?: () => void } = {}) {
    const view = container.ownerDocument.defaultView as Window & typeof globalThis;
    const limits = { bytes: GUEST_LIMITS.messageBytes, nodes: GUEST_LIMITS.nodes, depth: GUEST_LIMITS.depth,
        pending: GUEST_LIMITS.streamEvents, version: GUEST_PROTOCOL_VERSION, portMessage: EXTENSION_PORT_MESSAGE };
    const codec = nativeWire(view, limits);
    let label: string | undefined;
    let closed = false;
    let pending = 0;
    let receive: ((message: unknown) => void) | undefined;
    let disconnected: (() => void) | undefined;
    let outgoing = Promise.resolve();
    let incoming = Promise.resolve();
    const early: Packet[] = [];
    const fail = (error: unknown) => {
        if (closed) return;
        disconnected?.();
        failed(error instanceof Error ? error : new Error(String(error)));
    };
    const dispatch = (packet: Packet) => {
        if (closed) return;
        if (!label) {
            if (early.length >= limits.pending) { fail(new Error('Native extension queue overflow.')); return; }
            early.push(packet); return;
        }
        if (packet.label !== label) return;
        if (packet.closed) {
            if (options.onClosed) { close(true); options.onClosed(); }
            else fail(new Error('Native extension surface closed.'));
            return;
        }
        if (typeof packet.message !== 'string' || ++pending > limits.pending) { fail(new Error('Invalid native extension message.')); return; }
        incoming = incoming.then(async () => { const value = await codec.decode(packet.message!); if (!closed) receive?.(value); })
            .catch(fail).finally(() => { pending--; });
    };
    const unlisten = await listen<Packet>(EVENT, event => dispatch(event.payload));
    const transport: GuestTransport = {
        send(value) {
            if (closed || ++pending > limits.pending) throw new Error('Native extension transport is closed or busy.');
            outgoing = outgoing.then(async () => {
                if (!closed && label) await invoke('extension_host_message', { label, message: await codec.encode(value) });
            }).catch(fail).finally(() => { pending--; });
        },
        subscribe(listener, onClose) {
            if (receive) throw new Error('Native extension transport already has an owner.');
            receive = listener; disconnected = onClose;
            return () => { receive = undefined; disconnected = undefined; };
        },
        close() { close(); },
    };
    const host = attachExtensionHost({ transport, session, kind: 'desktop', supportedCapabilities: session.sdk.host.capabilities,
        theme: documentThemeSource(container.ownerDocument.documentElement) });
    let scheduled = 0;
    const bounds = () => { const rect = container.getBoundingClientRect(); return {
        x: Math.max(0, rect.left), y: Math.max(0, rect.top), width: Math.max(1, rect.width), height: Math.max(1, rect.height) }; };
    const resize = () => {
        if (scheduled || closed) return;
        scheduled = view.requestAnimationFrame(() => {
            scheduled = 0;
            if (label && !closed) void invoke('extension_surface_resize', { label, bounds: bounds() }).catch(fail);
        });
    };
    const observer = new view.ResizeObserver(resize);
    function close(alreadyClosed = false) {
        if (closed) return;
        closed = true;
        unlisten(); observer.disconnect();
        view.removeEventListener('resize', resize);
        view.removeEventListener('scroll', resize, true);
        view.cancelAnimationFrame(scheduled);
        host.close(); early.length = 0;
        if (label && !alreadyClosed) void invoke('extension_surface_close', { label }).catch(error => console.error('Extension surface close failed', error));
    }
    try {
        const bootstrap = `(${nativeWire.toString()})(window,${JSON.stringify(limits)}).install();`;
        label = await invoke<string>('extension_surface_open', { html: source.html, bootstrap,
            bounds: options.floating ? { x: 0, y: 0, width: 480, height: 640 } : bounds(),
            floating: options.floating ?? false, title: source.contract.name });
        if (closed) { void invoke('extension_surface_close', { label }).catch(() => {}); return { close }; }
        for (const packet of early.splice(0)) dispatch(packet);
        if (closed) return { close };
        if (!options.floating) {
            observer.observe(container);
            view.addEventListener('resize', resize);
            view.addEventListener('scroll', resize, true);
        }
        return { close };
    } catch (error) { close(); throw error; }
}

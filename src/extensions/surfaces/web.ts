import { attachExtensionHost } from '../guest/host';
import { messagePortTransport } from '../guest/transport';
import { EXTENSION_PORT_MESSAGE } from '../guest/bootstrap';
import { browserShellDocument, BROWSER_SURFACE_CLOSED } from './browserShell';
import { documentThemeSource } from '../guest/theme';
import { browserDocument, type DeveloperDocument } from './document';
import type { createExtensionSession } from '../sdk';

/** Opaque origin, no same-origin permission, host DOM or generic network capability. */
export function openBrowserSurface(container: HTMLElement, source: DeveloperDocument,
    session: ReturnType<typeof createExtensionSession>, failed: (error: Error) => void) {
    const frame = container.ownerDocument.createElement('iframe');
    frame.title = source.contract.name;
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.setAttribute('allow', "camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'");
    frame.referrerPolicy = 'no-referrer';
    frame.style.cssText = 'width:100%;height:100%;border:0;display:block';
    const channel = new MessageChannel();
    const host = attachExtensionHost({ transport: messagePortTransport(channel.port1), session,
        kind: 'web', supportedCapabilities: session.sdk.host.capabilities,
        theme: documentThemeSource(container.ownerDocument.documentElement) });
    let loaded = false;
    let closed = false;
    const view = container.ownerDocument.defaultView;
    const navigated = (event: MessageEvent) => {
        if (event.source === frame.contentWindow && event.data?.type === BROWSER_SURFACE_CLOSED) {
            close(); failed(new Error('Extension navigated away; its connection was closed.'));
        }
    };
    const close = () => {
        if (closed) return;
        closed = true;
        host.close();
        channel.port2.close();
        view?.removeEventListener('message', navigated);
        frame.remove();
    };
    frame.addEventListener('load', () => {
        if (closed) return;
        if (loaded) { close(); failed(new Error('Extension navigated away; its connection was closed.')); return; }
        loaded = true;
        if (!frame.contentWindow) { close(); failed(new Error('Extension document is unavailable.')); return; }
        // Opaque origins have no serializable target origin. The target WindowProxy
        // and a transferred private port bind this one handoff to this exact child.
        frame.contentWindow.postMessage({ type: EXTENSION_PORT_MESSAGE, html: browserDocument(source) }, '*', [channel.port2]);
    });
    view?.addEventListener('message', navigated);
    frame.srcdoc = browserShellDocument();
    container.append(frame);
    return { close };
}

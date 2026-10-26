import { EXTENSION_PORT_MESSAGE, EXTENSION_SURFACE_NAME } from '../guest/bootstrap';

export const BROWSER_SURFACE_CLOSED = 'cluaiz.extension.surface.closed';
/** Serialized trusted shell: must remain self-contained, never run author code here. */
function shell(portMessage: string, surfaceName: string, closedMessage: string) {
    let accepted = false;
    window.addEventListener('message', event => {
        if (accepted || event.source !== window.parent || event.data?.type !== portMessage
            || event.ports.length !== 1 || typeof event.data.html !== 'string') return;
        accepted = true;
        const port = event.ports[0];
        const child = document.createElement('iframe');
        child.name = surfaceName; child.title = 'Extension content';
        child.setAttribute('sandbox', 'allow-scripts');
        child.setAttribute('allow', "camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'");
        child.referrerPolicy = 'no-referrer';
        child.style.cssText = 'width:100%;height:100%;border:0;display:block';
        let loaded = false;
        child.onload = () => {
            if (loaded) { child.remove(); port.close(); window.parent.postMessage({ type: closedMessage }, '*'); return; }
            loaded = true;
            child.contentWindow?.postMessage({ type: portMessage }, '*', [port]);
        };
        child.srcdoc = event.data.html;
        document.body.append(child);
    });
}

/** Parent frame-src governs child navigations before requests leave the browser. */
export function browserShellDocument() {
    const code = `(${shell.toString()})(${JSON.stringify(EXTENSION_PORT_MESSAGE)},${JSON.stringify(EXTENSION_SURFACE_NAME)},${JSON.stringify(BROWSER_SURFACE_CLOSED)})`;
    return '<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src data:; style-src \'unsafe-inline\' data:; img-src data: blob:; font-src data:; media-src data: blob:; frame-src about:; object-src \'none\'; base-uri \'none\'; form-action \'none\'"></head>'
        + '<body style="margin:0;width:100vw;height:100vh;overflow:hidden"><script src="data:text/javascript;base64,' + btoa(code) + '"></script></body></html>';
}

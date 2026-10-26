import { useEffect, useState } from 'react';
import { Button, Input, Card, CardContent } from '@cluaiz/extension-sdk/ui';
import type { GuestExtensionSDK } from '@cluaiz/extension-sdk/guest';

/** Test author source: copied into the independently packed author project. */
export function Workspace({ sdk }: { sdk?: GuestExtensionSDK }) {
    const [draft, setDraft] = useState('');
    const [count, setCount] = useState(0);
    useEffect(() => {
        if (!sdk) return;
        let active = true;
        let last = 0;
        let busy = false;
        let interval: ReturnType<typeof setInterval>;
        const pause = () => new Promise(resolve => setTimeout(resolve, 80));
        const raw = (window as Window & { __TAURI_INTERNALS__?: { invoke(command: string, args?: object): Promise<unknown> } }).__TAURI_INTERNALS__;
        void (async () => {
            const saved = await sdk.storage.get('draft');
            if (typeof saved === 'string' && active) setDraft(saved);
            let hostDomBlocked = window.parent === window;
            try { if (window.parent !== window) void window.parent.document.body; }
            catch { hostDomBlocked = true; }
            let hostStorageBlocked = false;
            try { hostStorageBlocked = localStorage.getItem('cluaiz-runtime-host-only') === null; }
            catch { hostStorageBlocked = true; }
            const denied: Record<string, string> = {};
            if (raw) for (const command of ['get_session_token', 'engine_native_start', 'storage_load_sessions_index',
                'extension_host_message', 'extension_surface_open', 'plugin:event|listen',
                'extension_packages_list', 'extension_package_read', 'extension_package_commit',
                'desktop_lifecycle_status', 'desktop_set_background', 'desktop_show_main', 'desktop_quit']) {
                try { await raw.invoke(command, {}); denied[command] = 'UNEXPECTED_SUCCESS'; }
                catch (error) { denied[command] = String(error); }
            }
            let unavailable = '';
            try { await sdk.models.list().result; } catch (error) { unavailable = String((error as { code?: string }).code ?? error); }
            // Controlled binary transport sentinel; this is not synthesized audio.
            const binary = await sdk.audio.speech({ input: 'Transport-only fixture bytes' }).result;
            const bytes = Array.from(new Uint8Array(await binary.arrayBuffer()));
            const literal = { $cluaizBlob: 'AQID', mime: 'text/plain' };
            await sdk.storage.set('probe.literal', literal);
            const literalRoundtrip = JSON.stringify(await sdk.storage.get('probe.literal')) === JSON.stringify(literal);
            // Two controlled transport streams, no model inference. Stopping one
            // must not stop its sibling or deliver that stopped stream's tail.
            const stoppedEvents: string[] = [], siblingEvents: string[] = [];
            const stopped = sdk.ai.stream({ model: 'fixture.transport', input: 'stop' }, event => stoppedEvents.push(event.text));
            const sibling = sdk.ai.stream({ model: 'fixture.transport', input: 'continue' }, event => siblingEvents.push(event.text));
            const stoppedResult = stopped.result.then(() => false, () => true);
            for (let i = 0; i < 100 && (!stoppedEvents.length || !siblingEvents.length); i++) await pause();
            if (!stoppedEvents.length || !siblingEvents.length) throw new Error('Controlled streams did not start.');
            stopped.cancel();
            const cancelled = await stoppedResult;
            await sibling.result;
            const scopedStop = cancelled && JSON.stringify(stoppedEvents) === '["transport:stop"]'
                && JSON.stringify(siblingEvents) === '["transport:continue","transport:end"]';
            await sdk.storage.set('probe.ready', { kind: sdk.host.kind, instance: sdk.identity.instanceId,
                saved, hostDomBlocked, hostStorageBlocked, denied, unavailable, bytes, mime: binary.type, scopedStop, literalRoundtrip });
            const tick = async () => {
                if (!active || busy) return;
                busy = true;
                try {
                    const rawCommand = await sdk.storage.get('probe.command');
                    const command = rawCommand as { id: number; action: string; draft?: string; escape?: string } | null;
                    if (!command || command.id === last) return;
                    last = command.id;
                    if (command.action === 'navigate' && command.escape) { location.href = command.escape; return; }
                    if (command.action === 'edit') {
                        const input = document.querySelector<HTMLInputElement>('input')!;
                        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, command.draft);
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        document.querySelector<HTMLButtonElement>('[data-testid="guest-primary"]')!.click();
                        await pause();
                        await sdk.storage.set('draft', input.value);
                    }
                    let networkBlocked = true;
                    if (command.escape) {
                        try { await fetch(command.escape); networkBlocked = false; } catch { /* Expected CSP denial. */ }
                    }
                    await pause();
                    const button = document.querySelector<HTMLButtonElement>('[data-testid="guest-primary"]')!;
                    const css = getComputedStyle(button);
                    await sdk.storage.set('probe.result', { id: command.id,
                        draft: document.querySelector<HTMLInputElement>('input')!.value,
                        count: button.textContent, background: css.backgroundColor, radius: css.borderRadius,
                        font: css.fontFamily, networkBlocked });
                } finally { busy = false; }
            };
            interval = setInterval(() => void tick().catch(error => { if (active) console.error(error); }), 100);
        })().catch(error => { if (active) console.error(error); });
        return () => { active = false; clearInterval(interval); };
    }, [sdk]);
    return <Card><CardContent>
        <p>Independent extension · {sdk?.host.kind ?? 'standalone'}</p>
        <label>Extension draft<Input value={draft} onChange={event => setDraft(event.target.value)} /></label>
        <Button data-testid="guest-primary" onClick={() => setCount(value => value + 1)}>Count {count}</Button>
    </CardContent></Card>;
}

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@cluaiz/extension-sdk/ui';
import type { GuestExtensionSDK } from '@cluaiz/extension-sdk/guest';

/** Independent author source; every answer comes from the selected real model. */
export function Workspace({ sdk }: { sdk?: GuestExtensionSDK }) {
    const [status, setStatus] = useState('Waiting for the App connection');
    const [answer, setAnswer] = useState('');
    useEffect(() => {
        if (!sdk) return;
        let active = true;
        void (async () => {
            const raw = (window as Window & { __TAURI_INTERNALS__?: { invoke(command: string, args: object): Promise<unknown> } }).__TAURI_INTERNALS__;
            const nativeDenied: Record<string, string> = {};
            let hostStorageBlocked = false;
            try { hostStorageBlocked = window.parent === window || window.parent.localStorage.getItem('cluaiz_api_token') === null; }
            catch { hostStorageBlocked = true; }
            if (raw) for (const command of ['engine_native_start', 'get_session_token']) {
                try { await raw.invoke(command, { request: { method: 'GET', path: '/health', headers: [], body: [] } }); nativeDenied[command] = 'UNEXPECTED_SUCCESS'; }
                catch (error) { nativeDenied[command] = String(error); }
            }
            setStatus('Reading installed models through the public SDK');
            const models = await sdk.models.list().result;
            const available = models.installed ?? models.models ?? Object.values(models.installed_models ?? {});
            const model = available.find(value => value.category === 'chat')?.id;
            if (!model) throw new Error('No installed chat model was returned by the actual Engine.');
            const saved = await sdk.storage.get('live.saved') as { id: string; answer: string } | null;
            const handle = saved ? await sdk.chat.open(saved.id).result
                : await sdk.chat.create({ title: 'Developer extension live acceptance' }).result;
            let snapshot = await sdk.chat.read(handle).result;
            const restored = saved ? snapshot.messages[1]?.text === saved.answer : false;
            if (saved && !restored) throw new Error('The saved model answer was not restored.');
            setAnswer(saved?.answer ?? '');
            let stopRequested = false;
            let cancelled = false;
            let deltas = 0;
            setStatus(saved ? 'Restored; checking owned Stop' : 'Waiting for a real model answer');
            const job = sdk.chat.send(handle, {
                model, input: saved ? 'List the integers from one to one hundred, one per line.' : 'Say hello in one short sentence.',
                maxTokens: saved ? 128 : 32,
            }, event => {
                if (!active || event.type !== 'text' || !event.text) return;
                deltas++;
                if (saved && !stopRequested) {
                    stopRequested = true;
                    queueMicrotask(() => job.cancel());
                } else if (!saved) setAnswer(value => value + event.text);
            });
            try { await job.result; }
            catch (error) { if (!stopRequested) throw error; cancelled = true; }
            if (!deltas) throw new Error('The actual model did not stream a text delta.');
            snapshot = await sdk.chat.read(handle).result;
            const text = snapshot.messages[1]?.text;
            if (typeof text !== 'string' || !text.trim() || snapshot.messages[1]?.finishReason === 'error') {
                throw new Error('The saved first answer is missing or failed.');
            }
            if (!saved) await sdk.storage.set('live.saved', { id: handle.id, answer: text });
            await sdk.storage.set('live.ready', { id: handle.id, model, answer: text,
                phase: saved ? 'restored-stop' : 'created', restored, stopRequested, cancelled, deltas,
                instanceId: sdk.identity.instanceId, kind: sdk.host.kind, nativeDenied, hostStorageBlocked,
                jobCancelled: sdk.jobs.list().some(value => value.id === job.id && value.status === 'cancelled') });
            if (active) setStatus(saved ? 'Saved chat restored; owned Stop checked' : 'Real answer saved in the App chat store');
        })().catch(async error => {
            if (active) setStatus(String(error));
            await sdk.storage.set('live.error', String(error)).catch(() => {});
        });
        return () => { active = false; };
    }, [sdk]);
    return <Card><CardContent><h2>Developer extension · live chat</h2>
        <p role="status">{status}</p><p aria-label="Actual model answer">{answer}</p>
    </CardContent></Card>;
}

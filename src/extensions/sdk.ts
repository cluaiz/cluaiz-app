import { validateExtensionManifest, type ExtensionCapability } from './manifest';
import { ExtensionState, type JsonValue, type StateStorage } from './storage';
import { ExtensionJobs } from './jobs';
import { createExtensionIdentity } from './identity';
import { EXTENSION_HOST } from './compatibility';
import type { InstalledModelsResponse } from '../api/engine/models/models.types';
import type { ChatCompletionResponse } from '../api/engine/chat/chat.types';
import type { SpeechRequest, TranscriptionResponse } from '../api/engine/audio/audio.types';
import type { ExtensionChatServices } from './chat';
import type { ExtensionSDK, ExtensionTextRequest, ExtensionStreamListener, ExtensionTranscriptionRequest,
    ExtensionChatHandle, ExtensionChatOptions } from './client';
export type { ExtensionSDK, ExtensionTextRequest, ExtensionStreamEvent, ExtensionStreamListener,
    ExtensionTranscriptionRequest } from './client';
export interface ExtensionServices {
    listModels(signal: AbortSignal): Promise<InstalledModelsResponse>;
    generate(request: ExtensionTextRequest, signal: AbortSignal): Promise<ChatCompletionResponse>;
    stream(request: ExtensionTextRequest, onEvent: ExtensionStreamListener, signal: AbortSignal): Promise<void>;
    speak(request: SpeechRequest, signal: AbortSignal): Promise<Blob>;
    transcribe(request: ExtensionTranscriptionRequest, signal: AbortSignal): Promise<TranscriptionResponse>;
    chat?(identity: Readonly<{ id: string; instanceId: string }>): ExtensionChatServices | Promise<ExtensionChatServices>;
}

/** Host-issued context for reviewed bundled code. It is not a hostile-JS sandbox. */
export function createExtensionSession(input: unknown, granted: readonly ExtensionCapability[],
    services: ExtensionServices, stateStorage: StateStorage) {
    const manifest = validateExtensionManifest(input);
    const permissions = new Set(granted.filter(cap => manifest.capabilities.includes(cap)));
    const state = new ExtensionState(manifest.id, stateStorage);
    const identity = createExtensionIdentity(manifest);
    const ownedJobs = new ExtensionJobs(`${manifest.id}:${identity.instanceId}`);
    let chatServices: Promise<ExtensionChatServices> | undefined;
    let disposed = false;
    function requireCapability(capability: ExtensionCapability) {
        if (disposed) throw new Error('Extension session is disposed.');
        if (!permissions.has(capability)) throw new Error(`Extension capability not granted: ${capability}`);
    }
    function run<T>(capability: ExtensionCapability, action: (signal: AbortSignal) => Promise<T>) {
        requireCapability(capability);
        return ownedJobs.run(capability, action);
    }
    async function chat() {
        if (!services.chat) throw new Error('Chat sessions are unavailable in this host service adapter.');
        chatServices ??= Promise.resolve().then(() => services.chat!(identity));
        const owner = await chatServices;
        if (disposed) { owner.dispose(); throw new DOMException('Extension session is disposed.', 'AbortError'); }
        return owner;
    }
    const sdk: ExtensionSDK = Object.freeze({
        identity,
        host: EXTENSION_HOST,
        grantedCapabilities: Object.freeze([...permissions]),
        storage: Object.freeze({
            get: (key: string) => { requireCapability('storage.read'); return state.get(key); },
            set: (key: string, value: JsonValue) => { requireCapability('storage.write'); state.set(key, value); },
            remove: (key: string) => { requireCapability('storage.write'); state.remove(key); },
        }),
        models: Object.freeze({ list: () => run('models.list', signal => services.listModels(signal)) }),
        ai: Object.freeze({
            generate: (request: ExtensionTextRequest) => run('ai.generate', signal => services.generate(request, signal)),
            stream: (request: ExtensionTextRequest, onEvent: ExtensionStreamListener) => {
                requireCapability('ai.stream');
                if (typeof onEvent !== 'function') throw new Error('A stream event listener is required.');
                return run('ai.stream', async signal => {
                    let accepting = true;
                    try {
                        await services.stream(request, event => {
                            if (accepting && !disposed && !signal.aborted) onEvent(Object.freeze({ ...event }));
                        }, signal);
                    } finally { accepting = false; }
                });
            },
        }),
        audio: Object.freeze({
            speech: (request: SpeechRequest) => run('audio.speech', signal => services.speak(request, signal)),
            transcribe: (request: ExtensionTranscriptionRequest) => run('audio.transcribe', signal => services.transcribe(request, signal)),
        }),
        chat: Object.freeze({
            create: (options?: ExtensionChatOptions) => run('chat.sessions', async signal => (await chat()).create(options, signal)),
            open: (id: string) => run('chat.sessions', async signal => (await chat()).open(id, signal)),
            read: (handle: ExtensionChatHandle) => run('chat.sessions', async signal => (await chat()).read(handle, signal)),
            send: (handle: ExtensionChatHandle, request: ExtensionTextRequest, onEvent: ExtensionStreamListener) =>
                run('chat.send', async signal => (await chat()).send(handle, request, onEvent, signal)),
        }),
        jobs: Object.freeze({
            list: () => ownedJobs.list(),
            cancel: (id: string) => { if (disposed) return false; return ownedJobs.cancel(id); },
            subscribe: (listener: () => void) => ownedJobs.subscribe(listener),
        }),
    });
    return Object.freeze({ sdk, dispose: () => {
        disposed = true;
        ownedJobs.dispose();
        void chatServices?.then(owner => owner.dispose()).catch(() => {});
    } });
}

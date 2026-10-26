import { modelsApi } from '../api/engine/models/models.api';
import { chatApi } from '../api/engine/chat/chat.api';
import { audioApi } from '../api/engine/audio/audio.api';
import { extensionTextPayload, streamExtensionChat } from './requests';
import type { ExtensionServices } from './sdk';

/** Domain adapters retain all transport, bearer, response parsing and model ownership. */
export const extensionServices = Object.freeze<ExtensionServices>({
    listModels: (signal: AbortSignal) => modelsApi.getInstalled(signal),
    generate: async (request, signal) => chatApi.createCompletion(extensionTextPayload(request), signal),
    stream: async (request, onEvent, signal) => streamExtensionChat(extensionTextPayload(request), onEvent, signal),
    chat: async identity => (await import('./chat')).createExtensionChatServices(identity),
    speak: (request, signal) => audioApi.speech(request, signal),
    transcribe: (request, signal) => audioApi.transcriptions({ ...request, stream: false }, signal),
});

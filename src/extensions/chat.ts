import { useChatStore } from '../store/chat/useChatStore';
import type { ChatSession } from '../store/chat/types';
import { buildChatHistory } from '../features/chat/utils/chatRequest';
import { extensionTextPayload, streamExtensionChat } from './requests';
import type { ChatCompletionRequest } from '../api/engine/chat/chat.types';
import type { ExtensionTextRequest, ExtensionStreamListener, ExtensionChatHandle,
    ExtensionChatOptions, ExtensionChatSnapshot } from './client';
export type { ExtensionChatHandle, ExtensionChatOptions, ExtensionChatSnapshot } from './client';
import { errorMessage } from '../api/client/errors';
import { chatStorageManager } from '../services/storage/ChatStorageManager';

export interface ExtensionChatServices {
    create(options: ExtensionChatOptions | undefined, signal: AbortSignal): Promise<ExtensionChatHandle>;
    open(id: string, signal: AbortSignal): Promise<ExtensionChatHandle>;
    read(handle: ExtensionChatHandle, signal: AbortSignal): Promise<ExtensionChatSnapshot>;
    send(handle: ExtensionChatHandle, request: ExtensionTextRequest, onEvent: ExtensionStreamListener, signal: AbortSignal): Promise<void>;
    dispose(): void;
}

/** App-side ownership for trusted bundled code. Saved ownership is stable across instances. */
export function createExtensionChatServices(identity: Readonly<{ id: string; instanceId: string }>): ExtensionChatServices {
    const handles = new WeakSet<ExtensionChatHandle>();
    let closed = false;
    function ready(signal: AbortSignal) {
        if (closed || signal.aborted) throw new DOMException('Chat session request cancelled.', 'AbortError');
        const store = useChatStore.getState();
        if (!store.isHydrated) throw new Error('Chat history is still loading; try again when it is ready.');
        return store;
    }
    function own(id: string, signal: AbortSignal): ChatSession {
        const session = ready(signal).sessions[id];
        if (!session || session.extensionId !== identity.id) throw new Error('Chat session is unavailable for this extension.');
        return session;
    }
    function owned(handle: ExtensionChatHandle, signal: AbortSignal) {
        if (!handle || !handles.has(handle)) throw new Error('Chat handle was not issued to this extension instance.');
        return own(handle.id, signal);
    }
    function issue(id: string) {
        const handle = Object.freeze({ id });
        handles.add(handle);
        return handle;
    }
    async function load(handle: ExtensionChatHandle, signal: AbortSignal) {
        const session = owned(handle, signal);
        await ready(signal).loadMessages(session.id);
        return owned(handle, signal);
    }
    return Object.freeze({
        create: async (options: ExtensionChatOptions | undefined, signal: AbortSignal) => {
            const store = ready(signal);
            if (options && ((options.title !== undefined && (typeof options.title !== 'string' || !options.title.trim()))
                || (options.incognito !== undefined && typeof options.incognito !== 'boolean'))) throw new Error('Invalid chat session options.');
            return issue(store.createNewSession(options?.title, {
                activate: false, extensionId: identity.id, incognito: options?.incognito,
            }));
        },
        open: async (id: string, signal: AbortSignal) => {
            if (typeof id !== 'string') throw new Error('A saved chat session ID is required.');
            own(id, signal);
            return issue(id);
        },
        read: async (handle: ExtensionChatHandle, signal: AbortSignal) => {
            const session = await load(handle, signal);
            return Object.freeze({ id: session.id, title: session.title,
                messages: Object.freeze(structuredClone(session.messages)) });
        },
        send: async (handle: ExtensionChatHandle, request: ExtensionTextRequest, onEvent: ExtensionStreamListener, signal: AbortSignal) => {
            const payload = extensionTextPayload(request);
            if (typeof onEvent !== 'function') throw new Error('A stream event listener is required.');
            await load(handle, signal);
            const store = ready(signal);
            if (store.streamingSessionId) throw new Error('Another chat is answering; wait for it or stop its request.');
            store.setStreamingSession(handle.id);
            const stamp = Date.now();
            const time = new Date(stamp).toLocaleTimeString();
            let settled = false;
            let failed = false;
            let turnIds: string[] = [];
            try {
                store.addMessage(handle.id, { sender: 'user', text: request.input, date: stamp, time });
                store.addMessage(handle.id, { sender: 'assistant', text: '', date: stamp, time });
                const messages = owned(handle, signal).messages;
                turnIds = messages.slice(-2).map(message => message.id);
                // The placeholder is excluded by the same history selector used by the chat UI.
                await streamExtensionChat({ ...payload, session_id: handle.id,
                    messages: buildChatHistory(messages) as ChatCompletionRequest['messages'] }, event => {
                    if (settled || closed || signal.aborted) return;
                    const current = owned(handle, signal).messages;
                    if (current[current.length - 1]?.id !== turnIds[1]) throw new Error('The active chat turn was removed.');
                    if (event.type === 'text') store.appendTokenToLastMessage(handle.id, event.text);
                    else store.appendThinkingToLastMessage(handle.id, event.text);
                    onEvent(Object.freeze({ ...event }));
                }, signal);
                owned(handle, signal);
                store.setLastMessageFinishReason(handle.id, 'stop');
            } catch (error) {
                failed = true;
                // Partial/failed turns remain visible but the existing history builder excludes them.
                const session = useChatStore.getState().sessions[handle.id];
                if (session?.extensionId === identity.id) {
                    store.updateSession(handle.id, current => ({ ...current,
                        messages: current.messages.map(message => turnIds.includes(message.id) ? {
                            ...message, finishReason: 'error',
                            ...(message.id === turnIds[1] && !signal.aborted && !closed
                                ? { text: `${message.text}\nRequest failed: ${errorMessage(error)}` } : {}),
                        } : message),
                    }));
                }
                throw error;
            } finally {
                settled = true;
                try {
                    const session = useChatStore.getState().sessions[handle.id];
                    if (session?.extensionId === identity.id) {
                        if (failed && !session.isIncognito) await chatStorageManager.saveAllMessages(handle.id, session.messages);
                        else await store.finalizeAssistantMessage(handle.id);
                    }
                } finally {
                    if (useChatStore.getState().streamingSessionId === handle.id) store.setStreamingSession(null);
                }
            }
        },
        dispose: () => { closed = true; },
    });
}

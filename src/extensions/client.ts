/** Shared author-facing types. No host services, stores or credentials at runtime. */
import type { InstalledModelsResponse } from '../api/engine/models/models.types';
import type { ChatCompletionResponse } from '../api/engine/chat/chat.types';
import type { SpeechRequest, TranscriptionResponse } from '../api/engine/audio/audio.types';
import type { ChatMessage } from '../store/chat/types';
import type { ExtensionCapability } from './manifest';
import type { createExtensionIdentity } from './identity';
import type { EXTENSION_HOST } from './compatibility';
import type { ExtensionJob, ExtensionJobSnapshot } from './jobs';
import type { JsonValue } from './storage';

export interface ExtensionTextRequest { model: string; input: string; maxTokens?: number; }
export type ExtensionStreamEvent = Readonly<{ type: 'text' | 'reasoning'; text: string }>;
export type ExtensionStreamListener = (event: ExtensionStreamEvent) => void;
export interface ExtensionTranscriptionRequest { file: string; model?: string; language?: string; }
export interface ExtensionChatHandle { readonly id: string; }
export interface ExtensionChatOptions { title?: string; incognito?: boolean; }
export interface ExtensionChatSnapshot {
    readonly id: string;
    readonly title: string;
    readonly messages: readonly ChatMessage[];
}
export interface ExtensionViewProps {
    sdk: ExtensionSDK;
    /** Present only in a with-chat view; the current external preview has no service bridge. */
    showChat?: (handle: ExtensionChatHandle) => Promise<void>;
}

/** Current private bundled-host API. A type declaration does not connect an external guest. */
export interface ExtensionSDK {
    readonly identity: ReturnType<typeof createExtensionIdentity>;
    readonly host: typeof EXTENSION_HOST;
    readonly grantedCapabilities: readonly ExtensionCapability[];
    readonly storage: Readonly<{
        get(key: string): JsonValue | null;
        set(key: string, value: JsonValue): void;
        remove(key: string): void;
    }>;
    readonly models: Readonly<{ list(): ExtensionJob<InstalledModelsResponse> }>;
    readonly ai: Readonly<{
        generate(request: ExtensionTextRequest): ExtensionJob<ChatCompletionResponse>;
        stream(request: ExtensionTextRequest, onEvent: ExtensionStreamListener): ExtensionJob<void>;
    }>;
    readonly audio: Readonly<{
        speech(request: SpeechRequest): ExtensionJob<Blob>;
        transcribe(request: ExtensionTranscriptionRequest): ExtensionJob<TranscriptionResponse>;
    }>;
    readonly chat: Readonly<{
        create(options?: ExtensionChatOptions): ExtensionJob<ExtensionChatHandle>;
        open(id: string): ExtensionJob<ExtensionChatHandle>;
        read(handle: ExtensionChatHandle): ExtensionJob<ExtensionChatSnapshot>;
        send(handle: ExtensionChatHandle, request: ExtensionTextRequest, onEvent: ExtensionStreamListener): ExtensionJob<void>;
    }>;
    readonly jobs: Readonly<{
        list(): readonly ExtensionJobSnapshot[];
        cancel(id: string): boolean;
        subscribe(listener: () => void): () => void;
    }>;
}

import { chatApi } from '../api/engine/chat/chat.api';
import { errorMessage } from '../api/client/errors';
import type { ChatCompletionRequest } from '../api/engine/chat/chat.types';
import type { ExtensionTextRequest, ExtensionStreamListener } from './sdk';

/** One payload policy shared by stateless generation and App-owned chat sessions. */
export function extensionTextPayload(request: ExtensionTextRequest): ChatCompletionRequest {
    if (!request || typeof request.model !== 'string' || !request.model.trim()
        || typeof request.input !== 'string' || !request.input.trim()
        || (request.maxTokens !== undefined && (!Number.isSafeInteger(request.maxTokens) || request.maxTokens <= 0))) {
        throw new Error('Select a model and supply text with a valid output token limit.');
    }
    return { model: request.model, messages: [{ role: 'user', content: request.input }],
        max_tokens: request.maxTokens, temporary_chat: 'strict', tools: [], tool_choice: 'none' };
}

export async function streamExtensionChat(payload: ChatCompletionRequest, onEvent: ExtensionStreamListener, signal: AbortSignal) {
    await chatApi.streamCompletion(payload, {
        signal,
        onToken: text => onEvent({ type: 'text', text }),
        onReasoning: text => onEvent({ type: 'reasoning', text }),
        onEvent: event => {
            const error = (event as { error?: unknown } | null)?.error;
            if (error !== undefined && error !== null) throw new Error(errorMessage(error));
        },
    });
}

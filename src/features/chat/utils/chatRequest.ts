import type { ChatMessage } from '../../../store/chat/useChatStore';
import type { ProcessingEvent } from '../../../api/engine/chat/chat.types';
import type { SendChatOptions } from '../../../core/engine';

/** One owner for the composer settings used by Send and an explicit text preview. */
export function chatComposerOptions(model: string | null | undefined, thinkMode: string, effort: string | number, skills: string[]): SendChatOptions {
    const tools = skills.filter(name => !['Think Deep', 'Think Lite', 'Long Answer', 'Short Answer'].includes(name))
        .map(name => ({ name, id: name }));
    return { model: model || undefined, think_mode: thinkMode, reasoning_effort: effort,
        tools: tools.length ? tools : undefined };
}

/** Saved chats use adaptive recall; private chats keep the existing temporary policy. */
export function chatHistoryOptions(options: SendChatOptions | undefined, privateChat: boolean) {
    return { temporary_chat: privateChat ? 'lite' as const : undefined,
        history_mode: options?.history_mode ?? (privateChat ? undefined : 'adaptive' as const) };
}

/** Keep failed turns visible in the conversation, but never retry their attachments implicitly. */
export function selectChatContext(messages: ChatMessage[]) {
    return messages.filter((message, index) => {
        // Compaction cards are sent as their summary (buildChatHistory), never as a message
        if (message.compaction) return false;
        if (message.finishReason === 'error') return false;
        if (message.sender === 'assistant') return Boolean(message.text || message.thinking);
        // Older clients saved transport errors as system messages, not model instructions.
        if (message.sender === 'system') return !message.text.startsWith('[System Error]');
        // Older clients saved neither an error nor a completed answer for failed turns.
        // Omit those turns too, including subsequent unanswered "hi" messages.
        if (index < messages.length - 1) {
            const nextTurn = messages.slice(index + 1).find(next =>
                next.sender === 'user' || (next.sender === 'assistant' && Boolean(next.text || next.thinking)));
            if (nextTurn?.sender === 'user' || nextTurn?.finishReason === 'error') return false;
        }
        return true;
    });
}

export function buildChatHistory(messages: ChatMessage[]) {
    // After a finished compaction only its summary and the messages after it are sent
    const last = messages.map(m => m.compaction?.status === 'done').lastIndexOf(true);
    const summary = last >= 0 ? [
        { role: 'user' as const, content: `Summary of our conversation so far (it replaces the earlier messages):\n${messages[last].compaction!.summary}` },
        { role: 'assistant' as const, content: 'Understood. I will continue from this summary.' },
    ] : [];
    return [...summary, ...selectChatContext(messages.slice(last + 1)).map(message => {
        let content = message.parts?.length ? message.parts : message.text;
        if (message.sender === 'user' && message.replyTo?.text && typeof content === 'string') {
            content = `[In reply to: "${message.replyTo.text}"]\n\n${content}`;
        }
        return { role: message.sender, content };
    })];
}

const STAGES: Record<ProcessingEvent['stage'], string> = {
    queued: 'Waiting for engine', model_loading: 'Loading model', reading: 'Reading attachment',
    decoding: 'Preparing attachment', projector_loading: 'Loading media encoder',
    encoding: 'Encoding attachment', prefill: 'Processing prompt', generation: 'Generating answer',
    request: 'Finishing request'
};

export function processingLabel(event: ProcessingEvent, messages: ChatMessage[]): string {
    const target = event.attachment;
    const message = target ? messages[target.message_index] : undefined;
    const part = target ? message?.parts?.[target.part_index] : undefined;
    const attachmentIndex = target ? message?.parts?.slice(0, target.part_index)
        .filter(item => item.type !== 'text').length ?? 0 : 0;
    const name = part?.file_url?.name || message?.attachments?.[attachmentIndex]?.name;
    const earlier = target && message && messages.slice(target.message_index + 1)
        .some(item => item.sender === 'user');
    const work = event.work ? ` (${event.work.completed}/${event.work.total} ${event.work.unit})` : '';
    const frame = target?.frame_index !== undefined ? ` · frame ${target.frame_index + 1}` : '';
    return `${STAGES[event.stage]}${earlier ? ' · earlier attachment' : ''}${name ? ` · ${name}` : ''}${frame}${work}`;
}

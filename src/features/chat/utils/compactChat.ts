import { chatApi, type ChatCompletionRequest } from '../../../api/engine/chat';
import { useChatStore } from '../../../store/chat/useChatStore';
import type { ChatMessage } from '../../../store/chat/types';
import { buildChatHistory } from './chatRequest';

/** A chat whose context is this full after an answer is compacted before it grows further. */
export const AUTO_COMPACT_PERCENT = 80;

/** What the model is asked for: the summary that replaces the conversation in later requests. */
const COMPACT_REQUEST =
    'Summarize this conversation so it can go on from the summary alone: the goal, what was decided, ' +
    'facts and files that matter, what was done, and the open next steps. Be concise; use a short list. ' +
    'Do not call tools.';

const running = new Set<string>();

/** Messages that a new compaction would replace: everything after the last one. */
export function messagesSinceCompaction(messages: ChatMessage[]) {
    const last = messages.map(m => Boolean(m.compaction)).lastIndexOf(true);
    return messages.slice(last + 1).filter(m => !m.compaction);
}

/**
 * The model writes a summary of the chat; a compaction card holding it is added to the chat, and
 * later requests send the summary instead of the messages before it (the messages stay visible).
 */
export async function compactSession(sessionId: string, auto: boolean): Promise<void> {
    if (running.has(sessionId)) return;
    const store = useChatStore.getState();
    const messages = store.sessions[sessionId]?.messages || [];
    const replaced = messagesSinceCompaction(messages).length;
    const history = buildChatHistory(messages);
    if (replaced < 2 || history.length < 2) return;

    running.add(sessionId);
    const now = new Date();
    store.addMessage(sessionId, {
        sender: 'system',
        text: '',
        time: now.toTimeString().slice(0, 8),
        date: now.getTime(),
        compaction: { summary: '', replacedMessages: replaced, auto, status: 'running' },
    });
    const index = (useChatStore.getState().sessions[sessionId]?.messages.length || 1) - 1;
    const finish = (update: Partial<NonNullable<ChatMessage['compaction']>>) =>
        useChatStore.getState().updateMessage(sessionId, index, message => ({
            ...message,
            text: update.summary ?? message.text,
            compaction: { ...message.compaction!, ...update },
        }));
    try {
        const response = await chatApi.createCompletion({
            // The parts are the same ones a normal send carries
            messages: [...history, { role: 'user', content: COMPACT_REQUEST }] as ChatCompletionRequest['messages'],
            temporary_chat: 'lite',
            think_mode: 'off',
            tool_choice: 'none',
        });
        const content = response.choices?.[0]?.message?.content;
        const summary = typeof content === 'string' ? content.trim() : '';
        if (!summary) throw new Error('The model returned no summary');
        finish({ summary, status: 'done' });
    } catch (error) {
        finish({ status: 'failed', error: error instanceof Error ? error.message : String(error) });
    } finally {
        running.delete(sessionId);
    }
}

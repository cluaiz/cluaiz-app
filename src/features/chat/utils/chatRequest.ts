import type { ChatMessage, ChatModelLoadState } from '../../../store/chat/types';
import type { ProcessingEvent } from '../../../api/engine/chat/chat.types';
import type { EngineLoadReport, SendChatOptions } from '../../../core/engine';
import { SAMPLING_KEYS, type ChatControls } from '../../../store/chat/useChatControlsStore';

/** One owner for the composer settings used by Send and an explicit text preview. */
export function chatComposerOptions(model: string | null | undefined, thinkMode: string, effort: string | number, skills: string[],
    controls: ChatControls = {}): SendChatOptions {
    const tools = skills.filter(name => !['Think Deep', 'Think Lite', 'Long Answer', 'Short Answer'].includes(name))
        .map(name => ({ name, id: name }));
    return { model: model || undefined, think_mode: thinkMode, reasoning_effort: effort,
        tools: tools.length ? tools : undefined, ...chatControlOptions(controls) };
}

/** The chat panel's settings as request fields: only the ones the user set, so the rest keep the Engine's defaults */
export function chatControlOptions(controls: ChatControls): Pick<SendChatOptions, 'system_prompt' | 'approval_mode' | typeof SAMPLING_KEYS[number]> {
    const options: Pick<SendChatOptions, 'system_prompt' | 'approval_mode' | typeof SAMPLING_KEYS[number]> = {};
    for (const key of SAMPLING_KEYS) if (Number.isFinite(controls[key])) options[key] = controls[key];
    if (controls.systemPrompt?.trim()) options.system_prompt = controls.systemPrompt.trim();
    if (controls.approvalMode) options.approval_mode = controls.approvalMode;
    return options;
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
    if (event.stage === 'model_loading' && event.message) {
        return event.message;
    }
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

/**
 * Updates inline chat model-load state for `model_loading` processing events.
 * Generic `model_loading` stage boundaries (`!p.load`) when the model is already
 * resident in memory are ignored so subsequent chat turns never display a load card.
 */
export function reduceChatModelLoading(
    current: ChatModelLoadState | undefined,
    p: ProcessingEvent,
    currentModelName?: string,
): ChatModelLoadState | undefined {
    if (!p.load || p.load.kind === 'unloaded') {
        if (!current || current.steps.length === 0) {
            return undefined;
        }
        if (p.state === 'completed' || p.state === 'failed') {
            return {
                ...current,
                status: p.state === 'failed' ? 'failed' : 'loaded',
                percent: undefined,
            };
        }
        return current;
    }
    const prev: ChatModelLoadState = current ?? { status: 'loading', steps: [] };
    const nextSteps = [...prev.steps];
    if (p.load.step === 'weights') {
        const idx = nextSteps.findIndex(s => s.step === 'weights' && s.attempt === p.load?.attempt);
        if (idx >= 0) nextSteps[idx] = p.load;
        else nextSteps.push(p.load);
    } else {
        nextSteps.push(p.load);
    }
    const nextPercent = p.work?.unit === 'percent'
        ? p.work.completed
        : p.load.percent ?? (p.load.step && p.load.step !== 'weights' ? undefined : prev.percent);
    const nextStatus = (p.state === 'failed' || p.load.kind === 'failed' || p.load.kind === 'refused')
        ? 'failed'
        : (p.state === 'completed' || p.load.kind === 'loaded')
            ? 'loaded'
            : 'loading';
    return {
        ...prev,
        status: nextStatus,
        model: p.load.model || prev.model || currentModelName,
        percent: nextStatus === 'loaded' ? undefined : nextPercent,
        currentMessage: p.message ?? p.load.message ?? prev.currentMessage,
        loadMs: p.load.kind === 'loaded' && p.load.ms !== undefined ? p.load.ms : prev.loadMs,
        steps: nextSteps,
    };
}

/** Attaches the final EngineLoadReport only when this turn actually loaded a model (`steps.length > 0`). */
export function finalizeChatModelLoad(
    current: ChatModelLoadState | undefined,
    plan: EngineLoadReport | undefined,
    currentModelName?: string,
): ChatModelLoadState | undefined {
    if (!current || current.steps.length === 0) return undefined;
    if (!plan) return current;
    return {
        ...current,
        status: 'loaded',
        model: plan.model_id ?? current.model ?? currentModelName,
        loadMs: current.loadMs ?? plan.model_load_ms,
        percent: undefined,
        plan,
    };
}

import { useEffect, type RefObject } from 'react';
import type { InlinePromptInputHandle } from '../../../components/ui/InlinePromptInput';
import type { SendChatOptions } from '../../../core/engine';
import { chatComposerOptions } from '../utils/chatRequest';

export type ChatPreviewOptionsRef = RefObject<(() => SendChatOptions) | null>;

/** Exposes current composer options on demand, without a second state store or network read. */
export function useChatPreviewOptions(
    target: ChatPreviewOptionsRef | undefined,
    input: RefObject<InlinePromptInputHandle | null>,
    model: string | null | undefined,
    thinkMode: string,
    effort: string | number,
) {
    useEffect(() => {
        if (!target) return;
        const read = () => chatComposerOptions(model, thinkMode, effort, input.current?.getSerializedContent().skills ?? []);
        target.current = read;
        return () => { if (target.current === read) target.current = null; };
    }, [target, input, model, thinkMode, effort]);
}

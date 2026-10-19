import React from 'react';
import { useSpeechHighlightStore } from '../../store/chat/useSpeechHighlightStore';

interface SpeechWordHighlighterProps {
    messageId?: string;
    children: React.ReactNode;
    className?: string;
}

/**
 * Tokenizes a sentence string into whitespace and word spans with zero layout shift.
 */
function renderSentenceWithKaraoke(
    sentence: string,
    activeWordIndex: number,
    keyPrefix: string
): React.ReactNode {
    const tokens = sentence.split(/(\s+)/);
    let wordCounter = 0;

    return (
        <span key={`${keyPrefix}-sent`} className="transition-colors duration-200">
            {tokens.map((token, idx) => {
                // Whitespace tokens are preserved as-is
                if (/^\s+$/.test(token)) {
                    return <React.Fragment key={`${keyPrefix}-ws-${idx}`}>{token}</React.Fragment>;
                }

                if (!token) return null;

                const currentWordIdx = wordCounter;
                wordCounter++;
                const isCurrent = currentWordIdx === activeWordIndex;

                return (
                    <span
                        key={`${keyPrefix}-w-${idx}`}
                        className={
                            isCurrent
                                ? "text-[var(--accent-color)] bg-[var(--accent-color)]/25 rounded-xs"
                                : "transition-colors duration-100"
                        }
                        style={
                            isCurrent
                                ? {
                                      boxDecorationBreak: 'clone',
                                      WebkitBoxDecorationBreak: 'clone',
                                      textShadow: '0 0 10px rgba(var(--accent-rgb, 99, 102, 241), 0.4)',
                                  }
                                : undefined
                        }
                    >
                        {token}
                    </span>
                );
            })}
        </span>
    );
}

/**
 * Recursively inspects text nodes in React children to locate and highlight the active sentence.
 */
function highlightTextChildren(
    node: React.ReactNode,
    sentenceText: string,
    activeWordIndex: number,
    path = 'root'
): React.ReactNode {
    if (typeof node === 'string') {
        const trimmedTarget = sentenceText.trim();
        if (!trimmedTarget) return node;

        let targetIdx = node.indexOf(trimmedTarget);

        // Fallback: match using normalized spaces
        if (targetIdx === -1) {
            const normNode = node.replace(/\s+/g, ' ');
            const normTarget = trimmedTarget.replace(/\s+/g, ' ');
            const normIdx = normNode.indexOf(normTarget);
            if (normIdx !== -1) {
                const firstWord = normTarget.split(' ')[0];
                if (firstWord) {
                    targetIdx = node.indexOf(firstWord);
                }
            }
        }

        if (targetIdx !== -1) {
            const before = node.slice(0, targetIdx);
            const matchedLen = Math.min(trimmedTarget.length, node.length - targetIdx);
            const target = node.slice(targetIdx, targetIdx + matchedLen);
            const after = node.slice(targetIdx + matchedLen);

            return (
                <React.Fragment key={path}>
                    {before}
                    {renderSentenceWithKaraoke(target, activeWordIndex, path)}
                    {after}
                </React.Fragment>
            );
        }

        return node;
    }

    if (Array.isArray(node)) {
        return node.map((child, idx) =>
            highlightTextChildren(child, sentenceText, activeWordIndex, `${path}-${idx}`)
        );
    }

    if (React.isValidElement(node) && (node as any).props?.children) {
        const props = (node as any).props;
        return React.cloneElement(node, {
            ...props,
            children: highlightTextChildren(props.children, sentenceText, activeWordIndex, `${path}-elem`),
        });
    }

    return node;
}

/**
 * High-performance, modular wrapper that injects real-time karaoke word highlight
 * into Markdown paragraphs when speech playback is active for this message.
 */
export const SpeechWordHighlighter: React.FC<SpeechWordHighlighterProps> = ({
    messageId,
    children,
    className,
}) => {
    const activeMessageId = useSpeechHighlightStore((s) => s.activeMessageId);
    const sentenceText = useSpeechHighlightStore((s) => s.sentenceText);
    const activeWordIndex = useSpeechHighlightStore((s) => s.activeWordIndex);
    const isPlaying = useSpeechHighlightStore((s) => s.isPlaying);

    // If this message is not the one actively speaking, render raw children with 0 overhead
    const isMessageActive = Boolean(messageId && activeMessageId === messageId && sentenceText && (isPlaying || activeWordIndex >= 0));

    if (!isMessageActive || !sentenceText) {
        return <span className={className}>{children}</span>;
    }

    return (
        <span className={className}>
            {highlightTextChildren(children, sentenceText, activeWordIndex)}
        </span>
    );
};

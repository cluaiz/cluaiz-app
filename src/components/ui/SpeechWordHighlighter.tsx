import React from 'react';
import { useSpeechHighlightStore } from '../../store/chat/useSpeechHighlightStore';

interface SpeechWordHighlighterProps {
    messageId?: string;
    children: React.ReactNode;
    className?: string;
}

/**
 * Extracts all raw text from a React node tree.
 */
function extractAllText(node: React.ReactNode): string {
    if (node === null || node === undefined || typeof node === 'boolean') return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(extractAllText).join('');
    if (React.isValidElement(node) && (node as any).props?.children !== undefined) {
        return extractAllText((node as any).props.children);
    }
    return '';
}

/**
 * Normalizes text for robust fuzzy substring searching (stripping punctuation/dashes/newlines).
 */
function normalizeForSearch(str: string): string {
    return str
        .replace(/[—–]/g, ' ')
        .replace(/[*_~`#|]/g, '')
        .replace(/[.,!?;:।'"“”‘’()[\]{}]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

/**
 * Finds the character range of sentenceText and the active word inside containerText.
 */
function locateActiveWordRange(
    containerText: string,
    sentenceText: string,
    activeWordIndex: number
): { start: number; end: number } | null {
    if (!containerText || !sentenceText) return null;

    // Clean sentenceText of markdown markup that speakable() might have stripped
    const cleanSentence = sentenceText
        .replace(/^[#\s*+-]+/gm, '')
        .replace(/(\*\*|__)(.*?)\1/g, '$2')
        .replace(/`([^`]*)`/g, '$1')
        .trim();

    if (!cleanSentence) return null;

    // 1. Direct exact or whitespace-normalized search
    let sentStart = containerText.indexOf(cleanSentence);

    if (sentStart === -1) {
        // Try normalized substring search
        const normContainer = normalizeForSearch(containerText);
        const normSent = normalizeForSearch(cleanSentence);
        const normIdx = normContainer.indexOf(normSent);

        if (normIdx !== -1) {
            // Match the first 3-4 words in sequence to find exact sentence start in container
            const firstWords = cleanSentence.split(/\s+/).slice(0, 4).map(w => w.replace(/[^\p{L}\p{N}_]/gu, '')).filter(Boolean);
            if (firstWords.length > 0) {
                const phrase = firstWords.join(' ').toLowerCase();
                const normC = containerText.toLowerCase().replace(/[^\p{L}\p{N}_\s]/gu, ' ');
                const phraseIdx = normC.indexOf(phrase);
                if (phraseIdx !== -1) {
                    sentStart = phraseIdx;
                } else {
                    const probe = firstWords[0].toLowerCase();
                    const foundIdx = containerText.toLowerCase().indexOf(probe);
                    if (foundIdx !== -1) {
                        sentStart = foundIdx;
                    }
                }
            }
        }
    }

    // Strict boundary: If this container does NOT contain the active sentence, return null.
    // NEVER fall back to highlighting isolated words across other paragraphs.
    if (sentStart === -1) {
        return null;
    }

    // 2. Tokenize words inside the located sentence to get the exact word offset
    const matchedSubstring = containerText.slice(sentStart);
    const wordRegex = /\S+/g;
    const words: { start: number; end: number; raw: string }[] = [];
    let match: RegExpExecArray | null;
    while ((match = wordRegex.exec(matchedSubstring)) !== null) {
        words.push({
            start: sentStart + match.index,
            end: sentStart + match.index + match[0].length,
            raw: match[0],
        });
        if (words.length > activeWordIndex + 8) break;
    }

    if (activeWordIndex >= 0 && activeWordIndex < words.length) {
        return { start: words[activeWordIndex].start, end: words[activeWordIndex].end };
    }

    // Fallback within this container's sentence boundary only
    const sentenceWords = cleanSentence.split(/\s+/).filter(Boolean);
    const targetWord = sentenceWords[activeWordIndex] || '';
    const cleanWord = targetWord.replace(/[^\p{L}\p{N}_]/gu, '');

    if (cleanWord) {
        const offsetInSent = matchedSubstring.toLowerCase().indexOf(cleanWord.toLowerCase());
        if (offsetInSent !== -1) {
            return {
                start: sentStart + offsetInSent,
                end: sentStart + offsetInSent + cleanWord.length,
            };
        }
    }

    return null;
}

/**
 * Traverses React children and wraps only the characters intersecting [targetStart, targetEnd]
 * in a highlighted span, with zero layout shift and preserving all child tags.
 */
function injectHighlightAtRange(
    node: React.ReactNode,
    targetStart: number,
    targetEnd: number,
    charOffset: { current: number },
    path = 'root'
): React.ReactNode {
    if (node === null || node === undefined || typeof node === 'boolean') {
        return node;
    }

    if (typeof node === 'string' || typeof node === 'number') {
        const text = String(node);
        const nodeStart = charOffset.current;
        const nodeEnd = nodeStart + text.length;
        charOffset.current = nodeEnd;

        // No intersection with target word
        if (targetEnd <= nodeStart || targetStart >= nodeEnd) {
            return node;
        }

        // Calculate overlap inside this specific text node
        const sliceStart = Math.max(0, targetStart - nodeStart);
        const sliceEnd = Math.min(text.length, targetEnd - nodeStart);

        const before = text.slice(0, sliceStart);
        const activeText = text.slice(sliceStart, sliceEnd);
        const after = text.slice(sliceEnd);

        return (
            <React.Fragment key={path}>
                {before}
                <span
                    key={`${path}-hl`}
                    className="text-[var(--accent-color)] bg-[var(--accent-color)]/25 rounded-xs transition-colors duration-100"
                    style={{
                        boxDecorationBreak: 'clone',
                        WebkitBoxDecorationBreak: 'clone',
                        textShadow: '0 0 10px rgba(var(--accent-rgb, 99, 102, 241), 0.4)',
                    }}
                >
                    {activeText}
                </span>
                {after}
            </React.Fragment>
        );
    }

    if (Array.isArray(node)) {
        return node.map((child, idx) =>
            injectHighlightAtRange(child, targetStart, targetEnd, charOffset, `${path}-${idx}`)
        );
    }

    if (React.isValidElement(node) && (node as any).props?.children !== undefined) {
        const props = (node as any).props;
        return React.cloneElement(node, {
            ...props,
            children: injectHighlightAtRange(props.children, targetStart, targetEnd, charOffset, `${path}-elem`),
        });
    }

    return node;
}

/**
 * High-performance, modular wrapper that injects real-time karaoke word highlight
 * into Markdown paragraphs when speech playback is active for this message.
 * Now seamlessly supports inline code badges (`code`), bold (`strong`), italics, links, and lists.
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
    const isMessageActive = Boolean(
        messageId &&
        activeMessageId === messageId &&
        sentenceText &&
        (isPlaying || activeWordIndex >= 0)
    );

    if (!isMessageActive || !sentenceText) {
        return <span className={className}>{children}</span>;
    }

    const containerText = extractAllText(children);
    const targetRange = locateActiveWordRange(containerText, sentenceText, activeWordIndex);

    if (!targetRange) {
        return <span className={className}>{children}</span>;
    }

    const charOffset = { current: 0 };
    return (
        <span className={className}>
            {injectHighlightAtRange(children, targetRange.start, targetRange.end, charOffset)}
        </span>
    );
};

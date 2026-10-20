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
    activeWordIndex: number,
    activeWord?: string | null
): { start: number; end: number } | null {
    if (!containerText || !sentenceText) return null;

    // Clean sentenceText of markdown markup that speakable() might have stripped
    const cleanSentence = sentenceText
        .replace(/^[#\s*+-]+/gm, '')
        .replace(/(\*\*|__)(.*?)\1/g, '$2')
        .replace(/`([^`]*)`/g, '$1')
        .trim();

    if (!cleanSentence) return null;

    // 1. Direct exact search
    let sentStart = containerText.indexOf(cleanSentence);

    // 2. Direct search with em-dash / punctuation tolerance
    if (sentStart === -1) {
        const alt1 = cleanSentence.replace(/, /g, '—');
        sentStart = containerText.indexOf(alt1);
    }
    if (sentStart === -1) {
        const alt2 = cleanSentence.replace(/, /g, '–');
        sentStart = containerText.indexOf(alt2);
    }
    if (sentStart === -1) {
        const alt3 = cleanSentence.replace(/, /g, ' ');
        sentStart = containerText.indexOf(alt3);
    }

    // 3. Multi-word phrase search (Unicode-safe, NO \b)
    if (sentStart === -1) {
        // Extract the first clean words from the sentence
        const firstWords = cleanSentence
            .split(/\s+/)
            .map(w => w.replace(/[^\p{L}\p{N}_]/gu, ''))
            .filter(w => w.length > 0);

        if (firstWords.length >= 2) {
            for (let count = Math.min(4, firstWords.length); count >= 2; count--) {
                const phraseWords = firstWords.slice(0, count);
                const escaped = phraseWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                // Match words separated by any whitespace, punctuation, or symbols (\s, \p{P}, \p{S})
                const pattern = escaped.join('[\\s\\p{P}\\p{S}]+');
                try {
                    const reg = new RegExp(pattern, 'u');
                    const m = reg.exec(containerText);
                    if (m) {
                        sentStart = m.index;
                        break;
                    }
                } catch {
                    // Ignore regex errors
                }
            }
        } else if (firstWords.length === 1 && firstWords[0].length >= 2) {
            sentStart = containerText.indexOf(firstWords[0]);
        }
    }

    // Strict boundary: If this container does NOT contain the active sentence, return null.
    if (sentStart === -1) {
        return null;
    }

    // 4. Tokenize words inside the located sentence
    const matchedSubstring = containerText.slice(sentStart);
    const wordRegex = /\S+/g;
    const words: { start: number; end: number; clean: string }[] = [];
    let match: RegExpExecArray | null;

    while ((match = wordRegex.exec(matchedSubstring)) !== null) {
        const raw = match[0];
        const leadingPunctMatch = raw.match(/^[^\p{L}\p{N}_]+/u);
        const leadingPunct = leadingPunctMatch ? leadingPunctMatch[0].length : 0;
        const trailingPunctMatch = raw.match(/[^\p{L}\p{N}_]+$/u);
        const trailingPunct = trailingPunctMatch ? trailingPunctMatch[0].length : 0;

        const start = sentStart + match.index + leadingPunct;
        const end = Math.max(start, sentStart + match.index + raw.length - trailingPunct);
        const clean = raw.slice(leadingPunct, raw.length - trailingPunct);

        words.push({ start, end, clean });
        if (words.length > activeWordIndex + 25) break;
    }

    if (activeWordIndex >= 0 && activeWordIndex < words.length) {
        const expectedWord = (activeWord || '').replace(/[^\p{L}\p{N}_]/gu, '').toLowerCase();
        let chosen = words[activeWordIndex];

        // If there is a slight token drift, verify with immediate neighbors (+/- 1)
        if (expectedWord && chosen.clean.toLowerCase() !== expectedWord) {
            if (activeWordIndex > 0 && words[activeWordIndex - 1]?.clean.toLowerCase() === expectedWord) {
                chosen = words[activeWordIndex - 1];
            } else if (words[activeWordIndex + 1]?.clean.toLowerCase() === expectedWord) {
                chosen = words[activeWordIndex + 1];
            }
        }

        return { start: chosen.start, end: chosen.end };
    }

    // Trailing word fallback if index exceeds scanned tokens
    if (words.length > 0 && activeWordIndex >= words.length) {
        return { start: words[words.length - 1].start, end: words[words.length - 1].end };
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
                    data-speech-active-word="true"
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
    const activeWord = useSpeechHighlightStore((s) => s.activeWord);
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
    const targetRange = locateActiveWordRange(containerText, sentenceText, activeWordIndex, activeWord);

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

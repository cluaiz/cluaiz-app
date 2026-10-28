import React, { useMemo } from 'react';
import { MarkdownRenderer } from '../../../components/ui/MarkdownRenderer';

/** Extract standalone Mermaid fences while preserving other fenced code verbatim. */
export function documentationParts(content: string) {
    const parts: { kind: 'markdown' | 'diagram'; content: string }[] = [];
    let cursor = 0;
    let fence: { marker: string; size: number; language: string; start: number; body: number } | null = null;
    for (const match of content.matchAll(/[^\n]*(?:\n|$)/g)) {
        const line = match[0].replace(/\r?\n$/, '');
        if (!fence) {
            const open = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
            if (open) fence = { marker: open[1][0], size: open[1].length,
                language: open[2].trim().toLowerCase(), start: match.index!, body: match.index! + match[0].length };
        } else {
            const close = /^ {0,3}(`+|~+)\s*$/.exec(line);
            if (!close || close[1][0] !== fence.marker || close[1].length < fence.size) continue;
            if (fence.language === 'mermaid') {
                if (fence.start > cursor) parts.push({ kind: 'markdown', content: content.slice(cursor, fence.start) });
                parts.push({ kind: 'diagram', content: content.slice(fence.body, match.index).trimEnd() });
                cursor = match.index! + match[0].length;
            }
            fence = null;
        }
    }
    if (cursor < content.length) parts.push({ kind: 'markdown', content: content.slice(cursor) });
    return parts;
}

/** API adapter uses the same Markdown/Mermaid renderer as ordinary App Markdown. */
export function ApiDiagram({ content, compact = false }: { content: string; compact?: boolean }) {
    return <MarkdownRenderer content={'```mermaid\n' + content + '\n```'} className={compact ? 'text-xs' : undefined} />;
}

/** API-only diagram support; ordinary documentation retains the shared renderer. */
export function ApiDocumentation({ content }: { content: string }) {
    const parts = useMemo(() => documentationParts(content), [content]);
    return <>{parts.map((part, index) => part.kind === 'diagram'
        ? <ApiDiagram key={index} content={part.content} />
        : <MarkdownRenderer key={index} content={part.content} />)}</>;
}

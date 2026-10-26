import React, { useEffect, useId, useMemo, useState } from 'react';
import { MarkdownRenderer } from '../../../components/ui/MarkdownRenderer';
import { useThemeStore } from '../../../store/ui/useThemeStore';

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

function ApiDiagram({ content }: { content: string }) {
    const id = 'api-diagram-' + useId().replace(/[^a-z0-9_-]/gi, '');
    const theme = useThemeStore(state => state.theme);
    const [result, setResult] = useState<{ svg?: string; error?: string }>({});
    useEffect(() => {
        let active = true;
        setResult({});
        void (async () => {
            try {
                const { default: mermaid } = await import('mermaid');
                const css = getComputedStyle(document.documentElement);
                const color = (name: string) => css.getPropertyValue(name).trim();
                mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'base',
                    suppressErrorRendering: true,
                    themeVariables: { primaryColor: color('--bg-secondary'),
                        primaryTextColor: color('--text-primary'), primaryBorderColor: color('--border-color'),
                        lineColor: color('--text-muted'), background: color('--bg-primary') } });
                const { svg } = await mermaid.render(id, content);
                if (active) setResult({ svg });
            } catch (error) {
                if (active) setResult({ error: error instanceof Error ? error.message : 'Diagram could not be rendered' });
            }
        })();
        return () => { active = false; };
    }, [content, id, theme]);
    return <figure className="my-4 overflow-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] p-3">
        {result.svg ? <div role="img" aria-label="API processing flow" dangerouslySetInnerHTML={{ __html: result.svg }} />
            : result.error ? <><p role="alert" className="text-[var(--text-muted)]">{result.error}</p><pre>{content}</pre></>
                : <p className="text-[var(--text-muted)]">Loading diagram…</p>}
    </figure>;
}

/** API-only diagram support; ordinary documentation retains the shared renderer. */
export function ApiDocumentation({ content }: { content: string }) {
    const parts = useMemo(() => documentationParts(content), [content]);
    return <>{parts.map((part, index) => part.kind === 'diagram'
        ? <ApiDiagram key={index} content={part.content} />
        : <MarkdownRenderer key={index} content={part.content} />)}</>;
}

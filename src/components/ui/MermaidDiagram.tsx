import React, { useEffect, useId, useState } from 'react';
import { useThemeStore } from '../../store/ui/useThemeStore';

/** Resolve browser CSS Color 4 tokens before passing them to Mermaid's color parser. */
function themeColors() {
    const probe = document.createElement('span'), canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Theme color conversion is unavailable');
    probe.style.cssText = 'position:fixed;visibility:hidden;width:0;height:0';
    document.documentElement.appendChild(probe);
    const color = (name: string) => {
        probe.style.color = 'var(' + name + ')';
        return getComputedStyle(probe).color;
    };
    try {
        const background = color('--bg-primary');
        const hex = (name: string) => {
            context.clearRect(0, 0, 1, 1);
            context.fillStyle = background; context.fillRect(0, 0, 1, 1);
            context.fillStyle = color(name); context.fillRect(0, 0, 1, 1);
            const rgba = context.getImageData(0, 0, 1, 1).data;
            return '#' + [...rgba.slice(0, 3)].map(value => value.toString(16).padStart(2, '0')).join('');
        };
        return { primaryColor: hex('--bg-secondary'), primaryTextColor: hex('--text-primary'),
            primaryBorderColor: hex('--border-color'), lineColor: hex('--text-muted'), background: hex('--bg-primary') };
    } finally { probe.remove(); }
}

/** Shared Markdown/API/graph Mermaid renderer. Only one library/configuration owner. */
export function MermaidDiagram({ content }: { content: string }) {
    const id = 'mermaid-' + useId().replace(/[^a-z0-9_-]/gi, '');
    const theme = useThemeStore(state => state.theme);
    const [result, setResult] = useState<{ svg?: string; error?: string }>({});
    useEffect(() => {
        let active = true; setResult({});
        void (async () => {
            try {
                const { default: mermaid } = await import('mermaid');
                // HTML foreignObject labels mismeasure their nowrap width at fractional
                // browser zoom. SVG text wraps before layout and grows the owning node.
                mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'base', htmlLabels: false,
                    suppressErrorRendering: true, themeVariables: themeColors() });
                const { svg } = await mermaid.render(id, content);
                if (active) setResult({ svg });
            } catch (error) {
                if (active) setResult({ error: error instanceof Error ? error.message : 'Diagram could not be rendered' });
            }
        })();
        return () => { active = false; };
    }, [content, id, theme]);
    return <figure className="my-2 max-w-full overflow-auto" data-mermaid-diagram>
        {result.svg ? <div role="img" aria-label="Mermaid diagram" dangerouslySetInnerHTML={{ __html: result.svg }} />
            : result.error ? <><p role="alert" className="text-[var(--text-muted)]">{result.error}</p><pre className="whitespace-pre-wrap">{content}</pre></>
                : <p role="status" className="text-[var(--text-muted)]">Loading diagram…</p>}
    </figure>;
}

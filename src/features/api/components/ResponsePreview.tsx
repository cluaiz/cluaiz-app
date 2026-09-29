import React, { useState, useEffect, useMemo } from 'react';
import { 
    Monitor, 
    Tablet, 
    Smartphone, 
    Maximize2, 
    Minimize2, 
    RotateCcw, 
    ExternalLink, 
    Terminal, 
    Search, 
    ChevronRight, 
    ChevronDown, 
    Copy, 
    Check, 
    ZoomIn, 
    ZoomOut, 
    Sparkles, 
    Globe, 
    FileText, 
    Code2, 
    Layers, 
    Image as ImageIcon,
    PlayCircle
} from 'lucide-react';
import { useThemeStore } from '../../../store/ui/useThemeStore';
import { MarkdownRenderer } from '../../../components/ui/MarkdownRenderer';

export type DetectedFormat = 'ready' | 'html' | 'markdown' | 'svg' | 'json' | 'image' | 'text';
export type ViewportMode = 'full' | 'desktop' | 'tablet' | 'mobile';

interface ResponsePreviewProps {
    content: string;
    className?: string;
}

interface ConsoleLogItem {
    id: string;
    level: 'log' | 'warn' | 'error';
    message: string;
    time: string;
}

export const ResponsePreview: React.FC<ResponsePreviewProps> = ({ content, className = '' }) => {
    const { theme } = useThemeStore();
    const isAppDark = theme !== 'light';

    const [viewport, setViewport] = useState<ViewportMode>('full');
    const [zoom, setZoom] = useState<number>(100);
    const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
    const [consoleLogs, setConsoleLogs] = useState<ConsoleLogItem[]>([]);
    const [isConsoleOpen, setIsConsoleOpen] = useState<boolean>(false);
    const [reloadKey, setReloadKey] = useState<number>(0);
    const [copiedNode, setCopiedNode] = useState<string | null>(null);
    const [jsonSearchQuery, setJsonSearchQuery] = useState<string>('');

    // Handle ESC key to exit fullscreen
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isFullscreen) {
                setIsFullscreen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isFullscreen]);

    // 100% Dynamic & Automatic Format Detection
    const { detectedFormat, parsedJson } = useMemo<{ detectedFormat: DetectedFormat; parsedJson: any }>(() => {
        if (!content || typeof content !== 'string') {
            return { detectedFormat: 'ready', parsedJson: null };
        }
        const trimmed = content.trim();

        // 1. Initial placeholder or empty state
        if (!trimmed || trimmed === 'Hit "Send" to execute the request.' || trimmed === 'Sending request...') {
            return { detectedFormat: 'ready', parsedJson: null };
        }

        // 2. Data URL or Image URI
        if (trimmed.startsWith('data:image/') || /^https?:\/\/.*\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(trimmed)) {
            return { detectedFormat: 'image', parsedJson: null };
        }

        // 3. SVG
        if (trimmed.startsWith('<svg') || (trimmed.includes('<svg') && trimmed.includes('xmlns="http://www.w3.org/2000/svg"'))) {
            return { detectedFormat: 'svg', parsedJson: null };
        }

        // 4. HTML (starts with <!DOCTYPE html> or contains <html>, <head>, <body> or structured HTML tags)
        if (
            /<!DOCTYPE\s+html/i.test(trimmed) ||
            /<html[\s>]/i.test(trimmed) ||
            /<head[\s>]/i.test(trimmed) ||
            /<body[\s>]/i.test(trimmed) ||
            (/<div[\s>]|<p[\s>]|<h[1-6][\s>]|<button[\s>]|<table[\s>]/i.test(trimmed) && trimmed.includes('</'))
        ) {
            return { detectedFormat: 'html', parsedJson: null };
        }

        // 5. Valid JSON Object or Array
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
            try {
                const parsed = JSON.parse(trimmed);
                if (typeof parsed === 'object' && parsed !== null) {
                    return { detectedFormat: 'json', parsedJson: parsed };
                }
            } catch {
                // Not JSON, continue to next check
            }
        }

        // 6. Markdown
        if (
            /(^|\n)#{1,6}\s+/.test(trimmed) ||
            /```[\s\S]*```/.test(trimmed) ||
            /(^|\n)[*-]\s+/.test(trimmed) ||
            /(^|\n)>\s+/.test(trimmed) ||
            /\[.*\]\(https?:\/\/.*\)/.test(trimmed)
        ) {
            return { detectedFormat: 'markdown', parsedJson: null };
        }

        // 7. General Text / Code
        return { detectedFormat: 'text', parsedJson: null };
    }, [content]);

    // Listen for iframe runtime console logs and errors
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data && event.data.type === 'PREVIEW_CONSOLE_LOG') {
                const now = new Date().toLocaleTimeString();
                setConsoleLogs((prev) => [
                    ...prev.slice(-49),
                    {
                        id: Math.random().toString(36).substring(2, 9),
                        level: event.data.level || 'log',
                        message: event.data.message || '',
                        time: now
                    }
                ]);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    // Clear logs on reload or content change
    useEffect(() => {
        setConsoleLogs([]);
    }, [content, reloadKey]);

    // Viewport Width Mapping
    const viewportWidthStyle = useMemo(() => {
        switch (viewport) {
            case 'mobile':
                return 'max-w-[375px]';
            case 'tablet':
                return 'max-w-[768px]';
            case 'desktop':
                return 'max-w-[1200px]';
            case 'full':
            default:
                return 'w-full';
        }
    }, [viewport]);

    // Safe Sandboxed HTML Document with auto theme injection & console catcher
    const sandboxedHtmlSrc = useMemo(() => {
        const trimmed = content.trim();
        const isFullDoc = /<!DOCTYPE\s+html/i.test(trimmed) || /<html[\s>]/i.test(trimmed);

        const injectedScript = `
            <script>
                (function() {
                    const origLog = console.log;
                    const origWarn = console.warn;
                    const origError = console.error;

                    console.log = function(...args) {
                        window.parent.postMessage({ type: 'PREVIEW_CONSOLE_LOG', level: 'log', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }, '*');
                        origLog.apply(console, args);
                    };
                    console.warn = function(...args) {
                        window.parent.postMessage({ type: 'PREVIEW_CONSOLE_LOG', level: 'warn', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }, '*');
                        origWarn.apply(console, args);
                    };
                    console.error = function(...args) {
                        window.parent.postMessage({ type: 'PREVIEW_CONSOLE_LOG', level: 'error', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }, '*');
                        origError.apply(console, args);
                    };

                    window.onerror = function(msg, url, line) {
                        window.parent.postMessage({ type: 'PREVIEW_CONSOLE_LOG', level: 'error', message: msg + ' (Line ' + line + ')' }, '*');
                    };
                })();
            </script>
        `;

        const themeBg = isAppDark ? '#0b0f17' : '#ffffff';
        const themeColor = isAppDark ? '#f0f6fc' : '#1e293b';

        if (isFullDoc) {
            if (trimmed.includes('</head>')) {
                return trimmed.replace('</head>', `${injectedScript}</head>`);
            }
            return trimmed + injectedScript;
        }

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Preview</title>
    ${injectedScript}
    <style>
        :root {
            color-scheme: ${isAppDark ? 'dark' : 'light'};
        }
        body {
            margin: 0;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background-color: ${themeBg};
            color: ${themeColor};
            line-height: 1.6;
            box-sizing: border-box;
        }
        *, *::before, *::after {
            box-sizing: inherit;
        }
        a { color: #58a6ff; }
        code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
        table { border-collapse: collapse; width: 100%; margin: 12px 0; }
        th, td { border: 1px solid ${isAppDark ? '#30363d' : '#e2e8f0'}; padding: 8px 12px; text-align: left; }
        th { background: ${isAppDark ? '#161b22' : '#f1f5f9'}; }
    </style>
</head>
<body>
    ${trimmed}
</body>
</html>`;
    }, [content, isAppDark]);

    // Pop out preview into external tab
    const handlePopout = () => {
        const blob = new Blob([sandboxedHtmlSrc], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    };

    return (
        <div 
            className={`flex flex-col w-full bg-[var(--bg-primary)] overflow-hidden select-none transition-all duration-200 ${
                isFullscreen 
                    ? 'fixed inset-0 z-50 w-screen h-screen' 
                    : 'h-full'
            } ${className}`}
        >
            {/* Clean, Non-Cluttered Header Bar */}
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] text-xs">
                {/* Left: Dynamic Format Indicator Badge */}
                <div className="flex items-center gap-2">
                    {detectedFormat === 'html' && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium text-[11px]">
                            <Globe className="w-3.5 h-3.5" />
                            <span>HTML Live Web Preview</span>
                        </div>
                    )}
                    {detectedFormat === 'markdown' && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-medium text-[11px]">
                            <FileText className="w-3.5 h-3.5" />
                            <span>Markdown Document</span>
                        </div>
                    )}
                    {detectedFormat === 'json' && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-medium text-[11px]">
                            <Layers className="w-3.5 h-3.5" />
                            <span>Interactive JSON Tree</span>
                        </div>
                    )}
                    {detectedFormat === 'svg' && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 font-medium text-[11px]">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>SVG Vector Graphic</span>
                        </div>
                    )}
                    {detectedFormat === 'image' && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-medium text-[11px]">
                            <ImageIcon className="w-3.5 h-3.5" />
                            <span>Image Preview</span>
                        </div>
                    )}
                    {detectedFormat === 'text' && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-500/10 border border-zinc-500/20 text-zinc-400 font-medium text-[11px]">
                            <Code2 className="w-3.5 h-3.5" />
                            <span>Plain Output</span>
                        </div>
                    )}
                    {detectedFormat === 'ready' && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/20 text-[var(--accent-color)] font-medium text-[11px]">
                            <PlayCircle className="w-3.5 h-3.5" />
                            <span>Ready for Response</span>
                        </div>
                    )}
                </div>

                {/* Right: Viewport Controls, Tools & Fullscreen */}
                <div className="flex items-center gap-1.5">
                    {/* Viewport Presets (Only when HTML or SVG) */}
                    {detectedFormat === 'html' && (
                        <div className="flex items-center gap-0.5 bg-[var(--bg-primary)] p-0.5 rounded border border-[var(--border-color)]">
                            <button
                                type="button"
                                onClick={() => setViewport('full')}
                                title="Full Fluid Width"
                                className={`p-1 rounded cursor-pointer transition-colors ${
                                    viewport === 'full' ? 'bg-white/10 text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                }`}
                            >
                                <Maximize2 className="w-3 h-3" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewport('desktop')}
                                title="Desktop View (1200px)"
                                className={`p-1 rounded cursor-pointer transition-colors ${
                                    viewport === 'desktop' ? 'bg-white/10 text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                }`}
                            >
                                <Monitor className="w-3 h-3" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewport('tablet')}
                                title="Tablet View (768px)"
                                className={`p-1 rounded cursor-pointer transition-colors ${
                                    viewport === 'tablet' ? 'bg-white/10 text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                }`}
                            >
                                <Tablet className="w-3 h-3" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewport('mobile')}
                                title="Mobile View (375px)"
                                className={`p-1 rounded cursor-pointer transition-colors ${
                                    viewport === 'mobile' ? 'bg-white/10 text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                }`}
                            >
                                <Smartphone className="w-3 h-3" />
                            </button>
                        </div>
                    )}

                    {/* Reload Preview */}
                    {detectedFormat === 'html' && (
                        <button
                            type="button"
                            onClick={() => setReloadKey(k => k + 1)}
                            title="Reload preview frame"
                            className="p-1 rounded border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                    )}

                    {/* Pop out to external tab */}
                    {detectedFormat === 'html' && (
                        <button
                            type="button"
                            onClick={handlePopout}
                            title="Open preview in new browser tab"
                            className="p-1 rounded border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                    )}

                    {/* Console Logs Toggle */}
                    {detectedFormat === 'html' && (
                        <button
                            type="button"
                            onClick={() => setIsConsoleOpen(o => !o)}
                            title="Toggle iframe console logs"
                            className={`flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-mono transition-colors cursor-pointer ${
                                isConsoleOpen 
                                    ? 'bg-[var(--accent-color)]/20 border-[var(--accent-color)] text-[var(--accent-color)]' 
                                    : consoleLogs.some(l => l.level === 'error')
                                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                                    : 'bg-[var(--bg-primary)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                            }`}
                        >
                            <Terminal className="w-3 h-3" />
                            <span>Logs ({consoleLogs.length})</span>
                        </button>
                    )}

                    {/* Fullscreen Toggle Button */}
                    <button
                        type="button"
                        onClick={() => setIsFullscreen(f => !f)}
                        title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Fullscreen Preview'}
                        className={`flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-medium transition-colors cursor-pointer ${
                            isFullscreen
                                ? 'bg-[var(--accent-color)] text-white border-[var(--accent-color)]'
                                : 'bg-[var(--bg-primary)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                        }`}
                    >
                        {isFullscreen ? (
                            <>
                                <Minimize2 className="w-3.5 h-3.5" />
                                <span>Exit</span>
                            </>
                        ) : (
                            <>
                                <Maximize2 className="w-3.5 h-3.5" />
                                <span>Fullscreen</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Dynamic Rendering Surface */}
            <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden bg-[var(--bg-primary)]">
                {/* 1. Ready / Empty State Placeholder */}
                {detectedFormat === 'ready' && (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/20 flex items-center justify-center mb-4 text-[var(--accent-color)] shadow-inner">
                            <Sparkles className="w-7 h-7" />
                        </div>
                        <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                            Live Output Preview
                        </h4>
                        <p className="text-xs text-[var(--text-muted)] max-w-sm leading-relaxed">
                            Click <strong className="text-[var(--accent-color)]">"Send"</strong> in the top header to execute the request. Any HTML, SVG, Markdown, or JSON response will automatically preview here.
                        </p>
                    </div>
                )}

                {/* 2. HTML Sandboxed Iframe */}
                {detectedFormat === 'html' && (
                    <div className="flex-1 flex items-center justify-center p-3 overflow-auto custom-scrollbar bg-black/20">
                        <div 
                            className={`h-full shadow-2xl transition-all duration-200 border border-[var(--border-color)] rounded-lg overflow-hidden bg-white ${viewportWidthStyle}`}
                            style={{
                                width: viewport === 'full' ? '100%' : undefined,
                                height: '100%'
                            }}
                        >
                            <iframe
                                key={reloadKey}
                                title="API Output Preview"
                                srcDoc={sandboxedHtmlSrc}
                                sandbox="allow-scripts allow-modals allow-forms allow-same-origin"
                                className="w-full h-full border-0 bg-transparent"
                            />
                        </div>
                    </div>
                )}

                {/* 3. SVG Graphic Visualizer */}
                {detectedFormat === 'svg' && (
                    <div className="flex-1 flex flex-col p-4 items-center justify-center overflow-auto custom-scrollbar relative bg-[#090d16]">
                        <div 
                            className="p-6 rounded-xl border border-[var(--border-color)] shadow-xl overflow-auto flex items-center justify-center"
                            style={{
                                background: isAppDark
                                    ? 'radial-gradient(#1e293b 1px, transparent 1px)' 
                                    : 'radial-gradient(#cbd5e1 1px, transparent 1px)',
                                backgroundSize: '16px 16px',
                                transform: `scale(${zoom / 100})`,
                                transition: 'transform 0.15s ease'
                            }}
                            dangerouslySetInnerHTML={{ __html: content }}
                        />

                        {/* Zoom Controls */}
                        <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-[var(--bg-secondary)]/90 backdrop-blur border border-[var(--border-color)] rounded-lg p-1 text-xs shadow-lg">
                            <button
                                type="button"
                                onClick={() => setZoom(z => Math.max(z - 25, 25))}
                                className="p-1 hover:text-[var(--text-primary)] text-[var(--text-muted)] cursor-pointer"
                                title="Zoom Out"
                            >
                                <ZoomOut className="w-3.5 h-3.5" />
                            </button>
                            <span className="font-mono text-[11px] px-1">{zoom}%</span>
                            <button
                                type="button"
                                onClick={() => setZoom(z => Math.min(z + 25, 300))}
                                className="p-1 hover:text-[var(--text-primary)] text-[var(--text-muted)] cursor-pointer"
                                title="Zoom In"
                            >
                                <ZoomIn className="w-3.5 h-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setZoom(100)}
                                className="px-1 text-[10px] text-[var(--accent-color)] hover:underline ml-1 cursor-pointer"
                            >
                                Reset
                            </button>
                        </div>
                    </div>
                )}

                {/* 4. Markdown Document */}
                {detectedFormat === 'markdown' && (
                    <div className="flex-1 p-6 overflow-auto custom-scrollbar bg-[var(--bg-primary)]">
                        <div className="max-w-4xl mx-auto">
                            <MarkdownRenderer content={content} />
                        </div>
                    </div>
                )}

                {/* 5. Interactive JSON Tree Inspector */}
                {detectedFormat === 'json' && parsedJson && (
                    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-primary)]">
                        {/* Search Filter */}
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-secondary)] border-b border-[var(--border-color)]">
                            <Search className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                            <input
                                type="text"
                                value={jsonSearchQuery}
                                onChange={(e) => setJsonSearchQuery(e.target.value)}
                                placeholder="Filter keys or values..."
                                className="flex-1 bg-transparent text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none"
                            />
                            {jsonSearchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setJsonSearchQuery('')}
                                    className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                                >
                                    Clear
                                </button>
                            )}
                        </div>

                        {/* Interactive Tree View */}
                        <div className="flex-1 p-4 overflow-auto custom-scrollbar font-mono text-xs select-text">
                            <JsonNodeViewer 
                                data={parsedJson} 
                                searchQuery={jsonSearchQuery} 
                                path=""
                                onCopyPath={(p) => {
                                    setCopiedNode(p);
                                    setTimeout(() => setCopiedNode(null), 1800);
                                }}
                                copiedPath={copiedNode}
                            />
                        </div>
                    </div>
                )}

                {/* 6. Image Preview */}
                {detectedFormat === 'image' && (
                    <div className="flex-1 flex items-center justify-center p-6 overflow-auto custom-scrollbar bg-black/30">
                        <img 
                            src={content.trim()} 
                            alt="Preview" 
                            className="max-w-full max-h-full rounded-lg shadow-2xl border border-[var(--border-color)] object-contain"
                        />
                    </div>
                )}

                {/* 7. Plain Text Output Fallback */}
                {detectedFormat === 'text' && (
                    <div className="flex-1 p-4 overflow-auto custom-scrollbar bg-[var(--bg-primary)]">
                        <pre className="m-0 p-3 text-xs font-mono leading-relaxed rounded-lg bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] text-[var(--text-primary)] select-text">
                            <code>{content}</code>
                        </pre>
                    </div>
                )}

                {/* Expandable Console Drawer (For HTML/JS execution errors & logs) */}
                {isConsoleOpen && detectedFormat === 'html' && (
                    <div className="h-44 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] flex flex-col z-20 shadow-xl">
                        <div className="flex items-center justify-between px-3 py-1 bg-[var(--bg-primary)] border-b border-[var(--border-color)] text-[11px]">
                            <div className="flex items-center gap-1.5 font-mono text-[var(--text-muted)]">
                                <Terminal className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                                <span>Iframe Console Output</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setConsoleLogs([])}
                                    className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                                >
                                    Clear Logs
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsConsoleOpen(false)}
                                    className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                                >
                                    Close
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 p-2 overflow-auto font-mono text-[11px] space-y-1 custom-scrollbar select-text">
                            {consoleLogs.length === 0 ? (
                                <div className="text-[var(--text-muted)] italic text-center py-4">
                                    No console logs or errors recorded.
                                </div>
                            ) : (
                                consoleLogs.map((log) => (
                                    <div
                                        key={log.id}
                                        className={`flex items-start gap-2 p-1 rounded ${
                                            log.level === 'error'
                                                ? 'bg-rose-500/10 text-rose-300 border-l-2 border-rose-500'
                                                : log.level === 'warn'
                                                ? 'bg-amber-500/10 text-amber-300 border-l-2 border-amber-500'
                                                : 'text-[var(--text-primary)]'
                                        }`}
                                    >
                                        <span className="text-[var(--text-muted)] text-[10px]">{log.time}</span>
                                        <span className="font-semibold uppercase text-[9px] px-1 rounded bg-black/30">
                                            {log.level}
                                        </span>
                                        <span className="flex-1 break-all">{log.message}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// Recursive Collapsible JSON Node Viewer
interface JsonNodeViewerProps {
    data: any;
    path: string;
    searchQuery: string;
    onCopyPath: (p: string) => void;
    copiedPath: string | null;
}

const JsonNodeViewer: React.FC<JsonNodeViewerProps> = ({ 
    data, 
    path, 
    searchQuery, 
    onCopyPath, 
    copiedPath 
}) => {
    const [isExpanded, setIsExpanded] = useState<boolean>(true);

    if (data === null) {
        return <span className="text-rose-400">null</span>;
    }

    if (typeof data === 'boolean') {
        return <span className="text-amber-400">{data ? 'true' : 'false'}</span>;
    }

    if (typeof data === 'number') {
        return <span className="text-purple-400">{data}</span>;
    }

    if (typeof data === 'string') {
        return <span className="text-emerald-400">"{data}"</span>;
    }

    const isArray = Array.isArray(data);
    const keys = Object.keys(data);

    const filteredKeys = searchQuery 
        ? keys.filter(k => k.toLowerCase().includes(searchQuery.toLowerCase()) || JSON.stringify(data[k]).toLowerCase().includes(searchQuery.toLowerCase()))
        : keys;

    return (
        <div className="pl-3 border-l border-[var(--border-color)]/50 my-0.5">
            <div className="flex items-center gap-1.5 py-0.5 group">
                <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-0.5 hover:text-[var(--text-primary)] text-[var(--text-muted)] cursor-pointer"
                >
                    {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
                <span className="font-semibold text-[var(--accent-color)]">
                    {isArray ? `Array [${keys.length}]` : `Object {${keys.length}}`}
                </span>

                {path && (
                    <button
                        type="button"
                        onClick={() => {
                            navigator.clipboard.writeText(path);
                            onCopyPath(path);
                        }}
                        title={`Copy path: ${path}`}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] ml-2 flex items-center gap-0.5 cursor-pointer"
                    >
                        {copiedPath === path ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                        <span>path</span>
                    </button>
                )}
            </div>

            {isExpanded && (
                <div className="space-y-0.5 pl-2">
                    {filteredKeys.map((key) => {
                        const childPath = path ? `${path}.${key}` : key;
                        const val = data[key];
                        const isComplex = typeof val === 'object' && val !== null;

                        return (
                            <div key={key} className="flex flex-col">
                                <div className="flex items-baseline gap-1 py-0.5">
                                    <span className="text-sky-300 font-medium">"{key}":</span>
                                    {!isComplex && (
                                        <JsonNodeViewer 
                                            data={val} 
                                            path={childPath} 
                                            searchQuery={searchQuery} 
                                            onCopyPath={onCopyPath} 
                                            copiedPath={copiedPath} 
                                        />
                                    )}
                                </div>
                                {isComplex && (
                                    <JsonNodeViewer 
                                        data={val} 
                                        path={childPath} 
                                        searchQuery={searchQuery} 
                                        onCopyPath={onCopyPath} 
                                        copiedPath={copiedPath} 
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

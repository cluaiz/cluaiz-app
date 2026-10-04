import React, { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy, ArrowUpRight, Loader2, Maximize2, Minimize2, Table as TableIcon } from 'lucide-react';
import { FileIcon } from 'react-material-icon-theme';
import { ProjectCard } from '../../features/workspace/components/ProjectCard';
import { useProjectStore } from '../../store/workspace/useProjectStore';
import { useLayoutStore } from '../../store/ui/useLayoutStore';
import { cn } from '../../lib/utils';

export interface MarkdownRendererProps {
    content: string;
    className?: string;
    allowWorkspaceOpen?: boolean;
}

interface CodeBlockProps {
    language: string;
    value: string;
    allowWorkspaceOpen?: boolean;
}

const getLanguageExtension = (lang: string): string => {
    const l = (lang || '').toLowerCase().trim();
    if (l === 'rust' || l === 'rs') return 'rs';
    if (l === 'python' || l === 'py') return 'py';
    if (l === 'typescript' || l === 'ts') return 'ts';
    if (l === 'tsx') return 'tsx';
    if (l === 'javascript' || l === 'js') return 'js';
    if (l === 'jsx') return 'jsx';
    if (l === 'bash' || l === 'sh' || l === 'zsh') return 'sh';
    if (l === 'powershell' || l === 'ps1' || l === 'pwsh') return 'ps1';
    if (l === 'json') return 'json';
    if (l === 'markdown' || l === 'md') return 'md';
    if (l === 'html') return 'html';
    if (l === 'css') return 'css';
    if (l === 'sql') return 'sql';
    if (l === 'c') return 'c';
    if (l === 'cpp' || l === 'c++') return 'cpp';
    if (l === 'go') return 'go';
    if (l === 'yaml' || l === 'yml') return 'yaml';
    if (l === 'toml') return 'toml';
    return l || 'txt';
};

// ─── Callout Types & Configuration (from cluaiz.com) ─────────────────────────
type CalloutType = 'note' | 'tip' | 'important' | 'warning' | 'caution';

const CALLOUT_CFG: Record<CalloutType, { icon: string; label: string; border: string; bg: string; text: string }> = {
    note:      { icon: '■', label: 'NOTE',      border: 'border-blue-500',   bg: 'bg-blue-500/10',   text: 'text-blue-400' },
    tip:       { icon: '◆', label: 'TIP',       border: 'border-emerald-500',bg: 'bg-emerald-500/10',text: 'text-emerald-400' },
    important: { icon: '●', label: 'IMPORTANT', border: 'border-purple-500', bg: 'bg-purple-500/10', text: 'text-purple-400' },
    warning:   { icon: '▲', label: 'WARNING',   border: 'border-amber-500',  bg: 'bg-amber-500/10',  text: 'text-amber-400' },
    caution:   { icon: '⬟', label: 'CAUTION',   border: 'border-rose-500',   bg: 'bg-rose-500/10',   text: 'text-rose-400' },
};

function extractPlainText(node: React.ReactNode): string {
    if (typeof node === 'string') return node;
    if (typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(extractPlainText).join('');
    if (React.isValidElement(node)) {
        return extractPlainText((node as React.ReactElement<{ children?: React.ReactNode }>).props?.children);
    }
    return '';
}

function parseCallout(text: string): { type: CalloutType; content: string } | null {
    const match = text.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*([\s\S]*)/i);
    if (!match) return null;
    return { type: match[1].toLowerCase() as CalloutType, content: match[2].trim() };
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, value, allowWorkspaceOpen = false }) => {
    const [copied, setCopied] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isOpeningWorkspace, setIsOpeningWorkspace] = useState(false);
    const { setSplitPaneWidth } = useLayoutStore();

    // 1. Detect Multi-File Project Manifest Block (Mode 1)
    if (language === 'project' || language === 'workspace') {
        try {
            const parsed = JSON.parse(value);
            if (parsed && parsed.files && typeof parsed.files === 'object') {
                return (
                    <ProjectCard
                        id={parsed.id || `proj_${Date.now()}`}
                        name={parsed.name || 'Application Project'}
                        description={parsed.description}
                        files={parsed.files}
                    />
                );
            }
        } catch {}
    }

    const handleCopy = () => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const ext = getLanguageExtension(language);

    const handleOpenInWorkspace = async () => {
        if (isOpeningWorkspace) return;
        setIsOpeningWorkspace(true);
        try {
            const filename = `snippet.${ext}`;
            const store = useProjectStore.getState();
            const activeProj = store.getActiveProject();

            if (activeProj) {
                await store.createFile(filename, value);
                store.setActiveFile(filename);
                store.openWorkspace();
            } else {
                const projId = `workspace_snippet_${Date.now()}`;
                await store.createOrUpdateProject(
                    projId,
                    'Scratch Workspace',
                    { [filename]: value },
                    'Created from chat snippet'
                );
                store.openWorkspace(projId);
                store.setActiveFile(filename);
            }
            setSplitPaneWidth(50);
        } catch (err) {
            console.error('Failed to open snippet in workspace:', err);
        } finally {
            setIsOpeningWorkspace(false);
        }
    };

    const lines = value.split('\n');
    const displayLang = (language || 'code').toUpperCase();

    // 2. Real Code Editor Block (Line Numbers + Dynamic Theme Matching + Full View Expansion)
    return (
        <>
            {isExpanded && (
                <div 
                    className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-200"
                    onClick={() => setIsExpanded(false)}
                >
                    <div 
                        className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden font-mono"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <FileIcon fileName={`code.${ext}`} fileExtension={ext} languageId={language} size={15} />
                                <span className="font-mono font-bold tracking-wider text-xs uppercase text-[var(--accent-color)]">
                                    {displayLang}
                                </span>
                                <span className="text-[10px] text-[var(--text-muted)] font-mono">
                                    {lines.length} lines
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={handleCopy}
                                    className={cn(
                                        "p-1.5 rounded-md transition-all select-none cursor-pointer border",
                                        copied
                                            ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/40"
                                            : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                                    )}
                                    title={copied ? "Copied code!" : "Copy code"}
                                >
                                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsExpanded(false)}
                                    className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-color)] transition-colors cursor-pointer"
                                    title="Minimize"
                                >
                                    <Minimize2 className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto custom-scrollbar flex items-stretch text-xs leading-relaxed bg-[var(--bg-primary)]">
                            <div className="flex flex-col text-right px-3 py-3 select-none border-r border-[var(--border-color)] text-[var(--text-muted)]/60 font-mono text-[11px] leading-5 shrink-0 bg-[var(--bg-secondary)]/50">
                                {lines.map((_, i) => (
                                    <span key={i} className="tabular-nums">{i + 1}</span>
                                ))}
                            </div>
                            <pre className="p-3 font-mono text-xs leading-5 text-[var(--text-primary)] select-text m-0 overflow-x-auto flex-1 bg-transparent">
                                <code>{value}</code>
                            </pre>
                        </div>
                    </div>
                </div>
            )}

            <div className="relative my-5 w-full min-w-0 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] overflow-hidden shadow-sm font-mono">
                {/* Code Editor Header */}
                <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] select-none">
                    <div className="flex items-center gap-2">
                        <FileIcon 
                            fileName={`code.${ext}`} 
                            fileExtension={ext} 
                            languageId={language} 
                            size={14} 
                        />
                        <span className="font-mono font-bold tracking-wider text-[11px] uppercase text-[var(--accent-color)]">
                            {displayLang}
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                        {/* Workspace button ONLY when explicitly enabled (in Chat) - Icon Only */}
                        {allowWorkspaceOpen && (
                            <button
                                type="button"
                                disabled={isOpeningWorkspace}
                                onClick={handleOpenInWorkspace}
                                className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-color)] hover:border-[var(--accent-color)]/60 transition-all select-none cursor-pointer disabled:opacity-60"
                                title="Open in Workspace Editor"
                            >
                                {isOpeningWorkspace ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--accent-color)]" />
                                ) : (
                                    <ArrowUpRight className="w-3.5 h-3.5" />
                                )}
                            </button>
                        )}

                        {/* Copy Code Button - Icon Only */}
                        <button
                            type="button"
                            onClick={handleCopy}
                            className={cn(
                                "p-1.5 rounded-md transition-all select-none cursor-pointer border",
                                copied
                                    ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/40"
                                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] border-[var(--border-color)] hover:border-[var(--accent-color)]/60"
                            )}
                            title={copied ? "Copied code!" : "Copy code"}
                        >
                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>

                        {/* Expand Code Button - Icon Only */}
                        <button
                            type="button"
                            onClick={() => setIsExpanded(true)}
                            className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-color)] hover:border-[var(--accent-color)]/60 transition-all select-none cursor-pointer"
                            title="Expand Code (Full View)"
                        >
                            <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Code Editor Content with Line Numbers Column */}
                <div className="flex items-stretch overflow-x-auto text-xs leading-relaxed custom-scrollbar bg-[var(--bg-primary)]">
                    {/* Line Numbers Column */}
                    <div className="flex flex-col text-right px-3 py-3 select-none border-r border-[var(--border-color)] text-[var(--text-muted)]/60 font-mono text-[11px] leading-5 shrink-0 bg-[var(--bg-secondary)]/50">
                        {lines.map((_, i) => (
                            <span key={i} className="tabular-nums">
                                {i + 1}
                            </span>
                        ))}
                    </div>

                    {/* Code Content */}
                    <pre className="p-3 font-mono text-xs leading-5 text-[var(--text-primary)] select-text m-0 overflow-x-auto flex-1 bg-transparent">
                        <code>{value}</code>
                    </pre>
                </div>
            </div>
        </>
    );
};

const MarkdownTable: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [copied, setCopied] = useState(false);
    const tableContainerRef = useRef<HTMLDivElement | null>(null);

    const handleCopyTable = () => {
        if (!tableContainerRef.current) return;
        const rows = Array.from(tableContainerRef.current.querySelectorAll('tr'));
        if (!rows.length) return;
        const text = rows.map(row => {
            const cells = Array.from(row.querySelectorAll('th, td'));
            return cells.map(c => c.textContent?.trim().replace(/\s+/g, ' ') || '').join('\t');
        }).join('\n');
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <>
            {isExpanded && (
                <div 
                    className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-200"
                    onClick={() => setIsExpanded(false)}
                >
                    <div 
                        className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl shadow-2xl w-full max-w-6xl max-h-[85vh] flex flex-col overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] flex-shrink-0">
                            <span className="flex items-center gap-2 text-xs font-bold font-mono text-[var(--text-primary)]">
                                <TableIcon className="w-4 h-4 text-[var(--accent-color)]" />
                                <span>Expanded Table View</span>
                            </span>
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={handleCopyTable}
                                    className={cn(
                                        "p-1.5 rounded-md transition-all select-none cursor-pointer border",
                                        copied
                                            ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/40"
                                            : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                                    )}
                                    title={copied ? "Copied table data!" : "Copy Table Data"}
                                >
                                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsExpanded(false)}
                                    className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-color)] transition-colors cursor-pointer"
                                    title="Minimize"
                                >
                                    <Minimize2 className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto custom-scrollbar p-4 bg-[var(--bg-primary)]">
                            <table className="min-w-full text-left border-collapse border border-[var(--border-color)] rounded-lg">
                                {children}
                            </table>
                        </div>
                    </div>
                </div>
            )}

            <div className="my-6 w-full max-w-full border border-[var(--border-color)] bg-[var(--bg-primary)] rounded-lg overflow-hidden group shadow-xs">
                <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] text-[10px] font-mono text-[var(--text-muted)] flex-shrink-0">
                    <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                        <TableIcon className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                        <span>Table</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={handleCopyTable}
                            className={cn(
                                "p-1.5 rounded-md transition-all select-none cursor-pointer border",
                                copied
                                    ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/40"
                                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                            )}
                            title={copied ? "Copied table data!" : "Copy Table Data"}
                        >
                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsExpanded(true)}
                            className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-color)] transition-colors cursor-pointer"
                            title="Expand Table (Full View)"
                        >
                            <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
                <div ref={tableContainerRef} className="w-full overflow-x-auto custom-scrollbar bg-[var(--bg-primary)]">
                    <table className="min-w-full text-left border-collapse">{children}</table>
                </div>
            </div>
        </>
    );
};

export interface MarkdownFrontmatterMetadata {
    name?: string;
    version?: string;
    description?: string;
    author?: string;
    triggers?: string[];
    allowedTools?: string[];
    [key: string]: any;
}

export function parseMarkdownWithFrontmatter(text: string): {
    metadata: MarkdownFrontmatterMetadata | null;
    cleanBody: string;
} {
    if (!text) return { metadata: null, cleanBody: '' };
    const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    if (!match) {
        return { metadata: null, cleanBody: text };
    }

    const rawYaml = match[1];
    const cleanBody = text.slice(match[0].length).trim();

    const metadata: MarkdownFrontmatterMetadata = {};
    const lines = rawYaml.split(/\r?\n/);
    let currentListKey = '';

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;

        if (line.startsWith('- ') && currentListKey) {
            const item = line.slice(2).trim().replace(/^["']|["']$/g, '');
            if (!Array.isArray(metadata[currentListKey])) {
                metadata[currentListKey] = [];
            }
            metadata[currentListKey].push(item);
            continue;
        }

        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) {
            const rawKey = line.slice(0, colonIdx).trim().toLowerCase();
            const val = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
            const key = (rawKey === 'allowed-tools' || rawKey === 'allowed_tools') ? 'allowedTools' : 
                        (rawKey === 'semantic' || rawKey === 'triggers') ? 'triggers' : rawKey;
            currentListKey = key;
            if (val) {
                metadata[key] = val;
            } else {
                metadata[key] = [];
            }
        }
    }

    // Only treat as frontmatter if at least one standard metadata key exists
    if (!metadata.name && !metadata.description && !metadata.triggers && !metadata.version) {
        return { metadata: null, cleanBody: text };
    }

    return { metadata, cleanBody };
}

const FrontmatterCard: React.FC<{ metadata: MarkdownFrontmatterMetadata }> = ({ metadata }) => {
    return (
        <div className="mb-8 p-5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/50 backdrop-blur-sm space-y-3.5 select-none shadow-sm">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                    {metadata.name && (
                        <span className="font-bold text-base text-[var(--text-primary)]">
                            {metadata.name}
                        </span>
                    )}
                    {metadata.version && (
                        <span className="text-[10px] font-mono text-[var(--accent-color)] bg-[var(--accent-color)]/10 px-2 py-0.5 rounded border border-[var(--accent-color)]/20 font-bold">
                            v{metadata.version}
                        </span>
                    )}
                </div>
                {metadata.author && (
                    <span className="text-[11px] text-[var(--text-muted)] font-mono">
                        author: {metadata.author}
                    </span>
                )}
            </div>

            {metadata.description && (
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed font-sans">
                    {metadata.description}
                </p>
            )}

            {metadata.triggers && Array.isArray(metadata.triggers) && metadata.triggers.length > 0 && (
                <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono">
                        Semantic Triggers ({metadata.triggers.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto custom-scrollbar">
                        {metadata.triggers.map((t: string, idx: number) => (
                            <span 
                                key={idx} 
                                className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-color)]/60"
                            >
                                {t}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {metadata.allowedTools && Array.isArray(metadata.allowedTools) && metadata.allowedTools.length > 0 && (
                <div className="space-y-1.5 pt-1.5 border-t border-[var(--border-color)]/40">
                    <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono">
                        Allowed Capabilities
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                        {metadata.allowedTools.map((t: string, idx: number) => (
                            <span 
                                key={idx} 
                                className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold"
                            >
                                ✓ {t}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ 
    content, 
    className = '', 
    allowWorkspaceOpen = false 
}) => {
    if (!content) return null;

    const { metadata, cleanBody } = parseMarkdownWithFrontmatter(content);

    return (
        <article className={cn("max-w-none w-full markdown-body leading-relaxed select-text text-[var(--text-primary)]", className)}>
            {metadata && <FrontmatterCard metadata={metadata} />}
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    code({ inline, className: codeClassName, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(codeClassName || '');
                        const codeString = String(children).replace(/\n$/, '');

                        if (!inline && (match || codeString.includes('\n'))) {
                            return (
                                <CodeBlock
                                    language={match ? match[1] : ''}
                                    value={codeString}
                                    allowWorkspaceOpen={allowWorkspaceOpen}
                                />
                            );
                        }

                        return (
                            <code
                                className="px-1.5 py-0.5 text-[11px] font-mono bg-[var(--bg-secondary)] text-[var(--accent-color)] border border-[var(--border-color)] rounded-sm whitespace-nowrap select-text"
                                {...props}
                            >
                                {children}
                            </code>
                        );
                    },
                    h1({ children, id }: any) {
                        return (
                            <h1 id={id} className="scroll-mt-28 mt-6 mb-4 text-2xl font-black uppercase tracking-tight text-[var(--text-primary)] leading-snug first:mt-0">
                                {children}
                            </h1>
                        );
                    },
                    h2({ children, id }: any) {
                        return (
                            <h2 id={id} className="scroll-mt-24 mt-8 mb-3 text-xl sm:text-2xl font-black uppercase tracking-tight text-[var(--text-primary)] leading-snug first:mt-0">
                                {children}
                            </h2>
                        );
                    },
                    h3({ children, id }: any) {
                        return (
                            <h3 id={id} className="scroll-mt-24 mt-6 mb-3 text-base font-black uppercase tracking-widest text-[var(--text-primary)] first:mt-0">
                                {children}
                            </h3>
                        );
                    },
                    h4({ children, id }: any) {
                        return (
                            <h4 id={id} className="scroll-mt-24 mt-5 mb-2 text-sm font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                                {children}
                            </h4>
                        );
                    },
                    h5({ children, id }: any) {
                        return (
                            <h5 id={id} className="scroll-mt-24 mt-4 mb-2 text-xs font-black uppercase tracking-[0.25em] text-[var(--text-muted)]">
                                {children}
                            </h5>
                        );
                    },
                    h6({ children, id }: any) {
                        return (
                            <h6 id={id} className="scroll-mt-24 mt-4 mb-2 text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)]">
                                {children}
                            </h6>
                        );
                    },
                    p({ children }: any) {
                        return (
                            <p className="mb-4 text-sm leading-relaxed text-[var(--text-secondary)] font-normal last:mb-0">
                                {children}
                            </p>
                        );
                    },
                    ul({ children }: any) {
                        return (
                            <ul className="mb-4 space-y-2 list-none pl-3">
                                {children}
                            </ul>
                        );
                    },
                    ol({ children }: any) {
                        return (
                            <ol className="mb-4 space-y-2 list-decimal pl-6 text-sm text-[var(--text-secondary)] leading-relaxed">
                                {children}
                            </ol>
                        );
                    },
                    li({ children }: any) {
                        return (
                            <li className="flex items-start gap-2.5 text-sm text-[var(--text-secondary)] leading-relaxed">
                                <span className="text-[var(--accent-color)] mt-1.5 shrink-0 text-[8px] select-none">■</span>
                                <div className="flex-1 min-w-0">{children}</div>
                            </li>
                        );
                    },
                    blockquote({ children }: any) {
                        const childArray = React.Children.toArray(children);
                        const firstP = childArray.find(
                            (c): c is React.ReactElement => React.isValidElement(c) && (c as React.ReactElement).type === 'p'
                        );
                        const rawText = firstP
                            ? extractPlainText((firstP as React.ReactElement<{ children?: React.ReactNode }>).props?.children)
                            : '';
                        const callout = parseCallout(rawText);

                        if (callout && CALLOUT_CFG[callout.type]) {
                            const cfg = CALLOUT_CFG[callout.type];
                            return (
                                <div className={cn("my-6 p-5 border-l-4 rounded-r-xl select-text shadow-sm", cfg.border, cfg.bg)}>
                                    <div className={cn("flex items-center gap-2 mb-2 text-[10px] font-black uppercase tracking-widest select-none", cfg.text)}>
                                        <span>{cfg.icon}</span>
                                        <span>{cfg.label}</span>
                                    </div>
                                    <div className="text-sm leading-relaxed text-[var(--text-secondary)] m-0">
                                        {callout.content || children}
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <blockquote className="my-6 pl-5 border-l-4 border-[var(--border-color)] italic text-[var(--text-secondary)] text-sm select-text">
                                {children}
                            </blockquote>
                        );
                    },
                    table({ children }: any) {
                        return <MarkdownTable>{children}</MarkdownTable>;
                    },
                    thead({ children }: any) {
                        return (
                            <thead className="bg-[var(--bg-secondary)] border-b border-[var(--border-color)]">
                                {children}
                            </thead>
                        );
                    },
                    tbody({ children }: any) {
                        return (
                            <tbody className="divide-y divide-[var(--border-color)] bg-[var(--bg-primary)]/40">{children}</tbody>
                        );
                    },
                    tr({ children }: any) {
                        return (
                            <tr className="hover:bg-[var(--bg-secondary)]/70 transition-colors">
                                {children}
                            </tr>
                        );
                    },
                    th({ children }: any) {
                        return (
                            <th className="px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] whitespace-nowrap border-r border-[var(--border-color)] last:border-r-0 select-none bg-[var(--bg-secondary)]/50">
                                {children}
                            </th>
                        );
                    },
                    td({ children }: any) {
                        return (
                            <td className="px-4 py-2.5 text-xs font-mono text-[var(--text-primary)] align-top border-r border-[var(--border-color)] last:border-r-0">
                                <div className="w-max max-w-[350px] whitespace-normal break-words leading-relaxed">
                                    {children}
                                </div>
                            </td>
                        );
                    },
                    a({ children, href, ...props }: any) {
                        return (
                            <a
                                href={href}
                                target={href?.startsWith("http") ? "_blank" : undefined}
                                rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
                                className="text-[var(--accent-color)] underline underline-offset-4 decoration-[var(--accent-color)]/40 hover:decoration-[var(--accent-color)] transition-all font-medium"
                                {...props}
                            >
                                {children}
                            </a>
                        );
                    },
                    hr() {
                        return <hr className="my-12 border-0 h-px bg-gradient-to-r from-transparent via-[var(--border-color)] to-transparent" />;
                    },
                    img({ src, alt }: any) {
                        return (
                            <figure className="my-8">
                                <img src={src} alt={alt ?? ""} className="w-full border border-[var(--border-color)] rounded-lg shadow-sm" />
                                {alt && (
                                    <figcaption className="mt-2 text-center text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">
                                        {alt}
                                    </figcaption>
                                )}
                            </figure>
                        );
                    },
                    strong({ children }: any) {
                        return <strong className="font-black text-[var(--text-primary)]">{children}</strong>;
                    },
                    em({ children }: any) {
                        return <em className="not-italic font-semibold text-[var(--text-secondary)]">{children}</em>;
                    }
                }}
            >
                {cleanBody}
            </ReactMarkdown>
        </article>
    );
};

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Check, Copy } from 'lucide-react';

interface MarkdownRendererProps {
    content: string;
    className?: string;
}

interface CodeBlockProps {
    language: string;
    value: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, value }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="my-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/50 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--bg-secondary)] border-b border-[var(--border-color)]/60 text-[11px] font-mono text-[var(--text-muted)] select-none">
                <span className="font-semibold uppercase tracking-wider text-[10px] text-[var(--accent-color)]">
                    {language || 'text'}
                </span>
                <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-white/[0.06] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                    title="Copy code"
                >
                    {copied ? (
                        <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-[10px] text-emerald-400 font-sans">Copied!</span>
                        </>
                    ) : (
                        <>
                            <Copy className="w-3 h-3" />
                            <span className="text-[10px] font-sans">Copy</span>
                        </>
                    )}
                </button>
            </div>
            <pre className="p-3 text-xs font-mono leading-relaxed overflow-x-auto text-[var(--text-primary)] select-text custom-scrollbar">
                <code>{value}</code>
            </pre>
        </div>
    );
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
    if (!content) return null;

    return (
        <div className={`markdown-body leading-relaxed select-text text-[var(--text-primary)] ${className}`} style={{ fontSize: 'inherit' }}>
            <ReactMarkdown
                components={{
                    code({ inline, className: codeClassName, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(codeClassName || '');
                        const codeString = String(children).replace(/\n$/, '');

                        if (!inline && (match || codeString.includes('\n'))) {
                            return (
                                <CodeBlock
                                    language={match ? match[1] : ''}
                                    value={codeString}
                                />
                            );
                        }

                        return (
                            <code
                                className="px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)]/60 text-[var(--accent-color)] font-mono text-[0.85em] select-text"
                                {...props}
                            >
                                {children}
                            </code>
                        );
                    },
                    h1({ children }: any) {
                        return (
                            <h1 className="text-base sm:text-lg font-bold border-b border-[var(--border-color)] pb-1 mb-2.5 mt-3 text-[var(--text-primary)] first:mt-0">
                                {children}
                            </h1>
                        );
                    },
                    h2({ children }: any) {
                        return (
                            <h2 className="text-sm sm:text-base font-bold text-[var(--text-primary)] mb-2 mt-2.5 first:mt-0">
                                {children}
                            </h2>
                        );
                    },
                    h3({ children }: any) {
                        return (
                            <h3 className="text-xs sm:text-sm font-semibold text-[var(--text-primary)] mb-1.5 mt-2 first:mt-0">
                                {children}
                            </h3>
                        );
                    },
                    p({ children }: any) {
                        return (
                            <p className="my-1.5 leading-relaxed text-[var(--text-primary)] last:mb-0">
                                {children}
                            </p>
                        );
                    },
                    ul({ children }: any) {
                        return (
                            <ul className="list-disc pl-5 my-1.5 space-y-0.5 text-[var(--text-primary)]">
                                {children}
                            </ul>
                        );
                    },
                    ol({ children }: any) {
                        return (
                            <ol className="list-decimal pl-5 my-1.5 space-y-0.5 text-[var(--text-primary)]">
                                {children}
                            </ol>
                        );
                    },
                    li({ children }: any) {
                        return (
                            <li className="leading-relaxed">
                                {children}
                            </li>
                        );
                    },
                    blockquote({ children }: any) {
                        return (
                            <blockquote className="border-l-2 border-[var(--accent-color)] pl-3 my-2 text-[var(--text-muted)] italic">
                                {children}
                            </blockquote>
                        );
                    },
                    table({ children }: any) {
                        return (
                            <div className="overflow-x-auto my-2.5 rounded-lg border border-[var(--border-color)]">
                                <table className="w-full border-collapse text-left text-xs">
                                    {children}
                                </table>
                            </div>
                        );
                    },
                    thead({ children }: any) {
                        return (
                            <thead className="bg-[var(--bg-secondary)] border-b border-[var(--border-color)]">
                                {children}
                            </thead>
                        );
                    },
                    th({ children }: any) {
                        return (
                            <th className="p-2 font-semibold text-[var(--text-primary)] border-r border-[var(--border-color)] last:border-r-0">
                                {children}
                            </th>
                        );
                    },
                    td({ children }: any) {
                        return (
                            <td className="p-2 border-t border-[var(--border-color)] border-r border-[var(--border-color)] last:border-r-0 text-[var(--text-secondary)]">
                                {children}
                            </td>
                        );
                    },
                    a({ children, href, ...props }: any) {
                        return (
                            <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[var(--accent-color)] underline underline-offset-2 hover:opacity-80 transition-opacity"
                                {...props}
                            >
                                {children}
                            </a>
                        );
                    },
                    hr() {
                        return <hr className="my-2.5 border-[var(--border-color)]" />;
                    }
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
};

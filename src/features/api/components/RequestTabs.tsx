import React, { useState } from 'react';
import { useApiStore } from '../../../store/api/useApiStore';
import { MarkdownRenderer } from '../../../components/ui/MarkdownRenderer';
import { CodeEditor } from '../../../components/ui/CodeEditor';
import { FileText, Code2, Braces, Sliders, Check, Copy } from 'lucide-react';

export const RequestTabs: React.FC = () => {
    const {
        activeEndpoint,
        activeTab,
        reqBody,
        reqHeaders,
        reqLanguage,
        setActiveTab,
        setReqBody,
        setReqHeaders
    } = useApiStore();

    const [activeSnippetLang, setActiveSnippetLang] = useState<string>('curl');
    const [copiedSnippet, setCopiedSnippet] = useState(false);

    const handleCopySnippet = (code: string) => {
        navigator.clipboard.writeText(code);
        setCopiedSnippet(true);
        setTimeout(() => setCopiedSnippet(false), 2000);
    };

    const handleFormatJson = () => {
        try {
            const parsed = JSON.parse(reqBody);
            setReqBody(JSON.stringify(parsed, null, 2));
        } catch {
            // Cannot format invalid JSON
        }
    };

    const examples = activeEndpoint?.examples || [];
    const activeSnippet =
        examples.find((e) => e.language.toLowerCase() === activeSnippetLang.toLowerCase()) ||
        examples[0];

    return (
        <div className="flex flex-col h-full w-full bg-[var(--bg-primary)]">
            {/* Tab Navigation */}
            <div className="flex items-center gap-1 px-3 pt-2 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] select-none">
                <button
                    type="button"
                    onClick={() => setActiveTab('params')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-all cursor-pointer ${
                        activeTab === 'params'
                            ? 'border-[var(--accent-color)] text-[var(--accent-color)]'
                            : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                >
                    <Braces className="w-3.5 h-3.5" />
                    <span>Body Payload</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('headers')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-all cursor-pointer ${
                        activeTab === 'headers'
                            ? 'border-[var(--accent-color)] text-[var(--accent-color)]'
                            : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Headers</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('docs')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-all cursor-pointer ${
                        activeTab === 'docs'
                            ? 'border-[var(--accent-color)] text-[var(--accent-color)]'
                            : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Documentation</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('snippets')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-all cursor-pointer ${
                        activeTab === 'snippets'
                            ? 'border-[var(--accent-color)] text-[var(--accent-color)]'
                            : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>Code Snippets</span>
                </button>

                {activeTab === 'params' && (
                    <button
                        type="button"
                        onClick={handleFormatJson}
                        className="ml-auto px-2 py-0.5 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.04] border border-[var(--border-color)] rounded transition-colors cursor-pointer"
                    >
                        Beautify JSON
                    </button>
                )}
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-auto p-3 custom-scrollbar">
                {/* 1. Body Editor Tab */}
                {activeTab === 'params' && (
                    <div className="h-full flex flex-col">
                        <CodeEditor
                            value={reqBody}
                            onChange={setReqBody}
                            language={reqLanguage || 'json'}
                        />
                    </div>
                )}

                {/* 2. Headers Tab */}
                {activeTab === 'headers' && (
                    <div className="h-full flex flex-col gap-1.5">
                        <label className="text-[11px] font-semibold text-[var(--text-muted)]">
                            Request Headers (JSON Object)
                        </label>
                        <div className="flex-1 min-h-0">
                            <CodeEditor
                                value={reqHeaders}
                                onChange={setReqHeaders}
                                language="json"
                            />
                        </div>
                    </div>
                )}

                {/* 3. Documentation Tab */}
                {activeTab === 'docs' && (
                    <div className="h-full pr-2">
                        {activeEndpoint ? (
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-sm font-bold text-[var(--text-primary)] font-mono">
                                        {activeEndpoint.method} {activeEndpoint.path}
                                    </h3>
                                    <p className="mt-1 text-xs text-[var(--text-muted)] leading-relaxed">
                                        {activeEndpoint.desc}
                                    </p>
                                </div>

                                {activeEndpoint.params && activeEndpoint.params.length > 0 && (
                                    <div>
                                        <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                                            Parameters
                                        </h4>
                                        <div className="overflow-x-auto border border-[var(--border-color)] rounded-lg">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-[var(--bg-secondary)] border-b border-[var(--border-color)] text-[var(--text-muted)]">
                                                    <tr>
                                                        <th className="p-2 font-mono">Name</th>
                                                        <th className="p-2">Type</th>
                                                        <th className="p-2">Required</th>
                                                        <th className="p-2">Description</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-[var(--border-color)]">
                                                    {activeEndpoint.params.map((p) => (
                                                        <tr key={p.name} className="hover:bg-white/[0.02]">
                                                            <td className="p-2 font-mono font-medium text-[var(--accent-color)]">
                                                                {p.name}
                                                            </td>
                                                            <td className="p-2 font-mono text-[var(--text-muted)]">
                                                                {p.type}
                                                            </td>
                                                            <td className="p-2">
                                                                {p.req ? (
                                                                    <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">
                                                                        Required
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[10px] text-[var(--text-muted)]">
                                                                        Optional
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="p-2 text-[var(--text-muted)] leading-relaxed">
                                                                {p.desc}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {activeEndpoint.docs_content && (
                                    <div className="pt-2 border-t border-[var(--border-color)]">
                                        <MarkdownRenderer content={activeEndpoint.docs_content} />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-xs text-[var(--text-muted)]">
                                Select an endpoint to view documentation.
                            </div>
                        )}
                    </div>
                )}

                {/* 4. Snippets Tab */}
                {activeTab === 'snippets' && (
                    <div className="h-full flex flex-col">
                        {examples.length > 0 ? (
                            <>
                                {/* Snippet Language Pills */}
                                <div className="flex items-center gap-1.5 pb-2.5 mb-2 border-b border-[var(--border-color)]">
                                    {examples.map((ex) => {
                                        const isSelected =
                                            (activeSnippet?.language || '').toLowerCase() ===
                                            ex.language.toLowerCase();

                                        return (
                                            <button
                                                key={ex.language}
                                                type="button"
                                                onClick={() => setActiveSnippetLang(ex.language)}
                                                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                                                    isSelected
                                                        ? 'bg-[var(--accent-color)] text-white shadow-sm'
                                                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.04]'
                                                }`}
                                            >
                                                {ex.title}
                                            </button>
                                        );
                                    })}

                                    {activeSnippet && (
                                        <button
                                            type="button"
                                            onClick={() => handleCopySnippet(activeSnippet.code)}
                                            className="ml-auto flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                                        >
                                            {copiedSnippet ? (
                                                <>
                                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                                    <span className="text-emerald-400">Copied!</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className="w-3.5 h-3.5" />
                                                    <span>Copy Code</span>
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>

                                {/* Code Snippet Pre */}
                                {activeSnippet && (
                                    <pre className="flex-1 p-3 text-xs font-mono leading-relaxed rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] overflow-auto custom-scrollbar">
                                        <code>{activeSnippet.code}</code>
                                    </pre>
                                )}
                            </>
                        ) : (
                            <div className="text-xs text-[var(--text-muted)]">
                                No code snippets available for this endpoint.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

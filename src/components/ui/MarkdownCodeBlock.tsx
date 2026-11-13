import React, { useMemo, useState } from 'react';
import { Check, Copy, ArrowUpRight, Loader2, Maximize2, Minimize2, Workflow } from 'lucide-react';
import { FileIcon } from 'react-material-icon-theme';
import { ProjectCard } from '../../features/workspace/components/ProjectCard';
import { useProjectStore } from '../../store/workspace/useProjectStore';
import { useLayoutStore } from '../../store/ui/useLayoutStore';
import { isFlowText, useFlowApplyTarget } from '../../features/automation/applyTarget';
import { cn } from '../../lib/utils';
import hljs from 'highlight.js';
// @ts-ignore
import 'highlight.js/styles/vs2015.css';

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

export const CodeBlock: React.FC<CodeBlockProps> = ({ language, value, allowWorkspaceOpen = false }) => {
    const [copied, setCopied] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isOpeningWorkspace, setIsOpeningWorkspace] = useState(false);
    const { setSplitPaneWidth } = useLayoutStore();
    const flowTarget = useFlowApplyTarget(state => state.target);
    const isFlow = useMemo(() => Boolean(flowTarget) && /^(ya?ml|json)$/i.test(language) && isFlowText(value), [flowTarget, language, value]);

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

    const highlightedCode = React.useMemo(() => {
        if (!value) return '';
        try {
            const validLang = language && hljs.getLanguage(language) ? language : undefined;
            if (validLang) {
                return hljs.highlight(value, { language: validLang, ignoreIllegals: true }).value;
            }
            return hljs.highlightAuto(value).value;
        } catch {
            return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }
    }, [value, language]);

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
                                <code dangerouslySetInnerHTML={{ __html: highlightedCode }} className="hljs !bg-transparent !p-0 font-mono" />
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

                        {/* A whole flow file, while a flow is open in the Automation builder */}
                        {isFlow && flowTarget && (
                            <button
                                type="button"
                                onClick={() => flowTarget.apply(value)}
                                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-[var(--accent-color)] hover:bg-[var(--bg-tertiary)] border border-[var(--accent-color)]/40 hover:border-[var(--accent-color)] transition-all select-none cursor-pointer"
                                title={`Apply to the flow ${flowTarget.name}`}
                            >
                                <Workflow className="w-3.5 h-3.5" /> Apply to flow
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
                        <code dangerouslySetInnerHTML={{ __html: highlightedCode }} className="hljs !bg-transparent !p-0 font-mono" />
                    </pre>
                </div>
            </div>
        </>
    );
};

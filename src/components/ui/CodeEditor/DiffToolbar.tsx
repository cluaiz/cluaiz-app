import React, { useState } from 'react';
import { 
    ChevronUp, 
    ChevronDown, 
    Columns2, 
    Rows2, 
    FoldVertical, 
    UnfoldVertical, 
    ArrowLeftRight, 
    Copy, 
    Check, 
    Maximize2, 
    Minimize2, 
    Lock, 
    Unlock,
    Space,
    CheckCircle2
} from 'lucide-react';
import { CodeEditorLanguage, DiffStats } from './types';
import { DEFAULT_MONACO_LANGUAGES } from './languages';

export interface DiffToolbarProps {
    diffStats: DiffStats;
    currentDiffIndex: number;
    totalDiffs: number;
    isSideBySide: boolean;
    onToggleSideBySide: () => void;
    isHideUnchanged: boolean;
    onToggleHideUnchanged: () => void;
    isIgnoreWhitespace: boolean;
    onToggleIgnoreWhitespace: () => void;
    isOriginalEditable: boolean;
    onToggleOriginalEditable: () => void;
    onNextDiff: () => void;
    onPrevDiff: () => void;
    onSwap: () => void;
    onCopyModified: () => void;
    onCopyOriginal: () => void;
    onCopyPatch: () => void;
    language: CodeEditorLanguage;
    allowLanguageChange?: boolean;
    onLanguageChange?: (lang: CodeEditorLanguage) => void;
    isFullscreen: boolean;
    onToggleFullscreen: () => void;
    extraToolbarActions?: React.ReactNode;
}

export const DiffToolbar: React.FC<DiffToolbarProps> = ({
    diffStats,
    currentDiffIndex,
    totalDiffs,
    isSideBySide,
    onToggleSideBySide,
    isHideUnchanged,
    onToggleHideUnchanged,
    isIgnoreWhitespace,
    onToggleIgnoreWhitespace,
    isOriginalEditable,
    onToggleOriginalEditable,
    onNextDiff,
    onPrevDiff,
    onSwap,
    onCopyModified,
    onCopyOriginal,
    onCopyPatch,
    language,
    allowLanguageChange = true,
    onLanguageChange,
    isFullscreen,
    onToggleFullscreen,
    extraToolbarActions
}) => {
    const [copiedTarget, setCopiedTarget] = useState<'modified' | 'original' | 'patch' | null>(null);

    const handleCopy = (target: 'modified' | 'original' | 'patch') => {
        if (target === 'modified') onCopyModified();
        else if (target === 'original') onCopyOriginal();
        else if (target === 'patch') onCopyPatch();

        setCopiedTarget(target);
        setTimeout(() => setCopiedTarget(null), 1800);
    };

    return (
        <div className="flex flex-wrap items-center justify-between gap-1.5 px-3 py-1.5 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] select-none text-xs">
            {/* Left Controls: Diff Navigation & Statistics */}
            <div className="flex items-center gap-1.5">
                {/* Diff Navigation Buttons */}
                <div className="flex items-center border border-[var(--border-color)] rounded bg-[var(--bg-primary)] px-0.5">
                    <button
                        type="button"
                        onClick={onPrevDiff}
                        title="Previous Difference (Shift+F7)"
                        disabled={totalDiffs === 0}
                        className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                        <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-1 text-[11px] font-mono text-[var(--text-muted)] min-w-[32px] text-center">
                        {totalDiffs > 0 ? `${currentDiffIndex} / ${totalDiffs}` : '0 / 0'}
                    </span>
                    <button
                        type="button"
                        onClick={onNextDiff}
                        title="Next Difference (F7)"
                        disabled={totalDiffs === 0}
                        className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                        <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Diff Statistics Badge */}
                <div className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-[var(--bg-primary)] border border-[var(--border-color)]">
                    <span className="text-emerald-500 font-medium">+{diffStats.additions}</span>
                    <span className="text-[var(--text-muted)]">/</span>
                    <span className="text-rose-500 font-medium">-{diffStats.deletions}</span>
                    {totalDiffs === 0 && (
                        <span className="flex items-center gap-1 text-[var(--text-muted)] text-[10px] ml-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            Identical
                        </span>
                    )}
                </div>

                {/* Swap Original & Modified */}
                <button
                    type="button"
                    onClick={onSwap}
                    title="Swap Original ↔ Modified contents"
                    className="flex items-center gap-1 px-1.5 py-1 rounded text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors cursor-pointer border border-transparent hover:border-[var(--border-color)]"
                >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Swap</span>
                </button>
            </div>

            {/* Right Controls: View Modes, Options, Copy & Language */}
            <div className="flex items-center gap-1.5">
                {/* View Mode Toggle: Side-by-Side vs Inline */}
                <div className="flex items-center border border-[var(--border-color)] rounded bg-[var(--bg-primary)] p-0.5">
                    <button
                        type="button"
                        onClick={onToggleSideBySide}
                        title={isSideBySide ? 'Side-by-side mode active' : 'Switch to Side-by-side split'}
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] transition-colors cursor-pointer ${
                            isSideBySide
                                ? 'bg-[var(--bg-secondary)] text-[var(--accent-color)] font-medium'
                                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                        }`}
                    >
                        <Columns2 className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">Split</span>
                    </button>
                    <button
                        type="button"
                        onClick={onToggleSideBySide}
                        title={!isSideBySide ? 'Inline unified mode active' : 'Switch to Inline Unified Diff'}
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] transition-colors cursor-pointer ${
                            !isSideBySide
                                ? 'bg-[var(--bg-secondary)] text-[var(--accent-color)] font-medium'
                                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                        }`}
                    >
                        <Rows2 className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">Inline</span>
                    </button>
                </div>

                {/* Hide / Collapse Unchanged Regions */}
                <button
                    type="button"
                    onClick={onToggleHideUnchanged}
                    title={isHideUnchanged ? 'Expand all unchanged lines' : 'Collapse unchanged regions (Show diff context only)'}
                    className={`flex items-center gap-1 px-1.5 py-1 rounded text-[11px] transition-colors cursor-pointer border ${
                        isHideUnchanged
                            ? 'text-[var(--accent-color)] bg-[var(--bg-primary)] border-[var(--border-color)] font-medium'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] border-transparent hover:border-[var(--border-color)]'
                    }`}
                >
                    {isHideUnchanged ? <FoldVertical className="w-3.5 h-3.5" /> : <UnfoldVertical className="w-3.5 h-3.5" />}
                    <span className="hidden lg:inline">{isHideUnchanged ? 'Collapsed' : 'Full'}</span>
                </button>

                {/* Ignore Trim Whitespace */}
                <button
                    type="button"
                    onClick={onToggleIgnoreWhitespace}
                    title={isIgnoreWhitespace ? 'Whitespace changes ignored' : 'Include whitespace differences'}
                    className={`flex items-center gap-1 px-1.5 py-1 rounded text-[11px] transition-colors cursor-pointer border ${
                        isIgnoreWhitespace
                            ? 'text-[var(--accent-color)] bg-[var(--bg-primary)] border-[var(--border-color)] font-medium'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] border-transparent hover:border-[var(--border-color)]'
                    }`}
                >
                    <Space className="w-3.5 h-3.5" />
                    <span className="hidden xl:inline">Ignore Space</span>
                </button>

                {/* Original Editable Toggle */}
                <button
                    type="button"
                    onClick={onToggleOriginalEditable}
                    title={isOriginalEditable ? 'Original pane is editable' : 'Original pane is locked / read-only'}
                    className={`flex items-center gap-1 px-1.5 py-1 rounded text-[11px] transition-colors cursor-pointer border ${
                        isOriginalEditable
                            ? 'text-amber-500 bg-[var(--bg-primary)] border-[var(--border-color)] font-medium'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] border-transparent hover:border-[var(--border-color)]'
                    }`}
                >
                    {isOriginalEditable ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                    <span className="hidden xl:inline">{isOriginalEditable ? 'Original Editable' : 'Original Locked'}</span>
                </button>

                {/* Copy Actions */}
                <div className="flex items-center border border-[var(--border-color)] rounded bg-[var(--bg-primary)] px-0.5">
                    <button
                        type="button"
                        onClick={() => handleCopy('modified')}
                        title="Copy Modified code"
                        className="px-1.5 py-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer flex items-center gap-1"
                    >
                        {copiedTarget === 'modified' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        <span className="hidden sm:inline">Copy</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleCopy('patch')}
                        title="Copy Unified Diff Patch"
                        className="px-1.5 py-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer border-l border-[var(--border-color)] hidden md:inline"
                    >
                        {copiedTarget === 'patch' ? 'Patch Copied!' : 'Patch'}
                    </button>
                </div>

                {/* Language Selector */}
                {allowLanguageChange && (
                    <select
                        value={language}
                        onChange={(e) => onLanguageChange && onLanguageChange(e.target.value as CodeEditorLanguage)}
                        aria-label="Select Programming Language"
                        className="bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] rounded px-1.5 py-1 text-[11px] outline-none cursor-pointer hover:border-[var(--accent-color)] transition-colors"
                    >
                        {DEFAULT_MONACO_LANGUAGES.map((lang) => (
                            <option key={lang.value} value={lang.value}>
                                {lang.label}
                            </option>
                        ))}
                    </select>
                )}

                {/* Fullscreen Button */}
                <button
                    type="button"
                    onClick={onToggleFullscreen}
                    title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                    className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors cursor-pointer border border-transparent hover:border-[var(--border-color)]"
                >
                    {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>

                {extraToolbarActions}
            </div>
        </div>
    );
};

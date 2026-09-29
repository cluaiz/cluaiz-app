import React from 'react';

interface StatusBarProps {
    cursorLine: number;
    cursorColumn: number;
    selectedCount: number;
    lineCount: number;
    charCount: number;
    tabSize: number;
    onToggleTabSize: () => void;
    language: string;
    isWordWrap: boolean;
    onToggleWordWrap: () => void;
    isWhitespace: boolean;
    onToggleWhitespace: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
    cursorLine,
    cursorColumn,
    selectedCount,
    lineCount,
    charCount,
    tabSize,
    onToggleTabSize,
    language,
    isWordWrap,
    onToggleWordWrap,
    isWhitespace,
    onToggleWhitespace
}) => {
    return (
        <div className="flex items-center justify-between px-3 py-1 bg-[var(--bg-tertiary)] border-t border-[var(--border-color)] text-[11px] font-mono text-[var(--text-muted)] select-none">
            {/* Left: Position & Selection */}
            <div className="flex items-center gap-3">
                <span className="hover:text-[var(--text-primary)] transition-colors cursor-default">
                    Ln {cursorLine}, Col {cursorColumn}
                    {selectedCount > 0 && (
                        <span className="text-[var(--accent-color)] ml-1 font-semibold">
                            ({selectedCount} sel)
                        </span>
                    )}
                </span>

                <span className="hidden sm:inline-block opacity-40">|</span>

                <span className="hidden sm:inline-block">
                    {lineCount} {lineCount === 1 ? 'line' : 'lines'} · {charCount} chars
                </span>
            </div>

            {/* Right: Quick Settings & Meta */}
            <div className="flex items-center gap-3">
                {/* Tab Size Switcher */}
                <button
                    type="button"
                    onClick={onToggleTabSize}
                    title="Click to switch tab size (2 or 4 spaces)"
                    className="hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                >
                    Spaces: {tabSize}
                </button>

                {/* Whitespace Indicator / Toggle */}
                <button
                    type="button"
                    onClick={onToggleWhitespace}
                    title={isWhitespace ? 'Hide whitespace dots' : 'Show whitespace dots'}
                    className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                        isWhitespace ? 'text-[var(--accent-color)] font-bold' : 'hover:text-[var(--text-primary)]'
                    }`}
                >
                    WS
                </button>

                {/* Word Wrap Indicator */}
                <button
                    type="button"
                    onClick={onToggleWordWrap}
                    title="Toggle Word Wrap (Alt+Z)"
                    className={`hidden md:inline-block px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                        isWordWrap ? 'text-[var(--accent-color)] font-bold' : 'hover:text-[var(--text-primary)]'
                    }`}
                >
                    Wrap
                </button>

                <span className="hidden md:inline-block">UTF-8</span>

                {/* Language Pill */}
                <span className="font-semibold text-[var(--text-primary)] uppercase bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded border border-[var(--border-color)]">
                    {language}
                </span>
            </div>
        </div>
    );
};

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { DiffEditor as MonacoDiffEditorReact, DiffOnMount, DiffBeforeMount } from '@monaco-editor/react';
import { useThemeStore } from '../../../store/ui/useThemeStore';
import { DiffEditorProps, CodeEditorLanguage, DiffStats } from './types';
import { DiffToolbar } from './DiffToolbar';
import { normalizeLanguage } from './languages';
import { defineCluaizThemes, registerCelLanguage, getMonacoThemeName } from './monacoSetup';

export const DiffEditor: React.FC<DiffEditorProps> = ({
    original,
    modified,
    onOriginalChange,
    onModifiedChange,
    language = 'json',
    originalLanguage,
    modifiedLanguage,
    readOnly = false,
    originalEditable = false,
    height = '100%',
    minHeight = 300,
    className = '',
    showToolbar = true,
    initialRenderSideBySide = true,
    allowLanguageChange = true,
    onLanguageChange,
    onMount: userOnMount,
    extraToolbarActions
}) => {
    const { theme, darkAccent, lightAccent } = useThemeStore();
    const isDark = theme !== 'light';
    const accentColor = isDark ? darkAccent : lightAccent;

    const diffEditorRef = useRef<any>(null);
    const monacoRef = useRef<any>(null);

    // Interactive Mode Toggles
    const [isSideBySide, setIsSideBySide] = useState<boolean>(initialRenderSideBySide);
    const [isHideUnchanged, setIsHideUnchanged] = useState<boolean>(false);
    const [isIgnoreWhitespace, setIsIgnoreWhitespace] = useState<boolean>(false);
    const [isOriginalEditable, setIsOriginalEditable] = useState<boolean>(originalEditable);
    const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

    // Language & Content States
    const [currentLanguage, setCurrentLanguage] = useState<CodeEditorLanguage>(language);
    const [activeOriginal, setActiveOriginal] = useState<string>(original);
    const [activeModified, setActiveModified] = useState<string>(modified);

    // Diff Telemetry & Statistics
    const [currentDiffIndex, setCurrentDiffIndex] = useState<number>(0);
    const [totalDiffs, setTotalDiffs] = useState<number>(0);
    const [diffStats, setDiffStats] = useState<DiffStats>({ additions: 0, deletions: 0, changes: 0 });
    const [originalLineCount, setOriginalLineCount] = useState<number>(1);
    const [modifiedLineCount, setModifiedLineCount] = useState<number>(1);

    // Keep internal values synchronized with external props
    useEffect(() => {
        setActiveOriginal(original);
    }, [original]);

    useEffect(() => {
        setActiveModified(modified);
    }, [modified]);

    useEffect(() => {
        if (language) setCurrentLanguage(language);
    }, [language]);


    const monacoOriginalLang = useMemo(() => {
        return normalizeLanguage(originalLanguage || currentLanguage);
    }, [originalLanguage, currentLanguage]);

    const monacoModifiedLang = useMemo(() => {
        return normalizeLanguage(modifiedLanguage || currentLanguage);
    }, [modifiedLanguage, currentLanguage]);

    const activeMonacoTheme = getMonacoThemeName(theme);

    // Dynamic real-time theme synchronization
    useEffect(() => {
        if (monacoRef.current?.editor) {
            defineCluaizThemes(monacoRef.current, accentColor);
            monacoRef.current.editor.setTheme(activeMonacoTheme);
        }
    }, [theme, accentColor, activeMonacoTheme]);

    // Compute Line & Diff Statistics directly from Monaco Diff Editor
    const computeDiffMetrics = useCallback((editor: any) => {
        if (!editor) return;

        try {
            const lineChanges = editor.getLineChanges() || [];
            let additions = 0;
            let deletions = 0;

            for (const change of lineChanges) {
                const origCount = change.originalEndLineNumber === 0 
                    ? 0 
                    : (change.originalEndLineNumber - change.originalStartLineNumber + 1);
                const modCount = change.modifiedEndLineNumber === 0 
                    ? 0 
                    : (change.modifiedEndLineNumber - change.modifiedStartLineNumber + 1);

                if (origCount === 0 && modCount > 0) {
                    additions += modCount;
                } else if (modCount === 0 && origCount > 0) {
                    deletions += origCount;
                } else {
                    deletions += origCount;
                    additions += modCount;
                }
            }

            setDiffStats({
                additions,
                deletions,
                changes: lineChanges.length
            });
            setTotalDiffs(lineChanges.length);
            if (lineChanges.length > 0) {
                setCurrentDiffIndex((prev) => (prev === 0 ? 1 : Math.min(prev, lineChanges.length)));
            } else {
                setCurrentDiffIndex(0);
            }

            const origModel = editor.getOriginalEditor()?.getModel();
            const modModel = editor.getModifiedEditor()?.getModel();
            if (origModel) setOriginalLineCount(origModel.getLineCount());
            if (modModel) setModifiedLineCount(modModel.getLineCount());
        } catch {
            // Guard against disposed models
        }
    }, []);

    const handleBeforeMount: DiffBeforeMount = useCallback((monaco) => {
        registerCelLanguage(monaco);
        defineCluaizThemes(monaco, accentColor);
    }, [accentColor]);

    const handleOnMount: DiffOnMount = useCallback((editor, monaco) => {
        diffEditorRef.current = editor;
        monacoRef.current = monaco;

        defineCluaizThemes(monaco, accentColor);

        // Listen for diff calculation updates
        const diffUpdateListener = editor.onDidUpdateDiff(() => {
            computeDiffMetrics(editor);
        });

        // Listen for modified editor text changes
        const modifiedEditor = editor.getModifiedEditor();
        const modifiedChangeListener = modifiedEditor.onDidChangeModelContent(() => {
            const val = modifiedEditor.getValue();
            setActiveModified(val);
            if (onModifiedChange) onModifiedChange(val);
            computeDiffMetrics(editor);
        });

        // Listen for original editor text changes
        const originalEditor = editor.getOriginalEditor();
        const originalChangeListener = originalEditor.onDidChangeModelContent(() => {
            const val = originalEditor.getValue();
            setActiveOriginal(val);
            if (onOriginalChange) onOriginalChange(val);
            computeDiffMetrics(editor);
        });

        // Initial compute
        setTimeout(() => {
            computeDiffMetrics(editor);
        }, 150);

        if (userOnMount) {
            userOnMount(editor, monaco);
        }

        return () => {
            diffUpdateListener.dispose();
            modifiedChangeListener.dispose();
            originalChangeListener.dispose();
        };
    }, [accentColor, computeDiffMetrics, onModifiedChange, onOriginalChange, userOnMount]);

    // Re-apply custom themes when accent color or dark mode changes
    useEffect(() => {
        if (monacoRef.current) {
            defineCluaizThemes(monacoRef.current, accentColor);
            monacoRef.current.editor.setTheme(activeMonacoTheme);
        }
    }, [accentColor, activeMonacoTheme]);

    // Navigation handlers
    const handleNextDiff = useCallback(() => {
        if (!diffEditorRef.current) return;
        diffEditorRef.current.goToDiff('next');
        setCurrentDiffIndex((prev) => (totalDiffs > 0 ? (prev % totalDiffs) + 1 : 0));
    }, [totalDiffs]);

    const handlePrevDiff = useCallback(() => {
        if (!diffEditorRef.current) return;
        diffEditorRef.current.goToDiff('previous');
        setCurrentDiffIndex((prev) => (totalDiffs > 0 ? (prev <= 1 ? totalDiffs : prev - 1) : 0));
    }, [totalDiffs]);

    // Swap Original and Modified contents
    const handleSwap = useCallback(() => {
        const temp = activeOriginal;
        setActiveOriginal(activeModified);
        setActiveModified(temp);

        if (onOriginalChange) onOriginalChange(activeModified);
        if (onModifiedChange) onModifiedChange(temp);

        if (diffEditorRef.current) {
            diffEditorRef.current.getOriginalEditor()?.setValue(activeModified);
            diffEditorRef.current.getModifiedEditor()?.setValue(temp);
        }
    }, [activeOriginal, activeModified, onOriginalChange, onModifiedChange]);

    // Copy actions
    const handleCopyModified = useCallback(() => {
        navigator.clipboard.writeText(activeModified);
    }, [activeModified]);

    const handleCopyOriginal = useCallback(() => {
        navigator.clipboard.writeText(activeOriginal);
    }, [activeOriginal]);

    const handleCopyPatch = useCallback(() => {
        const header = `--- Original (${monacoOriginalLang})\n+++ Modified (${monacoModifiedLang})\n`;
        const diffBody = `@@ -1,${originalLineCount} +1,${modifiedLineCount} @@\n`;
        const summary = `# Changes: ${diffStats.changes} | Additions: +${diffStats.additions} | Deletions: -${diffStats.deletions}\n`;
        const patch = `${header}${summary}${diffBody}# Modified preview:\n${activeModified}`;
        navigator.clipboard.writeText(patch);
    }, [monacoOriginalLang, monacoModifiedLang, originalLineCount, modifiedLineCount, diffStats, activeModified]);

    // Language change
    const handleLanguageChange = (newLang: CodeEditorLanguage) => {
        setCurrentLanguage(newLang);
        if (onLanguageChange) onLanguageChange(newLang);
    };

    return (
        <div
            className={`flex flex-col bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg overflow-hidden transition-all duration-200 ${
                isFullscreen
                    ? 'fixed inset-0 z-50 rounded-none w-screen h-screen'
                    : 'w-full h-full'
            } ${className}`}
            style={{ minHeight: isFullscreen ? '100vh' : minHeight }}
        >
            {/* Top Diff Navigation & View Control Toolbar */}
            {showToolbar && (
                <DiffToolbar
                    diffStats={diffStats}
                    currentDiffIndex={currentDiffIndex}
                    totalDiffs={totalDiffs}
                    isSideBySide={isSideBySide}
                    onToggleSideBySide={() => setIsSideBySide((prev) => !prev)}
                    isHideUnchanged={isHideUnchanged}
                    onToggleHideUnchanged={() => setIsHideUnchanged((prev) => !prev)}
                    isIgnoreWhitespace={isIgnoreWhitespace}
                    onToggleIgnoreWhitespace={() => setIsIgnoreWhitespace((prev) => !prev)}
                    isOriginalEditable={isOriginalEditable}
                    onToggleOriginalEditable={() => setIsOriginalEditable((prev) => !prev)}
                    onNextDiff={handleNextDiff}
                    onPrevDiff={handlePrevDiff}
                    onSwap={handleSwap}
                    onCopyModified={handleCopyModified}
                    onCopyOriginal={handleCopyOriginal}
                    onCopyPatch={handleCopyPatch}
                    language={currentLanguage}
                    allowLanguageChange={allowLanguageChange}
                    onLanguageChange={handleLanguageChange}
                    isFullscreen={isFullscreen}
                    onToggleFullscreen={() => setIsFullscreen((prev) => !prev)}
                    extraToolbarActions={extraToolbarActions}
                />
            )}

            {/* Monaco Diff Editor Surface */}
            <div className="flex-1 w-full h-full min-h-0 relative bg-[var(--bg-primary)]">
                <MonacoDiffEditorReact
                    height={height}
                    original={activeOriginal}
                    modified={activeModified}
                    language={monacoModifiedLang}
                    originalLanguage={monacoOriginalLang}
                    modifiedLanguage={monacoModifiedLang}
                    theme={activeMonacoTheme}
                    beforeMount={handleBeforeMount}
                    onMount={handleOnMount}
                    options={{
                        readOnly,
                        originalEditable: isOriginalEditable,

                        // View mode (Side-by-side split vs Unified inline)
                        renderSideBySide: isSideBySide,
                        enableSplitViewResizing: true,
                        splitViewDefaultRatio: 0.5,
                        useInlineViewWhenSpaceIsLimited: true,

                        // Hide/collapse identical code sections
                        hideUnchangedRegions: {
                            enabled: isHideUnchanged,
                            minimumLineCount: 3,
                            revealLineCount: 20,
                            contextLineCount: 3
                        },

                        // Gutter revert arrows and +/- indicators
                        renderMarginRevertIcon: !readOnly,
                        renderIndicators: true,
                        renderGutterMenu: true,

                        // Advanced Myers diffing & Move Detection
                        diffAlgorithm: 'advanced',
                        experimental: {
                            showMoves: true
                        },

                        // Whitespace handling
                        ignoreTrimWhitespace: isIgnoreWhitespace,

                        // Overview ruler with colorized diff highlights
                        renderOverviewRuler: true,
                        diffWordWrap: 'inherit',

                        // Layout & Smooth scrolling
                        automaticLayout: true,
                        smoothScrolling: true,
                        mouseWheelZoom: true,
                        cursorBlinking: 'smooth',

                        // Typography & Font Ligatures
                        fontSize: 13,
                        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, Menlo, monospace",
                        fontLigatures: true,
                        letterSpacing: 0.5,

                        // Scrollbar styling
                        scrollbar: {
                            vertical: 'visible',
                            horizontal: 'visible',
                            verticalScrollbarSize: 9,
                            horizontalScrollbarSize: 9,
                            useShadows: true,
                            alwaysConsumeMouseWheel: false
                        }
                    }}
                />
            </div>

            {/* Bottom Status Bar for Diff Overview */}
            <div className="flex items-center justify-between px-3 py-1 bg-[var(--bg-secondary)] border-t border-[var(--border-color)] text-[11px] text-[var(--text-muted)] select-none">
                <div className="flex items-center gap-3">
                    <span className="font-mono">
                        Original: {originalLineCount} lines
                    </span>
                    <span>|</span>
                    <span className="font-mono">
                        Modified: {modifiedLineCount} lines
                    </span>
                    <span>|</span>
                    <span className="font-medium text-[var(--text-primary)]">
                        {isSideBySide ? 'Side-by-Side Split' : 'Inline Unified'}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <span>
                        {totalDiffs > 0 ? `${totalDiffs} differences found` : 'Files are identical'}
                    </span>
                    <span>|</span>
                    <span className="uppercase font-mono">
                        {currentLanguage}
                    </span>
                    <span>|</span>
                    <span>UTF-8</span>
                </div>
            </div>
        </div>
    );
};

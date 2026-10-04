import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import Editor, { OnMount, BeforeMount } from '@monaco-editor/react';
import { useThemeStore } from '../../../store/ui/useThemeStore';
import { CodeEditorProps, CodeEditorLanguage } from './types';
import { normalizeLanguage, getMonacoLanguagesWithCategories, DEFAULT_MONACO_LANGUAGES } from './languages';
import { setupMonacoEnvironment, getMonacoThemeName, defineCluaizThemes } from './monacoSetup';
import { ErrorDiagnosticsPopover, ErrorMarker } from './ErrorDiagnosticsPopover';
import { StatusBar } from './StatusBar';
import { 
    Check, 
    Copy, 
    AlignLeft, 
    WrapText, 
    AlertCircle, 
    CheckCircle2, 
    ChevronDown, 
    ChevronUp,
    Search,
    Maximize2,
    Minimize2,
    Trash2,
    ZoomIn,
    ZoomOut,
    Terminal,
    Eye,
    FolderMinus,
    FolderPlus
} from 'lucide-react';

export const CodeEditor: React.FC<CodeEditorProps> = ({
    value,
    onChange,
    language = 'json',
    readOnly = false,
    height = '100%',
    minHeight = 240,
    className = '',
    showLineNumbers = true,
    showMinimap = false,
    showToolbar = true,
    allowLanguageChange = true,
    onLanguageChange,
    onMount: userOnMount,
    extraToolbarActions,
    disableNativeContextMenu = false,
    onContextMenu
}) => {
    const { theme, darkAccent, lightAccent } = useThemeStore();
    const isDark = theme !== 'light';
    const accentColor = isDark ? darkAccent : lightAccent;

    const editorRef = useRef<any>(null);
    const monacoRef = useRef<any>(null);

    // Visual & State Toggles
    const [isWordWrap, setIsWordWrap] = useState<boolean>(true);
    const [isMinimapEnabled, setIsMinimapEnabled] = useState<boolean>(showMinimap);
    const [isLineNumbersEnabled, setIsLineNumbersEnabled] = useState<boolean>(showLineNumbers);
    const [isWhitespaceEnabled, setIsWhitespaceEnabled] = useState<boolean>(false);
    const [tabSize, setTabSize] = useState<number>(2);
    const [fontSize, setFontSize] = useState<number>(13);
    const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
    const [copied, setCopied] = useState<boolean>(false);

    // Diagnostics & Cursor Position States
    const [markers, setMarkers] = useState<ErrorMarker[]>([]);
    const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState<boolean>(false);
    const [cursorPosition, setCursorPosition] = useState<{ line: number; column: number }>({ line: 1, column: 1 });
    const [selectedLength, setSelectedLength] = useState<number>(0);

    // Language States
    const [currentLanguage, setCurrentLanguage] = useState<CodeEditorLanguage>(language);
    const [langDropdownOpen, setLangDropdownOpen] = useState<boolean>(false);
    const [langSearch, setLangSearch] = useState<string>('');
    const [monacoLanguagesList, setMonacoLanguagesList] = useState(DEFAULT_MONACO_LANGUAGES);

    useEffect(() => {
        setCurrentLanguage(language);
    }, [language]);

    // Keyboard shortcuts listener
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isFullscreen) {
                setIsFullscreen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isFullscreen]);

    // Handle Before Mount (Themes, CEL Tokenizer, & Dynamic Language Sync)
    const handleBeforeMount: BeforeMount = (monaco) => {
        monacoRef.current = monaco;
        setupMonacoEnvironment(monaco, accentColor);
        setMonacoLanguagesList(getMonacoLanguagesWithCategories(monaco));
    };

    // Editor onMount Hook
    const handleOnMount: OnMount = (editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;

        // Sync markers / syntax errors
        const updateMarkers = () => {
            const model = editor.getModel();
            if (model) {
                const currentMarkers = monaco.editor.getModelMarkers({ resource: model.uri });
                const errorMarkers = currentMarkers
                    .filter((m: any) => m.severity === monaco.MarkerSeverity.Error)
                    .map((m: any) => ({
                        message: m.message,
                        startLineNumber: m.startLineNumber,
                        startColumn: m.startColumn,
                        endLineNumber: m.endLineNumber,
                        endColumn: m.endColumn,
                        severity: m.severity
                    }));
                setMarkers(errorMarkers);
            }
        };

        const disposableMarkers = monaco.editor.onDidChangeMarkers(() => {
            updateMarkers();
        });

        // Listen for cursor position changes
        const disposableCursor = editor.onDidChangeCursorPosition((e) => {
            setCursorPosition({
                line: e.position.lineNumber,
                column: e.position.column
            });
        });

        // Listen for selection changes
        const disposableSelection = editor.onDidChangeCursorSelection((e) => {
            const model = editor.getModel();
            if (model) {
                const text = model.getValueInRange(e.selection);
                setSelectedLength(text.length);
            }
        });

        // Custom Right-Click Context Menu Listener
        let disposableContextMenu: any = null;
        if (onContextMenu) {
            disposableContextMenu = editor.onContextMenu((e: any) => {
                if (e.event?.browserEvent) {
                    e.event.browserEvent.preventDefault();
                    e.event.browserEvent.stopPropagation();
                    onContextMenu({
                        x: e.event.browserEvent.clientX,
                        y: e.event.browserEvent.clientY,
                        editor,
                        monaco
                    });
                }
            });
        }

        editor.onDidDispose(() => {
            disposableMarkers.dispose();
            disposableCursor.dispose();
            disposableSelection.dispose();
            if (disposableContextMenu) {
                disposableContextMenu.dispose();
            }
        });

        if (userOnMount) {
            userOnMount(editor, monaco);
        }
    };

    // Error Jump Handlers
    const jumpToMarker = useCallback((marker: ErrorMarker) => {
        if (!editorRef.current) return;
        editorRef.current.revealLineInCenter(marker.startLineNumber);
        editorRef.current.setPosition({
            lineNumber: marker.startLineNumber,
            column: marker.startColumn
        });
        editorRef.current.focus();
    }, []);

    const handleNextError = useCallback(() => {
        if (!editorRef.current) return;
        const action = editorRef.current.getAction('editor.action.marker.next');
        if (action) {
            action.run();
        } else if (markers.length > 0) {
            const currentLine = cursorPosition.line;
            const next = markers.find((m) => m.startLineNumber > currentLine) || markers[0];
            jumpToMarker(next);
        }
    }, [markers, cursorPosition, jumpToMarker]);

    const handlePrevError = useCallback(() => {
        if (!editorRef.current) return;
        const action = editorRef.current.getAction('editor.action.marker.prev');
        if (action) {
            action.run();
        } else if (markers.length > 0) {
            const currentLine = cursorPosition.line;
            const reversed = [...markers].reverse();
            const prev = reversed.find((m) => m.startLineNumber < currentLine) || markers[markers.length - 1];
            jumpToMarker(prev);
        }
    }, [markers, cursorPosition, jumpToMarker]);

    // Format Document Action
    const handleFormat = useCallback(() => {
        if (!editorRef.current) return;
        const normalized = normalizeLanguage(currentLanguage);

        if (normalized === 'json') {
            try {
                const parsed = JSON.parse(value);
                const pretty = JSON.stringify(parsed, null, tabSize);
                if (onChange) onChange(pretty);
                return;
            } catch {
                // If invalid JSON, fall through to Monaco format
            }
        }

        const formatAction = editorRef.current.getAction('editor.action.formatDocument');
        if (formatAction) formatAction.run();
    }, [currentLanguage, value, onChange, tabSize]);

    // Actions
    const handleFind = () => editorRef.current?.getAction('actions.find')?.run();
    const handleCommandPalette = () => editorRef.current?.trigger('toolbar', 'editor.action.quickCommand', null);
    const handleFoldAll = () => editorRef.current?.trigger('toolbar', 'editor.foldAll', null);
    const handleUnfoldAll = () => editorRef.current?.trigger('toolbar', 'editor.unfoldAll', null);

    const handleClear = () => {
        if (readOnly || !onChange) return;
        if (value && window.confirm('Clear all code in editor?')) {
            onChange('');
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(value || '');
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
    };

    // Toggles
    const toggleWordWrap = () => setIsWordWrap((prev) => !prev);
    const toggleMinimap = () => setIsMinimapEnabled((prev) => !prev);
    const toggleWhitespace = () => setIsWhitespaceEnabled((prev) => !prev);
    const toggleTabSize = () => setTabSize((prev) => (prev === 2 ? 4 : 2));
    const handleZoomIn = () => setFontSize((prev) => Math.min(prev + 1, 24));
    const handleZoomOut = () => setFontSize((prev) => Math.max(prev - 1, 10));

    const monacoLang = normalizeLanguage(currentLanguage);
    const activeMonacoTheme = getMonacoThemeName(theme);

    // Dynamic real-time theme synchronization
    useEffect(() => {
        if (monacoRef.current?.editor) {
            defineCluaizThemes(monacoRef.current, accentColor);
            monacoRef.current.editor.setTheme(activeMonacoTheme);
        }
    }, [theme, accentColor, activeMonacoTheme]);

    const filteredLanguages = useMemo(() => {
        const query = langSearch.toLowerCase().trim();
        if (!query) return monacoLanguagesList;
        return monacoLanguagesList.filter((item) => 
            item.label.toLowerCase().includes(query) ||
            item.value.toLowerCase().includes(query) ||
            (item.category && item.category.toLowerCase().includes(query))
        );
    }, [langSearch, monacoLanguagesList]);

    const lineCount = value ? value.split('\n').length : 0;
    const charCount = value ? value.length : 0;

    return (
        <div 
            className={
                isFullscreen 
                    ? `fixed inset-0 z-[9999] flex flex-col w-screen h-screen bg-[var(--bg-primary)] shadow-2xl`
                    : `flex flex-col w-full h-full border border-[var(--border-color)] rounded-lg overflow-hidden bg-[var(--bg-primary)] shadow-sm ${className}`
            }
            style={isFullscreen ? undefined : { minHeight }}
        >
            {/* Top Toolbar */}
            {showToolbar && (
                <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] select-none text-xs flex-wrap gap-2">
                    {/* Left: Language Selector & Diagnostics Badge */}
                    <div className="flex items-center gap-2 relative">
                        {allowLanguageChange ? (
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                                    className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--accent-color)] font-mono font-semibold uppercase text-[11px] hover:border-[var(--accent-color)] transition-colors cursor-pointer"
                                    title={`Current Language: ${monacoLang} (Click to switch among ${monacoLanguagesList.length}+ languages)`}
                                >
                                    <span>{monacoLang}</span>
                                    <ChevronDown className="w-3 h-3 opacity-60" />
                                </button>

                                {langDropdownOpen && (
                                    <>
                                        <div 
                                            className="fixed inset-0 z-40" 
                                            onClick={() => {
                                                setLangDropdownOpen(false);
                                                setLangSearch('');
                                            }} 
                                        />
                                        <div className="absolute left-0 mt-1 w-64 max-h-80 overflow-hidden rounded-lg shadow-2xl bg-[var(--bg-primary)] border border-[var(--border-color)] py-1 z-50 flex flex-col">
                                            <div className="p-2 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
                                                <input
                                                    type="text"
                                                    value={langSearch}
                                                    onChange={(e) => setLangSearch(e.target.value)}
                                                    placeholder={`Search ${monacoLanguagesList.length}+ languages...`}
                                                    className="w-full px-2 py-1 text-xs rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-color)] font-mono"
                                                    autoFocus
                                                />
                                            </div>

                                            <div className="overflow-y-auto max-h-60 custom-scrollbar p-1">
                                                {filteredLanguages.length > 0 ? (
                                                    filteredLanguages.map((item) => (
                                                        <button
                                                            key={item.value}
                                                            type="button"
                                                            onClick={() => {
                                                                setCurrentLanguage(item.value);
                                                                setLangDropdownOpen(false);
                                                                setLangSearch('');
                                                                if (onLanguageChange) onLanguageChange(item.value);
                                                            }}
                                                            className={`w-full text-left px-2.5 py-1.5 text-xs font-mono rounded transition-colors cursor-pointer flex items-center justify-between ${
                                                                monacoLang === item.value
                                                                    ? 'text-[var(--accent-color)] bg-[var(--bg-secondary)] font-bold'
                                                                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.04]'
                                                            }`}
                                                        >
                                                            <div className="flex flex-col">
                                                                <span>{item.label}</span>
                                                                <span className="text-[9px] text-[var(--text-muted)] opacity-60 font-sans">{item.category}</span>
                                                            </div>
                                                            {monacoLang === item.value && (
                                                                <Check className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                                                            )}
                                                        </button>
                                                    ))
                                                ) : (
                                                    <div className="px-3 py-4 text-[11px] text-[var(--text-muted)] text-center font-mono">
                                                        No languages matching "{langSearch}"
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : (
                            <span className="px-2 py-0.5 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--accent-color)] font-mono font-semibold uppercase text-[11px]">
                                {monacoLang}
                            </span>
                        )}

                        {/* Interactive Error Diagnostics Badge & Navigation */}
                        <div className="relative flex items-center">
                            {markers.length > 0 ? (
                                <div className="flex items-center rounded overflow-hidden border border-red-500/30 bg-red-500/10 text-red-400">
                                    <button
                                        type="button"
                                        onClick={() => setIsDiagnosticsOpen(!isDiagnosticsOpen)}
                                        className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium hover:bg-red-500/20 transition-colors cursor-pointer"
                                        title="Click to view all problem details"
                                    >
                                        <AlertCircle className="w-3 h-3 text-red-400" />
                                        <span>{markers.length} {markers.length === 1 ? 'Error' : 'Errors'}</span>
                                    </button>

                                    {/* Quick Next/Prev Jump Buttons */}
                                    <button
                                        type="button"
                                        onClick={handlePrevError}
                                        title="Jump to Previous Error (Shift+F8)"
                                        className="px-1 py-0.5 border-l border-red-500/20 hover:bg-red-500/20 cursor-pointer"
                                    >
                                        <ChevronUp className="w-2.5 h-2.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleNextError}
                                        title="Jump to Next Error (F8)"
                                        className="px-1 py-0.5 border-l border-red-500/20 hover:bg-red-500/20 cursor-pointer"
                                    >
                                        <ChevronDown className="w-2.5 h-2.5" />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setIsDiagnosticsOpen(!isDiagnosticsOpen)}
                                    className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded text-[10px] font-medium opacity-80 cursor-pointer hover:opacity-100"
                                    title="All code syntax is valid"
                                >
                                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                    <span>Valid</span>
                                </button>
                            )}

                            {/* Dropdown Popover with all errors */}
                            <ErrorDiagnosticsPopover
                                markers={markers}
                                isOpen={isDiagnosticsOpen}
                                onClose={() => setIsDiagnosticsOpen(false)}
                                onJumpToMarker={jumpToMarker}
                                onNextError={handleNextError}
                                onPrevError={handlePrevError}
                            />
                        </div>
                    </div>

                    {/* Right: Master Toolbar Actions */}
                    <div className="flex items-center gap-1">
                        {extraToolbarActions}

                        {/* Monaco Command Palette (F1) */}
                        <button
                            type="button"
                            onClick={handleCommandPalette}
                            title="Command Palette (F1) - Run any editor command"
                            className="flex items-center gap-1 px-1.5 py-1 rounded text-[11px] text-[var(--text-muted)] hover:text-[var(--accent-color)] hover:bg-[var(--bg-secondary)] transition-colors cursor-pointer"
                        >
                            <Terminal className="w-3.5 h-3.5" />
                            <span className="hidden xl:inline">F1 Palette</span>
                        </button>

                        {/* Find / Search Button */}
                        <button
                            type="button"
                            onClick={handleFind}
                            title="Find & Replace (Ctrl+F)"
                            className="flex items-center gap-1 px-1.5 py-1 rounded text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors cursor-pointer"
                        >
                            <Search className="w-3.5 h-3.5" />
                            <span className="hidden md:inline">Find</span>
                        </button>

                        {/* Format Document Button */}
                        {!readOnly && (
                            <button
                                type="button"
                                onClick={handleFormat}
                                title="Format / Prettify Code (Shift+Alt+F)"
                                className="flex items-center gap-1 px-1.5 py-1 rounded text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors cursor-pointer"
                            >
                                <AlignLeft className="w-3.5 h-3.5" />
                                <span className="hidden md:inline">Format</span>
                            </button>
                        )}

                        {/* Code Folding Controls */}
                        <div className="hidden lg:flex items-center border border-[var(--border-color)] rounded bg-[var(--bg-primary)] px-0.5">
                            <button
                                type="button"
                                onClick={handleFoldAll}
                                title="Fold All Code Blocks"
                                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                            >
                                <FolderMinus className="w-3 h-3" />
                            </button>
                            <button
                                type="button"
                                onClick={handleUnfoldAll}
                                title="Unfold All Code Blocks"
                                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                            >
                                <FolderPlus className="w-3 h-3" />
                            </button>
                        </div>

                        {/* Minimap Toggle */}
                        <button
                            type="button"
                            onClick={toggleMinimap}
                            title={isMinimapEnabled ? 'Hide Minimap' : 'Show Minimap'}
                            className={`p-1 rounded text-[11px] transition-colors cursor-pointer ${
                                isMinimapEnabled
                                    ? 'text-[var(--accent-color)] bg-[var(--bg-primary)]'
                                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
                            }`}
                        >
                            <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* Word Wrap Toggle */}
                        <button
                            type="button"
                            onClick={toggleWordWrap}
                            title={isWordWrap ? 'Disable Word Wrap' : 'Enable Word Wrap (Alt+Z)'}
                            className={`flex items-center gap-1 px-1.5 py-1 rounded text-[11px] transition-colors cursor-pointer ${
                                isWordWrap
                                    ? 'text-[var(--accent-color)] bg-[var(--bg-primary)] font-medium'
                                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
                            }`}
                        >
                            <WrapText className="w-3.5 h-3.5" />
                            <span className="hidden lg:inline">Wrap</span>
                        </button>

                        {/* Zoom In & Out */}
                        <div className="hidden lg:flex items-center border border-[var(--border-color)] rounded bg-[var(--bg-primary)] px-0.5">
                            <button
                                type="button"
                                onClick={handleZoomOut}
                                title="Zoom Out Text"
                                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                            >
                                <ZoomOut className="w-3 h-3" />
                            </button>
                            <span className="text-[10px] font-mono px-1 text-[var(--text-muted)]">
                                {fontSize}
                            </span>
                            <button
                                type="button"
                                onClick={handleZoomIn}
                                title="Zoom In Text"
                                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                            >
                                <ZoomIn className="w-3 h-3" />
                            </button>
                        </div>

                        {/* Clear Content Button */}
                        {!readOnly && (
                            <button
                                type="button"
                                onClick={handleClear}
                                title="Clear Editor Content"
                                className="flex items-center gap-1 px-1.5 py-1 rounded text-[11px] text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        )}

                        {/* Copy Code Button */}
                        <button
                            type="button"
                            onClick={handleCopy}
                            title="Copy code to clipboard"
                            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors cursor-pointer"
                        >
                            {copied ? (
                                <>
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="text-emerald-400">Copied</span>
                                </>
                            ) : (
                                <>
                                    <Copy className="w-3.5 h-3.5" />
                                    <span className="hidden md:inline">Copy</span>
                                </>
                            )}
                        </button>

                        {/* Fullscreen Toggle */}
                        <button
                            type="button"
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Expand Fullscreen'}
                            className="flex items-center gap-1 px-1.5 py-1 rounded text-[11px] text-[var(--text-muted)] hover:text-[var(--accent-color)] hover:bg-[var(--bg-secondary)] transition-colors cursor-pointer"
                        >
                            {isFullscreen ? (
                                <Minimize2 className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                            ) : (
                                <Maximize2 className="w-3.5 h-3.5" />
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Monaco Editor Container with All Power Features Enabled */}
            <div className="flex-1 w-full h-full min-h-0 relative bg-[var(--bg-primary)]">
                <Editor
                    height={height}
                    language={monacoLang}
                    value={value}
                    theme={activeMonacoTheme}
                    beforeMount={handleBeforeMount}
                    onMount={handleOnMount}
                    onChange={(val) => {
                        if (onChange) onChange(val || '');
                    }}
                    options={{
                        readOnly,

                        // Sticky Scroll: disabled to prevent synchronous AST parsing on scroll
                        stickyScroll: {
                            enabled: false
                        },

                        // Linked Editing (HTML/XML tag rename synchronization)
                        linkedEditing: true,

                        // Lightbulb Quick Fixes & Code Actions
                        lightbulb: {
                            enabled: 'onCode' as any
                        },

                        // Hover inspection tooltips
                        hover: {
                            enabled: 'on',
                            delay: 250
                        },

                        // CodeLens references (disabled for zero scroll measuring overhead)
                        codeLens: false,

                        // Minimap & Overview Ruler
                        minimap: { 
                            enabled: isMinimapEnabled, 
                            renderCharacters: false, 
                            maxColumn: 120, 
                            showSlider: 'always' 
                        },
                        overviewRulerBorder: false,
                        overviewRulerLanes: 1,

                        // Line Numbers, Gutter & Glyphs
                        lineNumbers: isLineNumbersEnabled ? 'on' : 'off',
                        lineNumbersMinChars: 3,
                        glyphMargin: false,
                        lineDecorationsWidth: 6,

                        // Word Wrap & Layout
                        wordWrap: isWordWrap ? 'on' : 'off',
                        scrollBeyondLastLine: false,
                        automaticLayout: true,

                        // Native Fluid 60/120FPS GPU Scrolling (Zero software timer conflict)
                        smoothScrolling: false,
                        fastScrollSensitivity: 5,
                        mouseWheelScrollSensitivity: 1,

                        // Scrollbar styling (Hardware composited, no heavy shadow repaints)
                        scrollbar: {
                            vertical: 'visible',
                            horizontal: 'auto',
                            useShadows: false,
                            verticalScrollbarSize: 10,
                            horizontalScrollbarSize: 10,
                            verticalSliderSize: 6,
                            horizontalSliderSize: 6
                        },

                        // Cursor Caret & Animation
                        cursorBlinking: 'smooth',
                        cursorSmoothCaretAnimation: 'explicit',
                        cursorStyle: 'line',
                        cursorWidth: 2,

                        // Typography & Font Ligatures
                        fontSize,
                        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, Menlo, monospace",
                        fontLigatures: true,
                        letterSpacing: 0.5,

                        // Indentation, Brackets & Visual Guides
                        tabSize,
                        insertSpaces: true,
                        detectIndentation: true,
                        guides: {
                            indentation: true,
                            highlightActiveIndentation: true,
                            bracketPairs: true,
                            bracketPairsHorizontal: true
                        },

                        // Bracket Matching & Colorization
                        matchBrackets: 'always',
                        bracketPairColorization: { enabled: true },

                        // Code Folding
                        folding: true,
                        foldingStrategy: 'auto',
                        showFoldingControls: 'always',
                        unfoldOnClickAfterEndOfLine: true,

                        // Autocomplete, IntelliSense & Smart Suggestions
                        quickSuggestions: {
                            other: true,
                            comments: true,
                            strings: true
                        },
                        quickSuggestionsDelay: 10,
                        suggestOnTriggerCharacters: true,
                        acceptSuggestionOnEnter: 'on',
                        tabCompletion: 'on',
                        wordBasedSuggestions: 'allDocuments',
                        parameterHints: { enabled: true, cycle: true },
                        snippetSuggestions: 'top',
                        suggestSelection: 'first',

                        // Auto-closing & Auto-surround
                        autoClosingBrackets: 'always',
                        autoClosingQuotes: 'always',
                        autoClosingDelete: 'always',
                        autoSurround: 'languageDefined',

                        // Formatting
                        formatOnPaste: true,
                        formatOnType: true,

                        // Native Right-Click Context Menu
                        contextmenu: !disableNativeContextMenu && !onContextMenu,

                        // Multi-Cursor Editing
                        multiCursorModifier: 'alt',

                        // Whitespace & Special Character Rendering
                        renderWhitespace: isWhitespaceEnabled ? 'all' : 'selection',
                        renderLineHighlight: 'all',
                        renderControlCharacters: true,
                        colorDecorators: true,
                        links: true,
                        dragAndDrop: true,

                        // Find & Replace In-Built Engine
                        find: {
                            addExtraSpaceOnTop: false,
                            autoFindInSelection: 'always',
                            seedSearchStringFromSelection: 'always'
                        },

                        // Padding
                        padding: { top: 10, bottom: 10 }
                    }}
                />
            </div>

            {/* Bottom Status Bar Strip */}
            <StatusBar
                cursorLine={cursorPosition.line}
                cursorColumn={cursorPosition.column}
                selectedCount={selectedLength}
                lineCount={lineCount}
                charCount={charCount}
                tabSize={tabSize}
                onToggleTabSize={toggleTabSize}
                language={monacoLang}
                isWordWrap={isWordWrap}
                onToggleWordWrap={toggleWordWrap}
                isWhitespace={isWhitespaceEnabled}
                onToggleWhitespace={toggleWhitespace}
            />
        </div>
    );
};

// Monaco setup: CEL Tokenizer & Dynamic Cluaiz Custom Themes
// Synchronized 1:1 with app themes (dark, light, oled, cyberpunk, matrix, pixel)

import { THEMES } from '../../../config/themes';

export const getMonacoThemeName = (themeKey?: string): string => {
    if (!themeKey || !THEMES[themeKey]) return 'cluaiz-theme-cyberpunk';
    return `cluaiz-theme-${themeKey}`;
};

export const registerCelLanguage = (monaco: any) => {
    if (!monaco?.languages) return;

    // Register CEL (Common Expression Language) syntax tokenizer safely without crashing
    if (!monaco.languages.getLanguages().some((l: any) => l.id === 'cel')) {
        monaco.languages.register({ id: 'cel' });
        monaco.languages.setMonarchTokensProvider('cel', {
            keywords: [
                'true', 'false', 'null', 'in', 'as', 'has', 'all', 'exists', 
                'exists_one', 'map', 'filter', 'size', 'startsWith', 'endsWith', 
                'matches', 'contains'
            ],
            tokenizer: {
                root: [
                    [/[a-zA-Z_]\w*/, {
                        cases: {
                            '@keywords': 'keyword',
                            '@default': 'identifier'
                        }
                    }],
                    { include: '@whitespace' },
                    [/"([^"\\]|\\.)*"/, 'string'],
                    [/'([^'\\]|\\.)*'/, 'string'],
                    [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
                    [/\d+/, 'number'],
                    [/[{}()\[\]]/, '@brackets'],
                    [/[!<>]=?|==|&&|\|\||[?:+\-*/%]/, 'operator']
                ],
                whitespace: [
                    [/[ \t\r\n]+/, 'white'],
                    [/\/\/.*$/, 'comment']
                ]
            }
        });
    }
};

/**
 * Blend an accent hex color with deep dark black for subtle chromatic harmonization.
 * Keeps the editor deeply dark (>98% dark) for maximum text contrast and readability,
 * while subtly reflecting the active theme accent instead of being a flat, disconnected black box.
 */
function blendAccentWithDark(accentHex: string, baseDarkHex: string = '#020306', accentWeight: number = 0.045): string {
    const cleanAccent = (accentHex || '').replace('#', '');
    const cleanBase = (baseDarkHex || '').replace('#', '');
    const rA = parseInt(cleanAccent.substring(0, 2) || '0', 16);
    const gA = parseInt(cleanAccent.substring(2, 4) || '0', 16);
    const bA = parseInt(cleanAccent.substring(4, 6) || '0', 16);

    const rB = parseInt(cleanBase.substring(0, 2) || '0', 16);
    const gB = parseInt(cleanBase.substring(2, 4) || '0', 16);
    const bB = parseInt(cleanBase.substring(4, 6) || '0', 16);

    const r = Math.round(rB * (1 - accentWeight) + rA * accentWeight);
    const g = Math.round(gB * (1 - accentWeight) + gA * accentWeight);
    const b = Math.round(bB * (1 - accentWeight) + bA * accentWeight);

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export const defineCluaizThemes = (monaco: any, accentColor?: string) => {
    if (!monaco?.editor) return;

    // Register a specialized Monaco theme for every theme in THEMES config
    Object.entries(THEMES).forEach(([key, themeObj]) => {
        const props = themeObj.properties;
        const activeAccent = accentColor || props['--accent-color'] || '#6366f1';
        const fg = props['--text-primary'] || '#ffffff';
        const border = props['--border-color'] || '#1f1f1f';
        const cardBg = props['--bg-secondary'] || '#030303';
        const muted = props['--text-muted'] || '#888888';
        const isLightTheme = key === 'light';

        // Deep dark theme calculation: keep it very dark for code contrast, but tinted with active theme accent
        let bg = props['--bg-primary'] || '#000000';
        if (isLightTheme) {
            bg = props['--bg-primary'] || '#fafafa';
        } else if (key === 'oled') {
            bg = '#000000'; // Pure blackout for OLED
        } else if (key === 'pixel') {
            bg = props['--bg-primary'] || '#1c120c';
        } else if (key === 'matrix') {
            bg = blendAccentWithDark('#00ff00', '#000000', 0.05); // Deep matrix terminal dark
        } else {
            // 'dark', 'cyberpunk', etc. - subtle 4.5% accent blend over deep dark #020306
            bg = blendAccentWithDark(activeAccent, '#020306', 0.045);
        }

        const themeName = getMonacoThemeName(key);

        const rules = isLightTheme ? [
            { token: 'comment', foreground: '6a737d', fontStyle: 'italic' },
            { token: 'keyword', foreground: 'd73a49', fontStyle: 'bold' },
            { token: 'string', foreground: '032f62' },
            { token: 'number', foreground: '005cc5' },
            { token: 'type', foreground: '6f42c1' }
        ] : key === 'matrix' ? [
            { token: 'comment', foreground: '007700', fontStyle: 'italic' },
            { token: 'keyword', foreground: '33ff33', fontStyle: 'bold' },
            { token: 'string', foreground: '00ee00' },
            { token: 'number', foreground: '00ff00' },
            { token: 'identifier', foreground: '00ff00' },
            { token: 'type', foreground: '00ff88' },
            { token: 'operator', foreground: '00ff00' }
        ] : key === 'pixel' ? [
            { token: 'comment', foreground: '8c6a51', fontStyle: 'italic' },
            { token: 'keyword', foreground: 'f2a65a', fontStyle: 'bold' },
            { token: 'string', foreground: 'ffd180' },
            { token: 'number', foreground: 'ffab40' },
            { token: 'identifier', foreground: 'fce3b8' },
            { token: 'type', foreground: 'f2a65a' }
        ] : [
            { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
            { token: 'keyword', foreground: key === 'cyberpunk' ? 'ff007f' : 'ff79c6', fontStyle: 'bold' },
            { token: 'string', foreground: key === 'cyberpunk' ? '00f0ff' : 'f1fa8c' },
            { token: 'number', foreground: key === 'cyberpunk' ? 'ffe600' : 'bd93f9' },
            { token: 'identifier', foreground: 'f8f8f2' },
            { token: 'type', foreground: '8be9fd' },
            { token: 'delimiter', foreground: 'f8f8f2' },
            { token: 'operator', foreground: key === 'cyberpunk' ? 'ff007f' : '50fa7b' }
        ];

        monaco.editor.defineTheme(themeName, {
            base: isLightTheme ? 'vs' : 'vs-dark',
            inherit: true,
            rules,
            colors: {
                'editor.background': bg,
                'editor.foreground': fg,
                'editorLineNumber.foreground': muted,
                'editorLineNumber.activeForeground': activeAccent,
                'editorCursor.foreground': activeAccent,
                'editor.lineHighlightBackground': isLightTheme ? '#0000000a' : `${activeAccent}12`,
                'editor.lineHighlightBorder': '#00000000',
                'editor.selectionBackground': isLightTheme ? '#c8e1ff' : `${activeAccent}33`,
                'editor.inactiveSelectionBackground': isLightTheme ? '#e8f0fe' : `${activeAccent}1a`,
                'editorGutter.background': bg,
                'editorIndentGuide.background': isLightTheme ? '#e5e7eb' : '#222222',
                'editorIndentGuide.activeBackground': `${activeAccent}55`,
                'editorBracketMatch.background': `${activeAccent}18`,
                'editorBracketMatch.border': `${activeAccent}66`,
                'editorOverviewRuler.border': '#00000000',
                'editorWidget.background': cardBg,
                'editorWidget.border': border,
                'editorSuggestWidget.background': cardBg,
                'editorSuggestWidget.border': border,
                'editorSuggestWidget.selectedBackground': isLightTheme ? '#c8e1ff' : `${activeAccent}25`
            }
        });
    });

    // Also define backward-compatible alias themes
    monaco.editor.defineTheme('cluaiz-dark-theme', {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
            'editor.background': accentColor ? blendAccentWithDark(accentColor, '#020306', 0.045) : '#04050b',
            'editorGutter.background': accentColor ? blendAccentWithDark(accentColor, '#020306', 0.045) : '#04050b',
            'editor.lineHighlightBackground': accentColor ? `${accentColor}12` : '#ffffff08',
            'editor.lineHighlightBorder': '#00000000'
        }
    });

    monaco.editor.defineTheme('cluaiz-light-theme', {
        base: 'vs',
        inherit: true,
        rules: [],
        colors: {
            'editor.background': '#fafafa',
            'editorGutter.background': '#fafafa',
            'editor.lineHighlightBackground': '#0000000a',
            'editor.lineHighlightBorder': '#00000000'
        }
    });
};

export const setupMonacoEnvironment = (monaco: any, accentColor?: string) => {
    registerCelLanguage(monaco);
    defineCluaizThemes(monaco, accentColor);
};

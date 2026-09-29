// Monaco setup: CEL Tokenizer & Cluaiz Custom Themes
// Kept in a dedicated modular file to prevent UI component bloat

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

export const defineCluaizThemes = (monaco: any, accentColor?: string) => {
    if (!monaco?.editor) return;

    const activeAccent = accentColor || '#58a6ff';

    // Dark Theme
    monaco.editor.defineTheme('cluaiz-dark-theme', {
        base: 'vs-dark',
        inherit: true,
        rules: [
            { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
            { token: 'keyword', foreground: 'ff79c6', fontStyle: 'bold' },
            { token: 'string', foreground: 'f1fa8c' },
            { token: 'number', foreground: 'bd93f9' },
            { token: 'identifier', foreground: 'f8f8f2' },
            { token: 'type', foreground: '8be9fd' },
            { token: 'delimiter', foreground: 'f8f8f2' },
            { token: 'operator', foreground: '50fa7b' }
        ],
        colors: {
            'editor.background': '#0c1017',
            'editor.foreground': '#f0f6fc',
            'editorLineNumber.foreground': '#484f58',
            'editorLineNumber.activeForeground': activeAccent,
            'editorCursor.foreground': activeAccent,
            'editor.selectionBackground': '#1f385c',
            'editor.inactiveSelectionBackground': '#182b45',
            'editorGutter.background': '#0c1017',
            'editorWidget.background': '#161b22',
            'editorWidget.border': '#30363d',
            'editorSuggestWidget.background': '#161b22',
            'editorSuggestWidget.border': '#30363d',
            'editorSuggestWidget.selectedBackground': '#1f385c'
        }
    });

    // Light Theme
    monaco.editor.defineTheme('cluaiz-light-theme', {
        base: 'vs',
        inherit: true,
        rules: [
            { token: 'comment', foreground: '6a737d', fontStyle: 'italic' },
            { token: 'keyword', foreground: 'd73a49', fontStyle: 'bold' },
            { token: 'string', foreground: '032f62' },
            { token: 'number', foreground: '005cc5' },
            { token: 'type', foreground: '6f42c1' }
        ],
        colors: {
            'editor.background': '#f6f8fa',
            'editor.foreground': '#24292e',
            'editorLineNumber.foreground': '#959da5',
            'editorLineNumber.activeForeground': accentColor || '#0366d6',
            'editorCursor.foreground': accentColor || '#0366d6',
            'editor.selectionBackground': '#c8e1ff',
            'editorGutter.background': '#f6f8fa'
        }
    });
};

export const setupMonacoEnvironment = (monaco: any, accentColor?: string) => {
    registerCelLanguage(monaco);
    defineCluaizThemes(monaco, accentColor);
};

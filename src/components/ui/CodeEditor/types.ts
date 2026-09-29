import type { ReactNode } from 'react';

export type CodeEditorLanguage =
    | 'json'
    | 'javascript'
    | 'typescript'
    | 'python'
    | 'rust'
    | 'go'
    | 'c'
    | 'cpp'
    | 'csharp'
    | 'java'
    | 'kotlin'
    | 'php'
    | 'html'
    | 'css'
    | 'scss'
    | 'sql'
    | 'shell'
    | 'dockerfile'
    | 'yaml'
    | 'xml'
    | 'graphql'
    | 'markdown'
    | 'cel'
    | 'toml'
    | 'plaintext'
    | string;

export interface CodeEditorProps {
    value: string;
    onChange?: (value: string) => void;
    language?: CodeEditorLanguage;
    placeholder?: string;
    readOnly?: boolean;
    height?: string | number;
    minHeight?: string | number;
    maxHeight?: string | number;
    className?: string;
    showLineNumbers?: boolean;
    showMinimap?: boolean;
    showToolbar?: boolean;
    allowLanguageChange?: boolean;
    onLanguageChange?: (language: CodeEditorLanguage) => void;
    onMount?: (editor: any, monaco: any) => void;
    extraToolbarActions?: ReactNode;
}

export interface DiffStats {
    additions: number;
    deletions: number;
    changes: number;
}

export interface DiffEditorProps {
    original: string;
    modified: string;
    onOriginalChange?: (value: string) => void;
    onModifiedChange?: (value: string) => void;
    language?: CodeEditorLanguage;
    originalLanguage?: CodeEditorLanguage;
    modifiedLanguage?: CodeEditorLanguage;
    readOnly?: boolean;
    originalEditable?: boolean;
    height?: string | number;
    minHeight?: string | number;
    className?: string;
    showToolbar?: boolean;
    initialRenderSideBySide?: boolean;
    allowLanguageChange?: boolean;
    onLanguageChange?: (language: CodeEditorLanguage) => void;
    onMount?: (diffEditor: any, monaco: any) => void;
    extraToolbarActions?: ReactNode;
}


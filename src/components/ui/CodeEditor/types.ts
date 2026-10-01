import type { ReactNode } from 'react';
import type { SupportedLanguage } from './languages';

export type CodeEditorLanguage = SupportedLanguage;

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
    disableNativeContextMenu?: boolean;
    onContextMenu?: (e: { x: number; y: number; editor: any; monaco: any }) => void;
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


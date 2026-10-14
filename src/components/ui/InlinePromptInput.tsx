import React, { useRef, useState, useImperativeHandle, forwardRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ContextChip } from './ContextChip';
import { extractBaseName } from '../../utils/filePath';

export interface InlineChipData {
    id: string;
    type: 'file' | 'folder' | 'skill';
    name?: string;
    rawPath?: string;
    lineRange?: string;
    icon?: React.ReactNode;
}

export interface ActiveMountedChip {
    id: string;
    data: InlineChipData;
    el: HTMLElement;
}

export interface InlinePromptInputHandle {
    focus: () => void;
    clear: () => void;
    insertChip: (chip: Omit<InlineChipData, 'id'>) => void;
    insertText: (text: string) => void;
    getSerializedContent: () => {
        text: string;
        files: { path: string; lineRange?: string; name: string }[];
        skills: string[];
    };
    isEmpty: () => boolean;
}

export interface InlinePromptInputProps {
    placeholder?: string;
    disabled?: boolean;
    onTextChange?: (text: string) => void;
    onSubmit?: (
        serializedText: string,
        contextData: {
            files: { path: string; lineRange?: string; name: string }[];
            skills: string[];
        }
    ) => void;
    onDropFiles?: (files: FileList | any) => void;
    onPasteLargeText?: (text: string) => boolean;
    className?: string;
    minHeight?: string;
    maxHeight?: string;
}

export const InlinePromptInput = forwardRef<InlinePromptInputHandle, InlinePromptInputProps>(({
    placeholder = 'Ask AI...',
    disabled = false,
    onTextChange,
    onSubmit,
    onDropFiles,
    onPasteLargeText,
    className = '',
    minHeight = '24px',
    maxHeight = '160px'
}, ref) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const [activeChips, setActiveChips] = useState<ActiveMountedChip[]>([]);
    const [isEmpty, setIsEmpty] = useState(true);
    const lastSavedRangeRef = useRef<Range | null>(null);

    // Save caret position inside the editor
    const saveCaretPosition = useCallback(() => {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && editorRef.current) {
            const range = sel.getRangeAt(0);
            if (editorRef.current.contains(range.commonAncestorContainer)) {
                lastSavedRangeRef.current = range.cloneRange();
            }
        }
    }, []);

    // Listen to document selectionchange so any caret change inside editor is saved
    useEffect(() => {
        const handleSelectionChange = () => {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0 && editorRef.current) {
                const range = sel.getRangeAt(0);
                if (editorRef.current.contains(range.commonAncestorContainer)) {
                    lastSavedRangeRef.current = range.cloneRange();
                }
            }
        };
        document.addEventListener('selectionchange', handleSelectionChange);
        return () => document.removeEventListener('selectionchange', handleSelectionChange);
    }, []);

    // Focus editor while preserving last caret position or placing caret at the very end
    const focusEditor = useCallback(() => {
        if (!editorRef.current) return;
        editorRef.current.focus();

        const sel = window.getSelection();
        if (!sel) return;

        // 1. If we have a valid saved range inside the editor, restore it
        if (lastSavedRangeRef.current && editorRef.current.contains(lastSavedRangeRef.current.commonAncestorContainer)) {
            sel.removeAllRanges();
            sel.addRange(lastSavedRangeRef.current);
            return;
        }

        // 2. Otherwise place caret at the VERY END of the editor content (never at top)
        const range = document.createRange();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
        lastSavedRangeRef.current = range;
    }, []);

    // Check if editor has any text or chips
    const checkEmpty = useCallback(() => {
        if (!editorRef.current) {
            setIsEmpty(true);
            return true;
        }
        const text = editorRef.current.innerText || '';
        const hasChips = editorRef.current.querySelectorAll('[data-context-chip-host]').length > 0;
        const empty = text.trim() === '' && !hasChips;
        setIsEmpty(empty);
        return empty;
    }, []);

    // Extract text and context chips on demand
    const serializeEditor = useCallback(() => {
        if (!editorRef.current) {
            return { text: '', files: [], skills: [] };
        }

        const files: { path: string; lineRange?: string; name: string }[] = [];
        const skills: string[] = [];
        let result = '';

        const chipLookup = new Map<string, InlineChipData>();
        activeChips.forEach(c => chipLookup.set(c.id, c.data));

        const traverse = (node: Node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                result += node.textContent || '';
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node as HTMLElement;
                if (el.hasAttribute('data-context-chip-host')) {
                    const chipId = el.getAttribute('data-chip-id');
                    const chip = chipId ? chipLookup.get(chipId) : undefined;
                    if (chip) {
                        if (chip.type === 'file' || chip.type === 'folder') {
                            const rawPath = chip.rawPath || chip.name || '';
                            const tag = chip.lineRange ? `@[${rawPath}:${chip.lineRange}]` : `@[${rawPath}]`;
                            result += ` ${tag} `;
                            files.push({
                                path: rawPath,
                                lineRange: chip.lineRange,
                                name: chip.name || extractBaseName(rawPath)
                            });
                        } else if (chip.type === 'skill') {
                            const skillName = chip.name || chip.id;
                            skills.push(skillName);
                        }
                    }
                } else if (el.tagName === 'BR') {
                    result += '\n';
                } else if (el.tagName === 'DIV' || el.tagName === 'P') {
                    const hasOnlyChips = el.querySelectorAll('[data-context-chip-host]').length > 0 && !el.innerText?.trim();
                    if (result && !result.endsWith('\n') && !result.endsWith(' ') && !hasOnlyChips) {
                        result += '\n';
                    } else if (hasOnlyChips && result && !result.endsWith(' ')) {
                        result += ' ';
                    }
                    el.childNodes.forEach(traverse);
                } else {
                    el.childNodes.forEach(traverse);
                }
            }
        };

        editorRef.current.childNodes.forEach(traverse);
        const cleanText = result.replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n\n').trim();
        return { text: cleanText, files, skills };
    }, [activeChips]);

    // Remove a chip deterministically without infinite loops
    const handleRemoveChip = useCallback((id: string) => {
        if (editorRef.current) {
            const host = editorRef.current.querySelector(`[data-chip-id="${id}"]`);
            if (host && host.parentNode) {
                host.parentNode.removeChild(host);
            }
        }

        setActiveChips(prev => {
            const next = prev.filter(c => c.id !== id);
            return next;
        });

        setTimeout(() => {
            checkEmpty();
            if (onTextChange) {
                const serialized = serializeEditor();
                onTextChange(serialized.text);
            }
        }, 0);
    }, [checkEmpty, onTextChange, serializeEditor]);

    // Insert chip at current caret position or at the end
    const insertChip = useCallback((chipData: Omit<InlineChipData, 'id'>) => {
        if (!editorRef.current) return;

        const id = `chip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const newChipData: InlineChipData = { ...chipData, id };

        // Create atomic host span in the DOM
        const hostSpan = document.createElement('span');
        hostSpan.setAttribute('data-context-chip-host', 'true');
        hostSpan.setAttribute('data-chip-id', id);
        const tag = newChipData.lineRange ? `@[${newChipData.rawPath || newChipData.name}:${newChipData.lineRange}]` : `@[${newChipData.rawPath || newChipData.name}]`;
        hostSpan.setAttribute('data-chip-tag', tag);
        hostSpan.setAttribute('contenteditable', 'false');
        hostSpan.className = 'inline-block align-middle select-all pointer-events-auto';

        const spacer = document.createTextNode('\u00A0'); // Non-breaking space after chip

        // Check if there is already an active selection inside the editor, OR use saved range
        const sel = window.getSelection();
        let targetRange: Range | null = null;
        if (sel && sel.rangeCount > 0 && editorRef.current.contains(sel.getRangeAt(0).commonAncestorContainer)) {
            targetRange = sel.getRangeAt(0);
        } else if (lastSavedRangeRef.current && editorRef.current.contains(lastSavedRangeRef.current.commonAncestorContainer)) {
            targetRange = lastSavedRangeRef.current;
        }

        editorRef.current.focus();

        if (targetRange) {
            targetRange.deleteContents();
            targetRange.insertNode(spacer);
            targetRange.insertNode(hostSpan);

            // Move caret right after the spacer
            const newRange = document.createRange();
            newRange.setStartAfter(spacer);
            newRange.collapse(true);
            sel?.removeAllRanges();
            sel?.addRange(newRange);
            lastSavedRangeRef.current = newRange;
        } else {
            // Append at the very end
            editorRef.current.appendChild(hostSpan);
            editorRef.current.appendChild(spacer);

            const newRange = document.createRange();
            newRange.setStartAfter(spacer);
            newRange.collapse(true);
            sel?.removeAllRanges();
            sel?.addRange(newRange);
            lastSavedRangeRef.current = newRange;
        }

        setActiveChips(prev => [...prev, { id, data: newChipData, el: hostSpan }]);
        setIsEmpty(false);

        if (onTextChange) {
            const serialized = serializeEditor();
            onTextChange(serialized.text);
        }
    }, [onTextChange, serializeEditor]);

    // Insert text at caret
    const insertText = useCallback((textToInsert: string) => {
        if (!editorRef.current) return;
        editorRef.current.focus();
        const sel = window.getSelection();
        let range: Range | null = null;
        if (sel && sel.rangeCount > 0 && editorRef.current.contains(sel.getRangeAt(0).commonAncestorContainer)) {
            range = sel.getRangeAt(0);
        } else {
            range = document.createRange();
            range.selectNodeContents(editorRef.current);
            range.collapse(false);
        }

        const textNode = document.createTextNode(textToInsert);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.collapse(true);
        sel?.removeAllRanges();
        sel?.addRange(range);
        lastSavedRangeRef.current = range;

        checkEmpty();
        if (onTextChange) {
            const serialized = serializeEditor();
            onTextChange(serialized.text);
        }
    }, [checkEmpty, onTextChange, serializeEditor]);

    // Clear entire editor content
    const clear = useCallback(() => {
        if (editorRef.current) {
            editorRef.current.innerHTML = '';
        }
        setActiveChips([]);
        setIsEmpty(true);
        lastSavedRangeRef.current = null;
        if (onTextChange) onTextChange('');
    }, [onTextChange]);

    // Expose imperative handle
    useImperativeHandle(ref, () => ({
        focus: focusEditor,
        clear,
        insertChip,
        insertText,
        getSerializedContent: serializeEditor,
        isEmpty: () => checkEmpty()
    }), [focusEditor, clear, insertChip, insertText, serializeEditor, checkEmpty]);

    // Keyboard navigation & Submission handling
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        saveCaretPosition();

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const { text, files, skills } = serializeEditor();
            if (text.trim() || files.length > 0 || skills.length > 0) {
                if (onSubmit) {
                    onSubmit(text, { files, skills });
                }
            }
            return;
        }

        // Clean removal when pressing Backspace right next to a chip
        if (e.key === 'Backspace') {
            const sel = window.getSelection();
            if (sel && sel.isCollapsed && sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                const startNode = range.startContainer;
                const offset = range.startOffset;

                let prevNode: Node | null = null;
                if (startNode.nodeType === Node.TEXT_NODE) {
                    if (offset === 0) {
                        prevNode = startNode.previousSibling;
                    }
                } else if (startNode.nodeType === Node.ELEMENT_NODE) {
                    prevNode = (startNode as Element).childNodes[offset - 1] || null;
                }

                if (prevNode && (prevNode as HTMLElement).hasAttribute?.('data-context-chip-host')) {
                    e.preventDefault();
                    const chipId = (prevNode as HTMLElement).getAttribute('data-chip-id');
                    if (chipId) handleRemoveChip(chipId);
                    return;
                }
            }
        }
    };

    // Full path context chip copying (extracts @[path] tags for selected chips)
    const handleCopy = useCallback((e: React.ClipboardEvent) => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || !editorRef.current) return;

        const range = selection.getRangeAt(0);
        if (!editorRef.current.contains(range.commonAncestorContainer)) return;

        const clonedFragment = range.cloneContents();
        const chipLookup = new Map<string, InlineChipData>();
        activeChips.forEach(c => chipLookup.set(c.id, c.data));

        let copiedText = '';

        const traverseFragment = (node: Node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                copiedText += node.textContent || '';
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node as HTMLElement;
                if (el.hasAttribute('data-context-chip-host')) {
                    const chipId = el.getAttribute('data-chip-id');
                    const chip = chipId ? chipLookup.get(chipId) : undefined;
                    if (chip) {
                        const rawPath = chip.rawPath || chip.name || '';
                        const tag = chip.lineRange ? `@[${rawPath}:${chip.lineRange}]` : `@[${rawPath}]`;
                        copiedText += tag;
                    } else {
                        copiedText += el.getAttribute('data-chip-tag') || '';
                    }
                } else if (el.tagName === 'BR') {
                    copiedText += '\n';
                } else if (el.tagName === 'DIV' || el.tagName === 'P') {
                    if (copiedText && !copiedText.endsWith('\n')) copiedText += '\n';
                    el.childNodes.forEach(traverseFragment);
                } else {
                    el.childNodes.forEach(traverseFragment);
                }
            }
        };

        clonedFragment.childNodes.forEach(traverseFragment);

        if (copiedText) {
            e.preventDefault();
            e.clipboardData.setData('text/plain', copiedText);
        }
    }, [activeChips]);

    // Cut handling (copies full chip paths and removes selected range)
    const handleCut = useCallback((e: React.ClipboardEvent) => {
        handleCopy(e);
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0 && editorRef.current) {
            const range = selection.getRangeAt(0);
            if (editorRef.current.contains(range.commonAncestorContainer)) {
                range.deleteContents();
                checkEmpty();
                if (onTextChange) {
                    const serialized = serializeEditor();
                    onTextChange(serialized.text);
                }
            }
        }
    }, [handleCopy, checkEmpty, onTextChange, serializeEditor]);

    // Clean paste handling (intercept large text for staging deck, and file clipboard data)
    const handlePaste = (e: React.ClipboardEvent) => {
        // If files are in clipboard (e.g. pasted screenshots, images):
        if (e.clipboardData.files && e.clipboardData.files.length > 0) {
            e.preventDefault();
            if (onDropFiles) {
                onDropFiles(e.clipboardData.files);
                return;
            }
        }

        const text = e.clipboardData.getData('text/plain');
        if (text) {
            // Check for large text paste (market standard: >800 chars or >12 lines)
            const lineCount = text.split('\n').length;
            if (onPasteLargeText && (text.length >= 800 || lineCount >= 12)) {
                const handled = onPasteLargeText(text);
                if (handled) {
                    e.preventDefault();
                    return;
                }
            }
            e.preventDefault();
            insertText(text);
        }
    };

    // Drag and Drop handling
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (document.caretRangeFromPoint) {
            const range = document.caretRangeFromPoint(e.clientX, e.clientY);
            if (range && editorRef.current?.contains(range.commonAncestorContainer)) {
                const sel = window.getSelection();
                sel?.removeAllRanges();
                sel?.addRange(range);
                lastSavedRangeRef.current = range;
            }
        }

        // 0. Dragged pasted text snippet from staging deck back into input
        const pastedSnippet = e.dataTransfer.getData('application/cluaiz-pasted-text');
        if (pastedSnippet) {
            insertText(pastedSnippet);
            return;
        }

        // 1. Custom workspace path
        const customData = e.dataTransfer.getData('application/cluaiz-path');
        if (customData) {
            try {
                const parsed = JSON.parse(customData);
                if (parsed.path) {
                    insertChip({
                        type: parsed.isFolder ? 'folder' : 'file',
                        name: parsed.name || extractBaseName(parsed.path),
                        rawPath: parsed.path
                    });
                    return;
                }
            } catch (err) {}
        }

        // 2. Native OS files
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            if (onDropFiles) {
                onDropFiles(e.dataTransfer.files);
            } else {
                Array.from(e.dataTransfer.files).forEach((file: any) => {
                    const realPath = file.path || file.name;
                    const isDir = Boolean((file as any).isDirectory || (!file.type && !file.name.includes('.')));
                    insertChip({
                        type: isDir ? 'folder' : 'file',
                        name: file.name,
                        rawPath: realPath
                    });
                });
            }
            return;
        }

        // 3. Plain text
        const text = e.dataTransfer.getData('text/plain');
        if (text) {
            const trimmed = text.trim();
            if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') &&
                (trimmed.match(/^[a-zA-Z]:[\\/]/) || trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('.\\'))) {
                insertChip({
                    type: 'file',
                    name: extractBaseName(trimmed),
                    rawPath: trimmed
                });
            } else {
                insertText(text);
            }
        }
    };

    return (
        <div className={`relative flex-1 min-w-0 w-full flex items-center ${className}`}>
            {/* Native placeholder when empty */}
            {isEmpty && (
                <div className="absolute left-0 top-0.5 pointer-events-none select-none text-sm font-medium text-[var(--text-muted)] truncate max-w-full">
                    {placeholder}
                </div>
            )}

            {/* Core ContentEditable Prompt Surface */}
            <div
                ref={editorRef}
                contentEditable={!disabled}
                role="textbox"
                aria-multiline="true"
                tabIndex={0}
                onInput={() => {
                    checkEmpty();
                    saveCaretPosition();
                    if (onTextChange) {
                        const serialized = serializeEditor();
                        onTextChange(serialized.text);
                    }
                }}
                onKeyDown={handleKeyDown}
                onKeyUp={saveCaretPosition}
                onMouseUp={saveCaretPosition}
                onClick={saveCaretPosition}
                onBlur={saveCaretPosition}
                onCopy={handleCopy}
                onCut={handleCut}
                onPaste={handlePaste}
                onDrop={handleDrop}
                onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'copy';
                }}
                style={{
                    minHeight,
                    maxHeight,
                    lineHeight: '24px'
                }}
                className="w-full bg-transparent border-0 outline-none text-sm font-medium text-[var(--text-primary)] resize-none overflow-y-auto custom-scrollbar break-words whitespace-pre-wrap focus:outline-none selection:bg-[var(--accent-color)] selection:text-[var(--accent-contrast,#ffffff)]"
            />

            {/* React Portals directly mounted to active chip elements */}
            {activeChips.map(chip => (
                createPortal(
                    <ContextChip
                        key={chip.id}
                        id={chip.id}
                        type={chip.data.type}
                        name={chip.data.name}
                        rawPath={chip.data.rawPath}
                        lineRange={chip.data.lineRange}
                        icon={chip.data.icon}
                        onRemove={() => handleRemoveChip(chip.id)}
                    />,
                    chip.el
                )
            ))}
        </div>
    );
});

InlinePromptInput.displayName = 'InlinePromptInput';

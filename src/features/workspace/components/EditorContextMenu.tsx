import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Command,
    Search,
    AlignLeft,
    WrapText,
    FolderMinus,
    FolderPlus,
    Scissors,
    Copy,
    Clipboard,
    CheckSquare,
    X
} from 'lucide-react';

interface EditorContextMenuProps {
    x: number;
    y: number;
    isOpen: boolean;
    onClose: () => void;
    editor: any;
}

export const EditorContextMenu: React.FC<EditorContextMenuProps> = ({
    x,
    y,
    isOpen,
    onClose,
    editor
}) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleAction = async (actionId: string) => {
        if (!editor) {
            onClose();
            return;
        }

        editor.focus();

        switch (actionId) {
            case 'command_palette':
                editor.getAction('editor.action.quickCommand')?.run();
                break;
            case 'format':
                editor.getAction('editor.action.formatDocument')?.run();
                break;
            case 'find':
                editor.getAction('actions.find')?.run();
                break;
            case 'toggle_wrap':
                editor.getAction('editor.action.toggleWordWrap')?.run();
                break;
            case 'fold_all':
                editor.getAction('editor.foldAll')?.run();
                break;
            case 'unfold_all':
                editor.getAction('editor.unfoldAll')?.run();
                break;
            case 'cut': {
                const sel = editor.getSelection();
                const model = editor.getModel();
                if (sel && model) {
                    const text = model.getValueInRange(sel);
                    if (text) {
                        await navigator.clipboard.writeText(text);
                        editor.executeEdits('context-menu', [{ range: sel, text: '' }]);
                    }
                }
                break;
            }
            case 'copy': {
                const sel = editor.getSelection();
                const model = editor.getModel();
                if (sel && model) {
                    const text = model.getValueInRange(sel);
                    if (text) {
                        await navigator.clipboard.writeText(text);
                    }
                }
                break;
            }
            case 'paste': {
                try {
                    const text = await navigator.clipboard.readText();
                    if (text) {
                        editor.trigger('keyboard', 'type', { text });
                    }
                } catch {
                    // Ignore clipboard permission issues
                }
                break;
            }
            case 'select_all':
                editor.getAction('editor.action.selectAll')?.run();
                break;
            default:
                break;
        }

        onClose();
    };

    const menuItems = [
        { id: 'command_palette', label: 'Command Palette', icon: Command, shortcut: 'F1' },
        { id: 'format', label: 'Format Document', icon: AlignLeft, shortcut: 'Shift+Alt+F' },
        { id: 'find', label: 'Find & Replace', icon: Search, shortcut: 'Ctrl+F' },
        { id: 'toggle_wrap', label: 'Toggle Word Wrap', icon: WrapText, shortcut: 'Alt+Z' },
        { id: 'fold_all', label: 'Fold All', icon: FolderMinus, shortcut: 'Ctrl+K 0' },
        { id: 'unfold_all', label: 'Unfold All', icon: FolderPlus, shortcut: 'Ctrl+K J' },
        { id: 'divider-1', isDivider: true },
        { id: 'cut', label: 'Cut', icon: Scissors, shortcut: 'Ctrl+X' },
        { id: 'copy', label: 'Copy', icon: Copy, shortcut: 'Ctrl+C' },
        { id: 'paste', label: 'Paste', icon: Clipboard, shortcut: 'Ctrl+V' },
        { id: 'select_all', label: 'Select All', icon: CheckSquare, shortcut: 'Ctrl+A' },
    ];

    const menuWidth = 240;
    const menuHeight = 360;
    const adjustedX = typeof window !== 'undefined' ? Math.max(10, Math.min(x, window.innerWidth - menuWidth - 12)) : x;
    const adjustedY = typeof window !== 'undefined' ? Math.max(10, Math.min(y, window.innerHeight - menuHeight - 12)) : y;

    if (typeof document === 'undefined') return null;

    return ReactDOM.createPortal(
        <AnimatePresence>
            <motion.div
                ref={menuRef}
                initial={{ opacity: 0, scale: 0.96, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: -6 }}
                transition={{ duration: 0.12, ease: 'easeOut' }}
                style={{
                    position: 'fixed',
                    top: adjustedY,
                    left: adjustedX,
                    zIndex: 99999
                }}
                className="w-60 bg-zinc-950/95 border border-white/10 rounded-2xl shadow-[0_12px_45px_rgba(0,0,0,0.65)] backdrop-blur-md overflow-hidden flex flex-col select-none py-1.5 font-mono"
                onClick={(e) => e.stopPropagation()}
                onContextMenu={(e) => e.preventDefault()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-3.5 py-1.5 mb-1 border-b border-white/5">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Command className="w-3 h-3 text-[var(--accent-color)]" />
                        Editor Actions
                    </span>
                    <button
                        onClick={onClose}
                        className="text-zinc-500 hover:text-zinc-300 transition-colors p-0.5 rounded hover:bg-white/5"
                    >
                        <X className="w-3 h-3" />
                    </button>
                </div>

                {/* Items */}
                <div className="space-y-0.5 px-1">
                    {menuItems.map((item) => {
                        if (item.isDivider) {
                            return <div key={item.id} className="h-px bg-white/5 my-1 mx-2" />;
                        }

                        const Icon = item.icon!;
                        return (
                            <button
                                key={item.id}
                                onClick={() => handleAction(item.id)}
                                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-all text-zinc-300 hover:bg-white/[0.08] hover:text-white group text-left cursor-pointer"
                            >
                                <Icon className="w-3.5 h-3.5 text-zinc-400 group-hover:text-[var(--accent-color)] transition-colors flex-shrink-0" />
                                <span className="font-normal flex-1 truncate">{item.label}</span>
                                {item.shortcut && (
                                    <span className="text-[10px] text-zinc-500 group-hover:text-zinc-400 font-mono tracking-wider ml-auto flex-shrink-0 bg-white/[0.03] px-1.5 py-0.5 rounded border border-white/5">
                                        {item.shortcut}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </motion.div>
        </AnimatePresence>,
        document.body
    );
};

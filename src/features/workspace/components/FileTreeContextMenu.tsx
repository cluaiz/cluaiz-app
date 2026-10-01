import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FilePlus,
    FolderPlus,
    Pencil,
    Trash2,
    Copy,
    Folder,
    FileCode,
    Terminal,
    X,
    Scissors,
    Clipboard,
    Link2
} from 'lucide-react';

export interface FileTreeContextTarget {
    type: 'file' | 'folder' | 'root';
    path: string;
    name: string;
}

interface FileTreeContextMenuProps {
    x: number;
    y: number;
    isOpen: boolean;
    onClose: () => void;
    target: FileTreeContextTarget | null;
    canPaste?: boolean;
    onAction: (actionId: string, target: FileTreeContextTarget) => void;
}

export const FileTreeContextMenu: React.FC<FileTreeContextMenuProps> = ({
    x,
    y,
    isOpen,
    onClose,
    target,
    canPaste = false,
    onAction
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

    if (!isOpen || !target) return null;

    interface ContextMenuItem {
        id: string;
        label?: string;
        icon?: any;
        isDivider?: boolean;
        shortcut?: string;
        color?: string;
    }

    const folderActions: ContextMenuItem[] = [
        { id: 'new_file', label: 'New File...', icon: FilePlus },
        { id: 'new_folder', label: 'New Folder...', icon: FolderPlus },
        ...(canPaste ? [{ id: 'paste', label: 'Paste', icon: Clipboard, shortcut: 'Ctrl+V' }] : []),
        { id: 'divider-0', isDivider: true },
        { id: 'cut', label: 'Cut', icon: Scissors, shortcut: 'Ctrl+X' },
        { id: 'copy', label: 'Copy', icon: Copy, shortcut: 'Ctrl+C' },
        { id: 'divider-1', isDivider: true },
        { id: 'open_terminal', label: 'Open in Integrated Terminal', icon: Terminal },
        { id: 'divider-2', isDivider: true },
        { id: 'rename', label: 'Rename', icon: Pencil, shortcut: 'Enter' },
        { id: 'copy_path', label: 'Copy Path', icon: Link2, shortcut: 'Shift+Alt+C' },
        { id: 'copy_relative_path', label: 'Copy Relative Path', icon: Copy },
        { id: 'divider-3', isDivider: true },
        { id: 'delete', label: 'Delete Folder', icon: Trash2, color: 'text-rose-400 hover:text-rose-300' },
    ];

    const fileActions: ContextMenuItem[] = [
        { id: 'open_terminal', label: 'Open in Integrated Terminal', icon: Terminal },
        { id: 'divider-0', isDivider: true },
        { id: 'cut', label: 'Cut', icon: Scissors, shortcut: 'Ctrl+X' },
        { id: 'copy', label: 'Copy', icon: Copy, shortcut: 'Ctrl+C' },
        { id: 'divider-1', isDivider: true },
        { id: 'rename', label: 'Rename', icon: Pencil, shortcut: 'Enter' },
        { id: 'copy_path', label: 'Copy Path', icon: Link2, shortcut: 'Shift+Alt+C' },
        { id: 'copy_relative_path', label: 'Copy Relative Path', icon: Copy },
        { id: 'divider-2', isDivider: true },
        { id: 'delete', label: 'Delete File', icon: Trash2, color: 'text-rose-400 hover:text-rose-300' },
    ];

    const rootActions: ContextMenuItem[] = [
        { id: 'new_file', label: 'New File...', icon: FilePlus },
        { id: 'new_folder', label: 'New Folder...', icon: FolderPlus },
        ...(canPaste ? [{ id: 'paste', label: 'Paste', icon: Clipboard, shortcut: 'Ctrl+V' }] : []),
        { id: 'divider-0', isDivider: true },
        { id: 'copy_path', label: 'Copy Workspace Path', icon: Link2 },
        { id: 'open_terminal', label: 'Open in Integrated Terminal', icon: Terminal },
    ];

    const actions: ContextMenuItem[] = target.type === 'folder' 
        ? folderActions 
        : target.type === 'file' 
            ? fileActions 
            : rootActions;

    const menuWidth = 265;
    const menuHeight = 320;
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
                className="w-64 min-w-[260px] bg-zinc-950/95 border border-white/10 rounded-2xl shadow-[0_12px_45px_rgba(0,0,0,0.65)] backdrop-blur-md overflow-hidden flex flex-col select-none py-1.5 font-mono text-xs"
                onClick={(e) => e.stopPropagation()}
                onContextMenu={(e) => e.preventDefault()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-1.5 mb-1 border-b border-white/5">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 truncate">
                        {target.type === 'folder' ? (
                            <Folder className="w-3 h-3 text-amber-400 shrink-0" />
                        ) : target.type === 'file' ? (
                            <FileCode className="w-3 h-3 text-[var(--accent-color)] shrink-0" />
                        ) : null}
                        <span className="truncate">{target.name || 'Explorer'}</span>
                    </span>
                    <button
                        onClick={onClose}
                        className="text-zinc-500 hover:text-zinc-300 transition-colors p-0.5 rounded hover:bg-white/5 shrink-0"
                    >
                        <X className="w-3 h-3" />
                    </button>
                </div>

                {/* Items */}
                <div className="space-y-0.5 px-1">
                    {actions.map((act) => {
                        if (act.isDivider) {
                            return <div key={act.id} className="h-px bg-white/5 my-1 mx-2" />;
                        }

                        const Icon = act.icon!;
                        return (
                            <button
                                key={act.id}
                                onClick={() => {
                                    onAction(act.id, target);
                                    onClose();
                                }}
                                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-all hover:bg-white/[0.08] text-left cursor-pointer group ${
                                    act.color || 'text-zinc-300 hover:text-white'
                                }`}
                            >
                                <Icon className={`w-3.5 h-3.5 opacity-70 group-hover:opacity-100 transition-opacity shrink-0 ${act.color || 'text-zinc-400 group-hover:text-white'}`} />
                                <span className="flex-1 truncate">{act.label}</span>
                                {act.shortcut && (
                                    <span className="text-[10px] text-zinc-500 font-mono tracking-wider ml-auto shrink-0 bg-white/[0.03] px-1 py-0.5 rounded border border-white/5">
                                        {act.shortcut}
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

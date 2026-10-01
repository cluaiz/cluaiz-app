import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    XCircle,
    Pin,
    PinOff,
    Link2,
    Copy,
    FileCode
} from 'lucide-react';

interface EditorTabContextMenuProps {
    x: number;
    y: number;
    isOpen: boolean;
    onClose: () => void;
    filePath: string;
    fileName: string;
    isPinned: boolean;
    onCloseTab: (path: string) => void;
    onCloseOthers: (path: string) => void;
    onCloseAll: () => void;
    onTogglePin: (path: string) => void;
    onCopyPath: (path: string) => void;
    onCopyRelativePath: (path: string) => void;
}

export const EditorTabContextMenu: React.FC<EditorTabContextMenuProps> = ({
    x,
    y,
    isOpen,
    onClose,
    filePath,
    fileName,
    isPinned,
    onCloseTab,
    onCloseOthers,
    onCloseAll,
    onTogglePin,
    onCopyPath,
    onCopyRelativePath
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

    if (!isOpen || !filePath) return null;

    const menuWidth = 230;
    const menuHeight = 240;
    const adjustedX = typeof window !== 'undefined' ? Math.max(10, Math.min(x, window.innerWidth - menuWidth - 12)) : x;
    const adjustedY = typeof window !== 'undefined' ? Math.max(10, Math.min(y, window.innerHeight - menuHeight - 12)) : y;

    if (typeof document === 'undefined') return null;

    return ReactDOM.createPortal(
        <AnimatePresence>
            <motion.div
                ref={menuRef}
                initial={{ opacity: 0, scale: 0.96, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: -4 }}
                transition={{ duration: 0.1, ease: 'easeOut' }}
                style={{
                    position: 'fixed',
                    top: adjustedY,
                    left: adjustedX,
                    zIndex: 99999
                }}
                className="w-56 min-w-[220px] bg-zinc-950/95 border border-white/10 rounded-2xl shadow-[0_12px_45px_rgba(0,0,0,0.65)] backdrop-blur-md overflow-hidden flex flex-col select-none py-1.5 font-mono text-xs"
                onClick={(e) => e.stopPropagation()}
                onContextMenu={(e) => e.preventDefault()}
            >
                {/* Tab Header Title */}
                <div className="flex items-center justify-between px-3 py-1.5 mb-1 border-b border-white/5">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 truncate">
                        <FileCode className="w-3 h-3 text-[var(--accent-color)] shrink-0" />
                        <span className="truncate">{fileName}</span>
                    </span>
                    <button
                        onClick={onClose}
                        className="text-zinc-500 hover:text-zinc-300 transition-colors p-0.5 rounded hover:bg-white/5 shrink-0"
                    >
                        <X className="w-3 h-3" />
                    </button>
                </div>

                {/* Actions */}
                <div className="space-y-0.5 px-1">
                    {/* Close Tab */}
                    <button
                        onClick={() => {
                            onCloseTab(filePath);
                            onClose();
                        }}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-all hover:bg-white/[0.08] text-left cursor-pointer text-zinc-300 hover:text-white"
                    >
                        <X className="w-3.5 h-3.5 text-zinc-400" />
                        <span className="flex-1 truncate">Close</span>
                        <span className="text-[10px] text-zinc-500 font-mono tracking-wider ml-auto bg-white/[0.03] px-1 py-0.5 rounded border border-white/5">
                            Ctrl+W
                        </span>
                    </button>

                    {/* Close Others */}
                    <button
                        onClick={() => {
                            onCloseOthers(filePath);
                            onClose();
                        }}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-all hover:bg-white/[0.08] text-left cursor-pointer text-zinc-300 hover:text-white"
                    >
                        <XCircle className="w-3.5 h-3.5 text-zinc-400" />
                        <span className="flex-1 truncate">Close Others</span>
                    </button>

                    {/* Close All */}
                    <button
                        onClick={() => {
                            onCloseAll();
                            onClose();
                        }}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-all hover:bg-white/[0.08] text-left cursor-pointer text-zinc-300 hover:text-white"
                    >
                        <X className="w-3.5 h-3.5 text-rose-400/80" />
                        <span className="flex-1 truncate text-rose-400/90">Close All</span>
                    </button>

                    <div className="h-px bg-white/5 my-1 mx-2" />

                    {/* Pin / Unpin Tab */}
                    <button
                        onClick={() => {
                            onTogglePin(filePath);
                            onClose();
                        }}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-all hover:bg-white/[0.08] text-left cursor-pointer text-zinc-300 hover:text-white"
                    >
                        {isPinned ? (
                            <>
                                <PinOff className="w-3.5 h-3.5 text-amber-400" />
                                <span className="flex-1 truncate">Unpin Tab</span>
                            </>
                        ) : (
                            <>
                                <Pin className="w-3.5 h-3.5 text-zinc-400" />
                                <span className="flex-1 truncate">Pin Tab</span>
                            </>
                        )}
                    </button>

                    <div className="h-px bg-white/5 my-1 mx-2" />

                    {/* Copy Path */}
                    <button
                        onClick={() => {
                            onCopyPath(filePath);
                            onClose();
                        }}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-all hover:bg-white/[0.08] text-left cursor-pointer text-zinc-300 hover:text-white"
                    >
                        <Link2 className="w-3.5 h-3.5 text-zinc-400" />
                        <span className="flex-1 truncate">Copy Path</span>
                        <span className="text-[10px] text-zinc-500 font-mono tracking-wider ml-auto bg-white/[0.03] px-1 py-0.5 rounded border border-white/5">
                            Shift+Alt+C
                        </span>
                    </button>

                    {/* Copy Relative Path */}
                    <button
                        onClick={() => {
                            onCopyRelativePath(filePath);
                            onClose();
                        }}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-all hover:bg-white/[0.08] text-left cursor-pointer text-zinc-300 hover:text-white"
                    >
                        <Copy className="w-3.5 h-3.5 text-zinc-400" />
                        <span className="flex-1 truncate">Copy Relative Path</span>
                    </button>
                </div>
            </motion.div>
        </AnimatePresence>,
        document.body
    );
};

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Pin,
    PinOff,
    Tag,
    Archive,
    ArchiveRestore,
    BellOff,
    Bell,
    CheckSquare,
    ChevronRight,
    Check,
    Edit2,
    FolderInput,
    FolderX
} from 'lucide-react';
import { ProjectIcon } from '../../../features/projects/ProjectIcons';
import type { ChatProject } from '../../../store/chat/useChatProjectsStore';

interface ChatContextMenuProps {
    x: number;
    y: number;
    isOpen: boolean;
    isPinned: boolean;
    isFavourite?: boolean;
    isMuted: boolean;
    status: string; // 'active' or 'archived'
    onClose: () => void;
    onEdit: () => void;
    onPin: () => void;
    onSelectMessages: () => void;
    onAddLabel: () => void;
    onToggleFavourite?: () => void;
    onArchive: () => void;
    onToggleMute: () => void;
    chatId: string;
    projects?: ChatProject[];
    currentProjectId?: string;
    onMoveToProject?: (projectId: string | undefined) => void;
}

function cn(...classes: (string | boolean | undefined | null)[]) {
    return classes.filter(Boolean).join(' ');
}

export const ChatContextMenu: React.FC<ChatContextMenuProps> = ({
    x,
    y,
    isOpen,
    isPinned,
    isFavourite,
    isMuted,
    status,
    onClose,
    onEdit,
    onPin,
    onSelectMessages,
    onAddLabel,
    onToggleFavourite,
    onArchive,
    onToggleMute,
    projects = [],
    currentProjectId,
    onMoveToProject
}) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [showProjectPicker, setShowProjectPicker] = useState(false);

    useEffect(() => {
        if (!isOpen) setShowProjectPicker(false);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        // Defer so the right-click that opened the menu doesn't instantly close it
        let handleOutside: ((e: MouseEvent) => void) | null = null;
        const timer = setTimeout(() => {
            handleOutside = (e: MouseEvent) => {
                if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                    onClose();
                }
            };
            window.addEventListener('mousedown', handleOutside);
        }, 50);
        return () => {
            clearTimeout(timer);
            if (handleOutside) window.removeEventListener('mousedown', handleOutside);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;


    const menuWidth = 220;
    const menuHeight = 260;
    const adjustedX = typeof window !== 'undefined' && x + menuWidth > window.innerWidth ? window.innerWidth - menuWidth - 10 : x;
    const adjustedY = typeof window !== 'undefined' && y + menuHeight > window.innerHeight ? window.innerHeight - menuHeight - 10 : y;

    return (
        <AnimatePresence>
            <motion.div
                ref={menuRef}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.1 }}
                style={{ top: adjustedY, left: adjustedX, borderStyle: 'var(--border-style)' }}
                className="fixed z-[100000] w-[220px] bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl shadow-2xl p-1 backdrop-blur-xl select-none"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex flex-col gap-0.5">
                            {/* Pin / Unpin */}
                            <button
                                onClick={() => { onPin(); onClose(); }}
                                className="w-full flex items-center gap-3 px-3.5 py-2.5 text-[13px] font-bold rounded-xl text-[var(--accent-color)] hover:bg-[var(--accent-color)]/10 transition-colors text-left cursor-pointer"
                            >
                                {isPinned ? <PinOff size={16} /> : <Pin size={16} />}
                                <span>{isPinned ? "Unpin Chat" : "Pin Chat"}</span>
                            </button>

                            {/* Edit Chat */}
                            <button
                                onClick={() => { onEdit(); onClose(); }}
                                className="w-full flex items-center gap-3 px-3.5 py-2.5 text-[13px] font-bold rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors text-left cursor-pointer"
                            >
                                <Edit2 size={16} />
                                <span>Edit Chat</span>
                            </button>

                            {/* Select Messages */}
                            <button
                                onClick={() => { onSelectMessages(); onClose(); }}
                                className="w-full flex items-center gap-3 px-3.5 py-2.5 text-[13px] font-bold rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors text-left cursor-pointer"
                            >
                                <CheckSquare size={16} />
                                <span>Select Messages</span>
                            </button>

                            {/* Add Label */}
                            <button
                                onClick={() => { onAddLabel(); onClose(); }}
                                className="w-full flex items-center gap-3 px-3.5 py-2.5 text-[13px] font-bold rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors text-left cursor-pointer"
                            >
                                <Tag size={16} />
                                <span>Add Label</span>
                            </button>

                            {/* Move to Project */}
                            {onMoveToProject && projects.length > 0 && (
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setShowProjectPicker(prev => !prev)}
                                        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-[13px] font-bold rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors text-left cursor-pointer"
                                    >
                                        <span className="flex items-center gap-3">
                                            <FolderInput size={16} />
                                            <span>Move to Project</span>
                                        </span>
                                        <ChevronRight size={14} className={`transition-transform ${showProjectPicker ? 'rotate-90' : ''}`} />
                                    </button>
                                    {showProjectPicker && (
                                        <div className="mt-0.5 ml-3 pl-2 border-l border-[var(--border-color)] space-y-0.5 max-h-40 overflow-y-auto custom-scrollbar">
                                            {currentProjectId && (
                                                <button
                                                    type="button"
                                                    onClick={() => { onMoveToProject(undefined); onClose(); }}
                                                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold rounded-lg text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors text-left cursor-pointer"
                                                >
                                                    <FolderX size={13} />
                                                    <span>Remove from Project</span>
                                                </button>
                                            )}
                                            {projects.map(p => (
                                                <button
                                                    key={p.id}
                                                    type="button"
                                                    onClick={() => { onMoveToProject(p.id); onClose(); }}
                                                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors text-left cursor-pointer ${
                                                        currentProjectId === p.id
                                                            ? 'bg-[var(--accent-color)]/15 text-[var(--accent-color)]'
                                                            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                                                    }`}
                                                >
                                                    <span className="flex items-center gap-2 truncate">
                                                        <ProjectIcon name={p.iconName} className="w-3.5 h-3.5 shrink-0" />
                                                        <span className="truncate">{p.name}</span>
                                                    </span>
                                                    {currentProjectId === p.id && <Check size={12} className="shrink-0" />}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}


                            {/* Separator */}
                            <div className="h-[1px] bg-[var(--border-color)] my-0.5 mx-1" />



                            {/* Archive Chat */}
                            <button
                                onClick={() => { onArchive(); onClose(); }}
                                className="w-full flex items-center gap-3 px-3.5 py-2.5 text-[13px] font-bold rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors text-left cursor-pointer"
                            >
                                {status === 'archived' ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                                <span>{status === 'archived' ? "Unarchive Chat" : "Archive Chat"}</span>
                            </button>

                            {/* Mute Notifications */}
                            <button
                                onClick={() => { onToggleMute(); onClose(); }}
                                className="w-full flex items-center gap-3 px-3.5 py-2.5 text-[13px] font-bold rounded-xl text-rose-400 hover:bg-rose-500/10 transition-colors text-left cursor-pointer"
                            >
                                {isMuted ? <Bell size={16} /> : <BellOff size={16} />}
                                <span>{isMuted ? "Unmute Notifications" : "Mute Notifications"}</span>
                            </button>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Pin,
    PinOff,
    Tag,
    Heart,
    Archive,
    ArchiveRestore,
    BellOff,
    Bell,
    CheckSquare,
    ChevronLeft,
    Check,
    Edit2
} from 'lucide-react';

interface ChatContextMenuProps {
    x: number;
    y: number;
    isOpen: boolean;
    isPinned: boolean;
    isFavourite: boolean;
    isMuted: boolean;
    status: string; // 'active' or 'archived'
    onClose: () => void;
    onEdit: () => void;
    onPin: () => void;
    onSelectMessages: () => void;
    onAddLabel: () => void;
    onToggleFavourite: () => void;
    onArchive: () => void;
    onToggleMute: () => void;
    chatId: string;
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
    chatId
}) => {
    const menuRef = useRef<HTMLDivElement>(null);

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
                style={{ top: adjustedY, left: adjustedX }}
                className="fixed z-[9999] w-[220px] bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl p-1 backdrop-blur-xl select-none"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex flex-col gap-0.5">
                            {/* Pin / Unpin */}
                            <button
                                onClick={() => { onPin(); onClose(); }}
                                className="w-full flex items-center gap-3 px-3.5 py-2.5 text-[13px] font-bold rounded-xl text-amber-500 hover:bg-amber-500/10 transition-colors text-left cursor-pointer"
                            >
                                {isPinned ? <PinOff size={16} /> : <Pin size={16} />}
                                <span>{isPinned ? "Unpin Chat" : "Pin Chat"}</span>
                            </button>

                            {/* Edit Chat */}
                            <button
                                onClick={() => { onEdit(); onClose(); }}
                                className="w-full flex items-center gap-3 px-3.5 py-2.5 text-[13px] font-bold rounded-xl text-zinc-300 hover:bg-white/5 hover:text-white transition-colors text-left cursor-pointer"
                            >
                                <Edit2 size={16} />
                                <span>Edit Chat</span>
                            </button>

                            {/* Select Messages */}
                            <button
                                onClick={() => { onSelectMessages(); onClose(); }}
                                className="w-full flex items-center gap-3 px-3.5 py-2.5 text-[13px] font-bold rounded-xl text-zinc-300 hover:bg-white/5 hover:text-white transition-colors text-left cursor-pointer"
                            >
                                <CheckSquare size={16} />
                                <span>Select Messages</span>
                            </button>

                            {/* Add Label */}
                            <button
                                onClick={() => { onAddLabel(); onClose(); }}
                                className="w-full flex items-center gap-3 px-3.5 py-2.5 text-[13px] font-bold rounded-xl text-zinc-300 hover:bg-white/5 hover:text-white transition-colors text-left cursor-pointer"
                            >
                                <Tag size={16} />
                                <span>Add Label</span>
                            </button>

                            {/* Add to Favourites */}
                            <button
                                onClick={() => { onToggleFavourite(); onClose(); }}
                                className={cn(
                                    "w-full flex items-center gap-3 px-3.5 py-2.5 text-[13px] font-bold rounded-xl transition-colors text-left cursor-pointer",
                                    isFavourite ? "text-red-500 hover:bg-red-500/10" : "text-zinc-300 hover:bg-white/5 hover:text-white"
                                )}
                            >
                                <Heart size={16} fill={isFavourite ? "currentColor" : "none"} />
                                <span>{isFavourite ? "Remove Favourite" : "Add to Favourites"}</span>
                            </button>

                            {/* Separator */}
                            <div className="h-[1px] bg-white/5 my-0.5 mx-1" />



                            {/* Archive Chat */}
                            <button
                                onClick={() => { onArchive(); onClose(); }}
                                className="w-full flex items-center gap-3 px-3.5 py-2.5 text-[13px] font-bold rounded-xl text-zinc-300 hover:bg-white/5 hover:text-white transition-colors text-left cursor-pointer"
                            >
                                {status === 'archived' ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                                <span>{status === 'archived' ? "Unarchive Chat" : "Archive Chat"}</span>
                            </button>

                            {/* Mute Notifications */}
                            <button
                                onClick={() => { onToggleMute(); onClose(); }}
                                className="w-full flex items-center gap-3 px-3.5 py-2.5 text-[13px] font-bold rounded-xl text-red-500 hover:bg-red-500/10 transition-colors text-left cursor-pointer"
                            >
                                {isMuted ? <Bell size={16} /> : <BellOff size={16} />}
                                <span>{isMuted ? "Unmute Notifications" : "Mute Notifications"}</span>
                            </button>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

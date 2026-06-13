import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Star,
    Phone,
    CheckSquare,
    Trash2,
    Copy,
    Reply,
    Pin,
    PinOff,
    StarOff
} from 'lucide-react';
import { EmojiMeta } from '../../../assets/EmojiMeta';
import { LottieEmoji } from './LottieEmoji';
import { EmojiPicker } from './EmojiPicker';
import { Plus } from '../../animate-ui/icons/plus';
import { AnimateIcon } from '../../animate-ui/icons/icon';

interface MessageContextMenuProps {
    x: number;
    y: number;
    isOpen: boolean;
    isPinned: boolean;
    isStarred: boolean;
    isDeleted?: boolean;
    onClose: () => void;
    onAction: (action: string) => void;
    onReact: (emoji: string) => void;
    viewMode?: 'widget' | 'dashboard';
}

function cn(...classes: (string | boolean | undefined | null)[]) {
    return classes.filter(Boolean).join(' ');
}

export const MessageContextMenu: React.FC<MessageContextMenuProps> = ({
    x,
    y,
    isOpen,
    isPinned,
    isStarred,
    isDeleted = false,
    onClose,
    onAction,
    onReact
}) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [showPicker, setShowPicker] = useState(false);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const reactions = [
        { emoji: '👍', label: 'Like' },
        { emoji: '👎', label: 'Dislike' },
        { emoji: '❤️', label: 'Love' },
        { emoji: '😂', label: 'Haha' },
        { emoji: '😮', label: 'Wow' },
        { emoji: '🙏', label: 'Pray' },
    ];

    const actions = [
        { id: 'reply', label: 'Reply', icon: Reply },
        { id: 'copy', label: 'Copy', icon: Copy },
        { id: 'pin', label: isPinned ? 'Unpin Message' : 'Pin Message', icon: isPinned ? PinOff : Pin },
        { id: 'star', label: isStarred ? 'Unstar' : 'Star', icon: isStarred ? StarOff : Star },
        { id: 'select', label: 'Select', icon: CheckSquare },
        { id: 'delete', label: 'Delete', icon: Trash2, color: 'text-red-500' },
    ];

    // Adjust coordinates to fit view
    const menuWidth = 230;
    const menuHeight = 350;
    const adjustedX = typeof window !== 'undefined' ? Math.min(x, window.innerWidth - menuWidth - 10) : x;
    const adjustedY = typeof window !== 'undefined' ? Math.min(y, window.innerHeight - menuHeight - 10) : y;

    // React Portal to body
    if (typeof document === 'undefined') return null;

    return ReactDOM.createPortal(
        <AnimatePresence>
            <motion.div
                ref={menuRef}
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                style={{
                    position: 'fixed',
                    top: adjustedY,
                    left: adjustedX,
                    zIndex: 99999
                }}
                className={cn(
                    "flex flex-col select-none",
                    showPicker ? "bg-transparent shadow-none border-none animate-fade-in" : "bg-zinc-950/95 backdrop-blur-md border border-white/10 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] px-1 py-1 w-64"
                )}
                onClick={(e) => e.stopPropagation()}
            >
                {!showPicker ? (
                    <>
                        {/* reactions row */}
                        {!isDeleted && (
                            <div className="flex items-center gap-2 px-2.5 py-2 bg-transparent rounded-t-2xl">
                                <div className="flex items-center gap-0.5">
                                    {reactions.map((r) => {
                                        const codepoint = [...r.emoji].map(c => c.codePointAt(0)?.toString(16)).filter(Boolean).join('_');
                                        const meta = EmojiMeta[codepoint];
                                        return (
                                            <button
                                                key={r.emoji}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onReact(r.emoji);
                                                    onClose();
                                                }}
                                                className="flex items-center justify-center rounded-full transition-all hover:scale-125 p-1 w-7 h-7 shrink-0 cursor-pointer"
                                                title={r.label}
                                            >
                                                {meta?.path ? (
                                                    <LottieEmoji
                                                        path={meta.path}
                                                        loop={true}
                                                        autoplay={true}
                                                        playOnHover={false}
                                                        shouldPreload={true}
                                                        alt={r.emoji}
                                                        style={{ width: 20, height: 20 }}
                                                    />
                                                ) : (
                                                    <span className="text-sm">{r.emoji}</span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="w-[1px] h-6 bg-white/10 shrink-0" />
                                <AnimateIcon animateOnHover={true} asChild>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowPicker(true);
                                        }}
                                        className="flex items-center justify-center bg-transparent rounded-full transition-all text-zinc-400 hover:text-white w-7 h-7 shrink-0 cursor-pointer"
                                    >
                                        <Plus size={14} />
                                    </button>
                                </AnimateIcon>
                            </div>
                        )}

                        <div className="h-[1px] bg-white/5 mx-2" />

                        {/* actions list */}
                        <div className="flex flex-col py-1">
                            {actions
                                .filter(act => !isDeleted || ['delete', 'select'].includes(act.id))
                                .map((act, index) => (
                                    <React.Fragment key={act.id}>
                                        {index > 0 && index === 2 && !isDeleted && <div className="h-[1px] bg-white/5 mx-2 my-1" />}
                                        {index > 0 && index === 5 && !isDeleted && <div className="h-[1px] bg-white/5 mx-2 my-1" />}
                                        <button
                                            onClick={() => {
                                                onAction(act.id);
                                                onClose();
                                            }}
                                            className={cn(
                                                "w-full flex items-center gap-3 px-3 py-2.5 transition-all text-zinc-300 hover:bg-white/5 hover:rounded-lg hover:text-white group text-left text-[13px] font-medium cursor-pointer",
                                                act.color
                                            )}
                                        >
                                            <act.icon
                                                size={16}
                                                className={cn("opacity-70 group-hover:opacity-100 transition-opacity", act.color)}
                                            />
                                            {act.label}
                                        </button>
                                    </React.Fragment>
                                ))}
                        </div>
                    </>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="shadow-2xl rounded-xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <EmojiPicker
                            onSelect={(emoji) => {
                                onReact(emoji);
                                onClose();
                            }}
                        />
                    </motion.div>
                )}
            </motion.div>
        </AnimatePresence>,
        document.body
    );
};

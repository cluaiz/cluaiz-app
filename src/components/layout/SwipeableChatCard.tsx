import React, { useState } from 'react';
import { motion, PanInfo, useMotionValue, animate } from 'framer-motion';
import { Icons } from '../animate-ui/icons';
import { HoldButton } from '../HoldButton/HoldButton';
import { ChatRibbon } from '../ui/ChatRibbon';

export interface ChatItemCardData {
    id: string;
    name: string;
    avatar?: string;
    time?: string;
    message?: string;
    lastPreview?: string;
    tags?: string[];
    pinned?: boolean;
    archived?: boolean;
    status?: any;
}

export interface SwipeableChatCardProps {
    chat: ChatItemCardData;
    isSelected: boolean;
    selectMode: boolean;
    isStreaming: boolean;
    selectedIds: Set<string>;
    onSelectChat: () => void;
    onToggleSelect: () => void;
    onContextMenu: (e: React.MouseEvent) => void;
    onDeleteChat: (chatId: string) => void;
    onToggleArchive: (chatId: string) => void;
    onTogglePin: (chatId: string) => void;
}

export const SwipeableChatCard: React.FC<SwipeableChatCardProps> = ({
    chat,
    isSelected,
    selectMode,
    isStreaming,
    selectedIds,
    onSelectChat,
    onToggleSelect,
    onContextMenu,
    onDeleteChat,
    onToggleArchive,
    onTogglePin,
}) => {
    // Real-time Motion Value & Guaranteed Spring Snapping
    const x = useMotionValue(0);
    const [isOpened, setIsOpened] = useState<boolean>(false);
    const [isDragging, setIsDragging] = useState<boolean>(false);

    const snapTo = (target: number) => {
        animate(x, target, {
            type: 'spring',
            stiffness: 450,
            damping: 32,
            mass: 0.8,
        });
        setIsOpened(target !== 0);
    };

    const handleDragEnd = (_: any, info: PanInfo) => {
        setIsDragging(false);
        const currentX = x.get();
        const { velocity } = info;

        let target = 0;
        // Swipe Left -> Archive + Delete Drawer
        if (currentX < -26 || velocity.x < -180) {
            target = -80;
        }
        // Swipe Right -> Pin Drawer
        else if (currentX > 20 || velocity.x > 180) {
            target = 42;
        }
        // Snap closed
        else {
            target = 0;
        }

        snapTo(target);
    };

    const handleCardClick = (e: React.MouseEvent) => {
        if (isDragging) return;

        // Tapping while swiped open snaps the card closed smoothly
        if (isOpened || Math.abs(x.get()) > 5) {
            snapTo(0);
            return;
        }

        if (selectMode) {
            e.stopPropagation();
            onToggleSelect();
        } else {
            onSelectChat();
        }
    };

    const subtitleText = chat.message || chat.lastPreview || 'No messages yet';
    const isDrawerVisible = isOpened || isDragging;

    return (
        <div className="relative overflow-hidden rounded-xl my-1 select-none bg-transparent">
            {/* Left Drawer (Revealed on Right Swipe): Pin / Unpin (Icon Only, Compact 42px, Dim Theme Accent) */}
            <div
                className={`absolute inset-y-0 left-0 flex items-stretch z-0 transition-opacity duration-150 ${
                    isDrawerVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                }`}
            >
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onTogglePin(chat.id);
                        snapTo(0);
                    }}
                    className="h-full w-[42px] flex items-center justify-center bg-[color-mix(in_srgb,var(--accent-color)_20%,var(--bg-tertiary))] hover:bg-[color-mix(in_srgb,var(--accent-color)_30%,var(--bg-tertiary))] text-[var(--accent-color)] cursor-pointer transition-colors active:scale-95 border-0 rounded-none"
                    title={chat.pinned ? 'Unpin chat' : 'Pin chat'}
                    aria-label={chat.pinned ? 'Unpin chat' : 'Pin chat'}
                >
                    <Icons.Pin className={`w-4 h-4 ${chat.pinned ? 'fill-current rotate-45' : ''}`} />
                </button>
            </div>

            {/* Right Drawer (Revealed on Left Swipe): Archive + Hold to Delete (Icons Only, Compact 80px Total) */}
            <div
                className={`absolute inset-y-0 right-0 flex items-stretch z-0 transition-opacity duration-150 ${
                    isDrawerVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                }`}
            >
                {/* Archive Button (Icon Only, 40px) */}
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleArchive(chat.id);
                        snapTo(0);
                    }}
                    className="h-full w-10 flex items-center justify-center bg-[var(--bg-tertiary)] hover:bg-[color-mix(in_srgb,var(--text-muted)_20%,var(--bg-tertiary))] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-0 cursor-pointer transition-colors active:scale-95 rounded-none"
                    title={chat.archived ? 'Restore chat' : 'Archive chat'}
                    aria-label={chat.archived ? 'Restore chat' : 'Archive chat'}
                >
                    <Icons.Archive className="w-4 h-4" />
                </button>

                {/* Hold to Delete Button (Icon Only, 40px, NO TEXT, Liquid Wave Fill Animation Effect) */}
                <div onClick={(e) => e.stopPropagation()} className="h-full flex items-stretch w-10">
                    <HoldButton
                        holdTime={1200}
                        radius={0}
                        size="sm"
                        backgroundColor="color-mix(in srgb, #ef4444 18%, var(--bg-primary))"
                        fillColor="#ef4444"
                        textColor="#f87171"
                        fillTextColor="#ffffff"
                        icon={<Icons.Trash2 className="w-4 h-4" />}
                        doneIcon={<Icons.Trash2 className="w-4 h-4" />}
                        doneLabel={<></>}
                        onHold={() => {
                            onDeleteChat(chat.id);
                            snapTo(0);
                        }}
                        className="h-full! w-full! px-0! border-0 rounded-none!"
                    >
                        <></>
                    </HoldButton>
                </div>
            </div>

            {/* Front Card Surface: Pure Neutral Dark, Zero Muddy Yellow, Clean 2px Left Accent Border */}
            <motion.div
                drag={!selectMode ? 'x' : false}
                dragConstraints={{ left: -80, right: 42 }}
                dragElastic={0.12}
                style={{ x }}
                onDragStart={() => setIsDragging(true)}
                onDragEnd={handleDragEnd}
                onClick={handleCardClick}
                onContextMenu={(e) => {
                    if (!selectMode && !isOpened && Math.abs(x.get()) < 5) {
                        e.preventDefault();
                        onContextMenu(e);
                    }
                }}
                className={`relative z-10 flex items-center gap-2.5 px-3 py-2.5 w-full rounded-none cursor-pointer select-none transition-colors duration-150 border-0 ${
                    isSelected
                        ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] shadow-xs'
                        : 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
            >
                {/* Ribbon Tag overlay sticker */}
                {chat.tags && chat.tags.length > 0 && (
                    <ChatRibbon tags={chat.tags} />
                )}

                {/* Checkbox in select mode */}
                {selectMode && (
                    <div
                        className={`w-4 h-4 rounded-md flex items-center justify-center border transition-all shrink-0 ${
                            selectedIds.has(chat.id)
                                ? 'bg-[var(--accent-color)] border-[var(--accent-color)] shadow-sm'
                                : 'border-[var(--text-muted)]/35 bg-[var(--bg-secondary)]'
                        }`}
                    >
                        {selectedIds.has(chat.id) && (
                            <Icons.CheckCheck className="w-3 h-3 text-[var(--accent-contrast)]" />
                        )}
                    </div>
                )}

                {/* Center Content: Title & Subtitle Preview (NO Left Icon) */}
                <div className={`flex flex-col flex-1 min-w-0 ${chat.archived ? 'opacity-60' : ''}`}>
                    <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate leading-snug">
                        {chat.name || 'New Chat'}
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)] truncate leading-snug font-normal mt-0.5">
                        {subtitleText}
                    </span>
                </div>

                {/* Right Content: Pin/Status on TOP, Timestamp on BOTTOM */}
                <div className={`flex flex-col items-end justify-between shrink-0 self-stretch py-0.5 gap-1.5 ${chat.archived ? 'opacity-60' : ''}`}>
                    {/* Top Row: Pin indicator & Streaming animation */}
                    <div className="flex items-center gap-1.5 min-h-[14px]">
                        {chat.pinned && (
                            <Icons.Pin className="w-3.5 h-3.5 text-[var(--accent-color)] fill-[var(--accent-color)] rotate-45" />
                        )}
                        {isStreaming && (
                            <span className="inline-flex items-center gap-0.5" title="Generating...">
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-color)] animate-bounce" />
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-color)] animate-bounce [animation-delay:150ms]" />
                            </span>
                        )}
                    </div>

                    {/* Bottom Row: Timestamp (aligned with message preview) */}
                    <span className="text-[10px] font-medium text-[var(--text-muted)] font-mono leading-none">
                        {chat.time || ''}
                    </span>
                </div>
            </motion.div>
        </div>
    );
};

export default SwipeableChatCard;

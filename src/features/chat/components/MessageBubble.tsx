import React from 'react';
import { CheckCheck } from 'lucide-react';
import { LottieEmoji } from '../../../components/ui/context-menu/LottieEmoji';
import { EmojiMeta } from '../../../assets/EmojiMeta';

const getEmojiCodepoint = (emoji: string) => {
    return [...emoji]
        .map(char => char.codePointAt(0)?.toString(16))
        .filter(Boolean)
        .join('_');
};

import { ChatMessage } from '../../../store/chat/useChatStore';

interface MessageBubbleProps {
    msg: ChatMessage;
    index: number;
    handleMessageContextMenu: (e: React.MouseEvent, index: number) => void;
    onTextSelect?: (data: { x: number, y: number, text: string, messageIndex: number } | null) => void;
    onHighlightClick?: (data: { x: number, y: number, text: string, messageIndex: number }) => void;
    isSelectionMode?: boolean;
    isSelected?: boolean;
    onToggleSelect?: () => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ 
    msg, 
    index, 
    handleMessageContextMenu, 
    onTextSelect, 
    onHighlightClick,
    isSelectionMode,
    isSelected,
    onToggleSelect
}) => {
    const isUser = msg.sender === 'user';

    const handleMouseUp = () => {
        if (!onTextSelect) return;
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            const text = selection.toString().trim();
            if (text) {
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                onTextSelect({
                    x: rect.left + rect.width / 2,
                    y: rect.top - 5,
                    text,
                    messageIndex: index
                });
                return;
            }
        }
        onTextSelect(null);
    };

    const renderTextWithHighlights = (text: string, highlights?: string[]) => {
        if (!highlights || highlights.length === 0) return text;

        const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`(${highlights.map(escapeRegExp).join('|')})`, 'g');
        
        const parts = text.split(pattern);
        
        return parts.map((part, i) => {
            if (highlights.includes(part)) {
                return (
                    <mark 
                        key={i} 
                        className="relative inline-block text-inherit bg-transparent group/mark cursor-pointer z-0"
                        onMouseDown={(e) => {
                            e.stopPropagation();
                            const rect = (e.target as HTMLElement).getBoundingClientRect();
                            onHighlightClick?.({
                                x: rect.left + rect.width / 2,
                                y: rect.top - 5,
                                text: part,
                                messageIndex: index
                            });
                        }}
                    >
                        <span 
                            className="absolute inset-0 bg-[var(--accent-color)] opacity-40 rounded-sm transition-all duration-300 group-hover/mark:opacity-60"
                            style={{
                                borderRadius: '4px 10px 3px 8px / 8px 3px 12px 5px',
                                transform: 'rotate(-1.5deg) scale(1.04) skew(-3deg, 1deg)',
                                zIndex: -1
                            }}
                        />
                        <span className="relative z-10 px-1 font-bold text-[var(--text-primary)] drop-shadow-md mix-blend-plus-lighter">{part}</span>
                    </mark>
                );
            }
            return part;
        });
    };
    
    return (
        <div 
            className={`flex relative w-full items-center gap-2 group ${isUser ? 'justify-end' : 'justify-start'}`}
            onClick={() => {
                if (isSelectionMode && onToggleSelect) {
                    onToggleSelect();
                }
            }}
        >
            {isSelectionMode && (
                <div 
                    className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors flex-shrink-0 cursor-pointer ${
                        isSelected 
                            ? 'bg-[var(--accent-color)] border-[var(--accent-color)]' 
                            : 'border-[var(--border-color)] group-hover:border-[var(--text-muted)]'
                    }`}
                >
                    {isSelected && <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-white"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
            )}

            <div
                onContextMenu={(e) => {
                    if (!isSelectionMode) {
                        handleMessageContextMenu(e, index);
                    }
                }}
                className={`flex flex-col w-fit max-w-[90%] md:max-w-[65%] rounded-2xl p-2.5 px-3.5 shadow-sm relative group/bubble transition-transform duration-200
                    ${isSelectionMode ? 'cursor-pointer hover:scale-[1.01]' : ''}
                    ${isUser
                        ? 'self-end bg-[#005c4b] text-white rounded-tr-sm'
                        : 'self-start bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-tl-sm'
                    }`}
            >
                {msg.isStarred && (
                    <div className={`absolute -top-2 ${isUser ? '-left-2' : '-right-2'} bg-yellow-500/20 text-yellow-500 p-0.5 rounded-full z-10`}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    </div>
                )}
                <pre
                    className="whitespace-pre-wrap font-sans font-medium select-text"
                    style={{ fontSize: 'var(--chat-bubble-font-size, 14px)' }}
                    onMouseUp={handleMouseUp}
                >
                    {renderTextWithHighlights(msg.text, msg.highlights)}
                </pre>

            <div className={`flex justify-end items-center gap-1 mt-1 text-[10px] font-bold ${isUser ? 'text-emerald-100/70' : 'text-[var(--text-muted)]'}`}>
                <span>{msg.time}</span>
                {isUser && <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />}
            </div>

            {/* Render Reacted Emojis */}
            {msg.reactions && msg.reactions.length > 0 && (
                <div className={`absolute -bottom-3 ${isUser ? 'right-2' : 'left-2'} flex items-center gap-0.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-full px-1.5 py-0.5 shadow-sm`}>
                    {msg.reactions.map((r, ri) => {
                        const codepoint = getEmojiCodepoint(r);
                        const meta = EmojiMeta[codepoint];
                        return (
                            <span key={ri} className="flex items-center justify-center w-4 h-4">
                                {meta?.path ? (
                                    <LottieEmoji path={meta.path} loop={true} autoplay={true} playOnHover={false} shouldPreload={true} alt={r} style={{ width: 14, height: 14 }} />
                                ) : (
                                    <span className="text-[10px]">{r}</span>
                                )}
                            </span>
                        );
                    })}
                </div>
            )}
            </div>
        </div>
    );
};

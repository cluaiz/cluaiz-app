import React from 'react';
import { CheckCheck, ChevronDown, ChevronUp, FileText, FileCode, Image as ImageIcon, Film, Music } from 'lucide-react';
import { LottieEmoji } from '../../../components/ui/context-menu/LottieEmoji';
import { EmojiMeta } from '../../../assets/EmojiMeta';
import { ContextChip } from '../../../components/ui/ContextChip';
import { extractBaseName } from '../../../utils/filePath';
import { MarkdownRenderer } from '../../../components/ui/MarkdownRenderer';

function formatBytes(bytes?: number | null): string {
    if (!bytes || bytes === 0) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const getEmojiCodepoint = (emoji: string) => {
    return [...emoji]
        .map(char => char.codePointAt(0)?.toString(16))
        .filter(Boolean)
        .join('_');
};

const formatDisplayTime = (time?: string): string => {
    if (!time) return '';
    // If it's an ISO timestamp or date string containing 'T'
    if (time.includes('T')) {
        const d = new Date(time);
        if (!isNaN(d.getTime())) {
            return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        }
    }
    // Strictly format to HH:mm (Hours and Minutes only), dropping the 3rd component (:59 / milliseconds)
    const clean = time.split('.')[0].split('+')[0].trim();
    const parts = clean.split(':');
    if (parts.length >= 2) {
        return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    }
    return clean;
};

const formatSecondsOnly = (val?: string | number): string => {
    if (val === undefined || val === null || val === '') return '';
    const num = typeof val === 'number' ? val : parseFloat(String(val));
    if (isNaN(num) || num < 0) return '';
    if (num === 0) return '0';
    if (num < 1) {
        const formatted = num.toFixed(2);
        return formatted.endsWith('0') ? num.toFixed(1) : formatted;
    }
    return (num % 1 === 0 || num >= 10) ? String(Math.round(num)) : num.toFixed(1);
};

interface ThoughtProcessCardProps {
    thinking: string;
    isStreaming?: boolean;
    duration?: string | number;
    onSkipThinking?: () => void;
}

const ThoughtProcessCard: React.FC<ThoughtProcessCardProps> = ({ thinking, isStreaming = false, duration, onSkipThinking }) => {
    const [isOpen, setIsOpen] = React.useState(isStreaming);
    const scrollRef = React.useRef<HTMLDivElement>(null);
    const userInteractedRef = React.useRef(false);
    const prevStreamingRef = React.useRef(isStreaming);

    // Lifecycle: auto-open while streaming, auto-close when done unless user scrolled/interacted
    React.useEffect(() => {
        if (isStreaming) {
            setIsOpen(true);
            userInteractedRef.current = false;
        } else if (prevStreamingRef.current && !isStreaming) {
            if (!userInteractedRef.current) {
                setIsOpen(false);
            }
        }
        prevStreamingRef.current = isStreaming;
    }, [isStreaming]);

    // Auto-scroll to bottom of thinking stream unless user manually scrolled up
    React.useEffect(() => {
        if (thinking && scrollRef.current && isOpen && !userInteractedRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [thinking, isOpen]);

    // Detect if user scrolled up to read earlier thoughts
    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const el = e.currentTarget;
        const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 25;
        if (!isAtBottom) {
            userInteractedRef.current = true;
        } else {
            userInteractedRef.current = false;
        }
    };

    if (!thinking) return null;

    const sec = formatSecondsOnly(duration);
    const displayDuration = sec ? `${sec}s` : '';

    return (
        <div className="w-full my-1 select-none text-left" style={{ fontSize: 'calc(var(--chat-bubble-font-size, 14.5px) * 0.92)' }}>
            <div className="inline-flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => {
                        userInteractedRef.current = true;
                        setIsOpen(prev => !prev);
                    }}
                    className="inline-flex items-center gap-1 text-zinc-400 hover:text-zinc-200 transition-colors py-1 cursor-pointer group/thought"
                    style={{ fontSize: 'inherit' }}
                >
                    {isStreaming ? (
                        <span className="font-normal flex items-center text-zinc-400 group-hover/thought:text-zinc-200" style={{ fontSize: 'inherit' }}>
                            <span>Thinking</span>
                            <span className="inline-flex items-baseline font-[family-name:var(--font-family)] tracking-wider ml-0.5 text-zinc-400" style={{ fontSize: 'inherit', fontFamily: 'var(--font-family)' }}>
                                <span className="inline-block animate-bounce leading-none" style={{ animationDelay: '0ms' }}>.</span>
                                <span className="inline-block animate-bounce leading-none" style={{ animationDelay: '150ms' }}>.</span>
                                <span className="inline-block animate-bounce leading-none" style={{ animationDelay: '300ms' }}>.</span>
                            </span>
                        </span>
                    ) : (
                        <span className="font-normal text-zinc-400 group-hover/thought:text-zinc-200" style={{ fontSize: 'inherit' }}>
                            Thought{displayDuration ? ` for ${displayDuration}` : ''}
                        </span>
                    )}
                    <ChevronDown
                        className={`w-3.5 h-3.5 text-zinc-500 group-hover/thought:text-zinc-300 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    />
                </button>

                {isStreaming && onSkipThinking && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsOpen(false);
                            onSkipThinking();
                        }}
                        title="Skip reasoning and generate response directly"
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors cursor-pointer select-none"
                    >
                        <span>Skip</span>
                    </button>
                )}
            </div>
            {isOpen && (
                <div
                    ref={scrollRef}
                    onScroll={handleScroll}
                    className="border-l-2 border-zinc-700/60 pl-3.5 my-2 py-0.5 text-zinc-400 font-[family-name:var(--font-family)] max-h-60 overflow-y-auto select-text custom-scrollbar"
                    style={{ fontSize: 'inherit', fontFamily: 'var(--font-family)' }}
                >
                    <MarkdownRenderer
                        content={thinking}
                        allowWorkspaceOpen={false}
                        className="text-zinc-400 text-xs sm:text-[13px] leading-relaxed [&_p]:text-zinc-400 [&_p]:mb-2 [&_p]:text-xs [&_p]:sm:text-[13px] [&_p]:leading-relaxed [&_li]:text-zinc-400 [&_li]:text-xs [&_li]:sm:text-[13px] [&_li]:leading-relaxed [&_strong]:text-zinc-200 [&_strong]:font-semibold [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_h4]:text-xs [&_ul]:mb-2 [&_ol]:mb-2 [&_code]:text-zinc-300"
                    />
                </div>
            )}
        </div>
    );
};

import { ChatMessage, useChatStore } from '../../../store/chat/useChatStore';
import { ToolCallAccordion } from './ToolCallAccordion';
import { PermissionApprovalCard } from './PermissionApprovalCard';
import { AttachmentStagingDeck, AttachmentCard } from './AttachmentStagingDeck';

interface CollapsibleUserMessageProps {
    text: string;
    highlights?: string[];
    renderContent: (text: string, highlights?: string[]) => React.ReactNode;
    onMouseUp?: () => void;
}

const CollapsibleUserMessage: React.FC<CollapsibleUserMessageProps> = ({
    text,
    highlights,
    renderContent,
    onMouseUp,
}) => {
    const [isExpanded, setIsExpanded] = React.useState(false);
    const [isOverflowing, setIsOverflowing] = React.useState(false);
    const contentRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const el = contentRef.current;
        if (!el) return;

        const checkOverflow = () => {
            if (el) {
                // If scrollHeight > 180px, it qualifies as a long message to compress
                setIsOverflowing(el.scrollHeight > 180);
            }
        };

        checkOverflow();
        const ro = new ResizeObserver(checkOverflow);
        ro.observe(el);
        return () => ro.disconnect();
    }, [text]);

    return (
        <div className="relative w-full">
            <div
                ref={contentRef}
                className={`whitespace-pre-wrap font-medium select-text break-words leading-relaxed font-[family-name:var(--font-family)] transition-all duration-200 ${isOverflowing && !isExpanded ? 'max-h-[170px] overflow-hidden' : ''
                    }`}
                style={{ fontSize: 'var(--chat-bubble-font-size, 14px)', fontFamily: 'var(--font-family)' }}
                onMouseUp={onMouseUp}
            >
                {renderContent(text, highlights)}
            </div>

            {/* Bottom Gradient Fade when Collapsed */}
            {isOverflowing && !isExpanded && (
                <div
                    className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
                    style={{
                        background: 'linear-gradient(to top, var(--accent-color) 0%, transparent 100%)'
                    }}
                />
            )}

            {/* Show more / Show less Toggle Button */}
            {isOverflowing && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsExpanded(prev => !prev);
                    }}
                    className="relative z-10 mt-1.5 flex items-center gap-1 text-[11.5px] font-semibold text-white/95 hover:text-white underline underline-offset-2 opacity-90 hover:opacity-100 cursor-pointer select-none transition-opacity"
                >
                    {isExpanded ? (
                        <>
                            <span>Show less</span>
                            <ChevronUp className="w-3.5 h-3.5" />
                        </>
                    ) : (
                        <>
                            <span>Show more</span>
                            <ChevronDown className="w-3.5 h-3.5" />
                        </>
                    )}
                </button>
            )}
        </div>
    );
};

interface MessageBubbleProps {
    msg: ChatMessage;
    index: number;
    handleMessageContextMenu: (e: React.MouseEvent, index: number) => void;
    onTextSelect?: (data: { x: number, y: number, text: string, messageIndex: number } | null) => void;
    onHighlightClick?: (data: { x: number, y: number, text: string, messageIndex: number }) => void;
    isSelectionMode?: boolean;
    isSelected?: boolean;
    onToggleSelect?: () => void;
    onSkipThinking?: () => void;
    isStreaming?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
    msg,
    index,
    handleMessageContextMenu,
    onTextSelect,
    onHighlightClick,
    isSelectionMode,
    isSelected,
    onToggleSelect,
    onSkipThinking,
    isStreaming = false
}) => {
    const activeSessionId = useChatStore(s => s.activeSessionId) || '';
    const isUser = msg.sender === 'user';
    const isThinking = Boolean(msg.thinking && !msg.text);
    const [isThinkingOpen, setIsThinkingOpen] = React.useState(isThinking);
    const thinkingScrollRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        setIsThinkingOpen(isThinking);
    }, [isThinking]);

    React.useEffect(() => {
        if (msg.thinking && thinkingScrollRef.current) {
            thinkingScrollRef.current.scrollTop = thinkingScrollRef.current.scrollHeight;
        }
    }, [msg.thinking]);

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

    const renderUserMessageContent = (text: string, highlights?: string[]) => {
        if (!text) return null;

        // Matches context chip tags like @[path] or @[path:lineRange]
        const chipPattern = /(@\[[^\]]+\])/g;
        const parts = text.split(chipPattern);

        return parts.map((part, idx) => {
            if (part.startsWith('@[') && part.endsWith(']')) {
                const inner = part.slice(2, -1).trim();
                if (!inner) return null;

                // Check if ends with line range (e.g. :L15-L18 or :L1)
                const lineMatch = inner.match(/:(L\d+(?:-L\d+)?)$/i);
                const rawPath = lineMatch ? inner.slice(0, -lineMatch[0].length) : inner;
                const lineRange = lineMatch ? lineMatch[1] : undefined;
                const fileName = extractBaseName(rawPath);

                return (
                    <ContextChip
                        key={`msg-chip-${idx}`}
                        id={rawPath}
                        rawPath={rawPath}
                        name={fileName}
                        lineRange={lineRange}
                        className="inline-flex align-middle mx-0.5 my-0.5 shadow-xs"
                    />
                );
            }

            const prevIsChip = idx > 0 && parts[idx - 1]?.startsWith('@[') && parts[idx - 1]?.endsWith(']');
            const nextIsChip = idx < parts.length - 1 && parts[idx + 1]?.startsWith('@[') && parts[idx + 1]?.endsWith(']');

            // 1. Pure whitespace between chips or at message boundaries
            if (!part.trim()) {
                // If purely whitespace between two chips, ALWAYS stay inline with a single space
                if (prevIsChip && nextIsChip) {
                    return ' ';
                }
                // If boundary whitespace before first chip or after last chip, trim it
                if ((idx === 0 && nextIsChip) || (idx === parts.length - 1 && prevIsChip)) {
                    return null;
                }
                return ' ';
            }

            // 2. Text adjacent to chips: normalize single newlines to spaces so chips flow inline with text
            let normalizedText = part;
            if (nextIsChip) {
                // Trailing single newline before a chip -> space, but preserve double newlines
                if (/\n\s*$/.test(normalizedText) && !/\n\s*\n\s*$/.test(normalizedText)) {
                    normalizedText = normalizedText.replace(/\n\s*$/, ' ');
                }
            }
            if (prevIsChip) {
                // Leading single newline after a chip -> space, but preserve double newlines
                if (/^\s*\n/.test(normalizedText) && !/^\s*\n\s*\n/.test(normalizedText)) {
                    normalizedText = normalizedText.replace(/^\s*\n/, ' ');
                }
            }

            return (
                <React.Fragment key={`text-${idx}`}>
                    {renderTextWithHighlights(normalizedText, highlights)}
                </React.Fragment>
            );
        });
    };

    return (
        <div
            className={`flex relative w-full gap-3 group ${isUser ? 'justify-end items-end' : 'justify-start items-start'}`}
            onClick={() => {
                if (isSelectionMode && onToggleSelect) {
                    onToggleSelect();
                }
            }}
        >
            {isSelectionMode && (
                <div
                    className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors flex-shrink-0 cursor-pointer mt-1 ${isSelected
                            ? 'bg-[var(--accent-color)] border-[var(--accent-color)]'
                            : 'border-[var(--border-color)] group-hover:border-[var(--text-muted)]'
                        }`}
                >
                    {isSelected && <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-white"><polyline points="20 6 9 17 4 12" /></svg>}
                </div>
            )}

            {isUser ? (
                /* User Message Outer Wrapper */
                <div className="flex flex-col items-end self-end max-w-[92%] sm:max-w-[85%] md:max-w-[75%] w-fit gap-1.5 group/bubble select-text">
                    {/* Top: Horizontal Attachment Slider (Exact same slider as input, outside & on top of text bubble) */}
                    {msg.attachments && msg.attachments.length > 0 && (
                        <div className="w-full max-w-full overflow-hidden">
                            <AttachmentStagingDeck
                                attachments={msg.attachments.map((att, attIdx) => ({
                                    id: (att as any).id || `att-${attIdx}`,
                                    name: att.name,
                                    size: att.size || 0,
                                    type: att.type || '',
                                    previewUrl: att.previewUrl,
                                }))}
                            />
                        </div>
                    )}

                    {/* User Text Message Bubble (or compact bubble if text exists) */}
                    {msg.text ? (
                        <div
                            onContextMenu={(e) => {
                                if (!isSelectionMode) {
                                    handleMessageContextMenu(e, index);
                                }
                            }}
                            className={`flex flex-col w-fit rounded-2xl rounded-tr-sm p-3 shadow-sm relative transition-transform duration-200 self-end select-text ${isSelectionMode ? 'cursor-pointer hover:scale-[1.01]' : ''
                                }`}
                            style={{
                                backgroundColor: 'var(--accent-color)',
                                color: 'var(--accent-contrast, #ffffff)',
                            }}
                        >
                            {msg.isStarred && (
                                <div className="absolute -top-2 -left-2 bg-yellow-500/20 text-yellow-500 p-0.5 rounded-full z-10 shadow-sm backdrop-blur-sm">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                                </div>
                            )}

                            {/* Reply to Context Quote Banner */}
                            {msg.replyTo?.text && (
                                <div className="mb-2 px-2.5 py-1.5 rounded-lg bg-black/15 border-l-2 border-white/70 text-xs opacity-95 text-left select-none">
                                    <div className="font-semibold text-[10px] opacity-75 uppercase tracking-wider mb-0.5">
                                        Replying to {msg.replyTo.sender === 'user' ? 'You' : (msg.replyTo.sender || 'Assistant')}
                                    </div>
                                    <div className="line-clamp-2 italic text-[11px] leading-snug">{msg.replyTo.text}</div>
                                </div>
                            )}

                            <CollapsibleUserMessage
                                text={msg.text}
                                highlights={msg.highlights}
                                renderContent={renderUserMessageContent}
                                onMouseUp={handleMouseUp}
                            />

                            <div
                                className="flex items-center justify-end gap-1 mt-1 font-[family-name:var(--font-family)] select-none opacity-85 ml-auto"
                                style={{ fontSize: 'calc(var(--chat-bubble-font-size, 14px) * 0.78)', fontFamily: 'var(--font-family)' }}
                            >
                                <span>{formatDisplayTime(msg.time)}</span>
                                <CheckCheck className="w-3.5 h-3.5 opacity-90" />
                            </div>

                            {/* Reactions for user */}
                            {msg.reactions && msg.reactions.length > 0 && (
                                <div className="absolute -bottom-3 right-2 flex items-center gap-0.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-full px-1.5 py-0.5 shadow-sm z-10">
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
                    ) : (
                        /* Only attachments sent without text: show clean timestamp pill below slider */
                        <div
                            className="flex items-center justify-end gap-1 px-2 py-0.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-color)] font-[family-name:var(--font-family)] text-[10px] text-[var(--text-muted)] select-none ml-auto"
                            style={{ fontFamily: 'var(--font-family)' }}
                        >
                            <span>{formatDisplayTime(msg.time)}</span>
                            <CheckCheck className="w-3.5 h-3.5 opacity-90" />
                        </div>
                    )}
                </div>
            ) : (
                /* AI Assistant Unboxed Layout — Clean canvas like ChatGPT / Claude / Gemini */
                <div
                    onContextMenu={(e) => {
                        if (!isSelectionMode) {
                            handleMessageContextMenu(e, index);
                        }
                    }}
                    className={`flex flex-col w-full max-w-full bg-transparent border-0 p-0 shadow-none text-[var(--text-primary)] relative group/bubble transition-opacity duration-200 select-text ${isSelectionMode ? 'cursor-pointer hover:opacity-90' : ''
                        }`}
                >
                    {msg.isStarred && (
                        <div className="absolute -top-2 -left-2 bg-yellow-500/20 text-yellow-500 p-0.5 rounded-full z-10 shadow-sm backdrop-blur-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                        </div>
                    )}

                    {/* Reply to Context Quote Banner for Assistant */}
                    {msg.replyTo?.text && (
                        <div className="mb-2 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border-l-2 border-[var(--accent-color)] text-xs text-[var(--text-muted)] text-left select-none max-w-xl">
                            <div className="font-semibold text-[10px] text-[var(--accent-color)] uppercase tracking-wider mb-0.5">
                                In reply to {msg.replyTo.sender === 'user' ? 'You' : (msg.replyTo.sender || 'Context')}
                            </div>
                            <div className="line-clamp-2 italic text-[11px] leading-snug">{msg.replyTo.text}</div>
                        </div>
                    )}

                    {/* 1. Initial Thought Process if present */}
                    {msg.thinking && (
                        <div className="w-full mb-1">
                            <ThoughtProcessCard
                                thinking={msg.thinking}
                                isStreaming={Boolean(msg.thinking && !msg.toolCalls?.length && !msg.text?.trim() && !msg.telemetry)}
                                duration={msg.thinkingDuration || (msg.text ? undefined : msg.telemetry?.elapsed)}
                                onSkipThinking={onSkipThinking}
                            />
                        </div>
                    )}

                    {/* 2. Executed / Running Tool Calls */}
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                        <div className="flex flex-col gap-1.5 my-1.5 w-full">
                            {msg.toolCalls.map(tc => (
                                <ToolCallAccordion key={tc.id} toolCall={tc} />
                            ))}
                        </div>
                    )}

                    {/* 2b. Agent Action Permission Approval Card (HITL Stream Pause) */}
                    {msg.permissionRequest && (
                        <PermissionApprovalCard
                            sessionId={activeSessionId}
                            permissionRequest={msg.permissionRequest}
                        />
                    )}

                    {/* 3. Post-Tool Thought Process (Turn 2 reasoning) */}
                    {msg.postToolThinking && (
                        <div className="w-full mb-1">
                            <ThoughtProcessCard
                                thinking={msg.postToolThinking}
                                isStreaming={Boolean(msg.postToolThinking && !msg.text?.trim() && !msg.telemetry)}
                                duration={msg.postToolThinkingDuration || msg.telemetry?.elapsed}
                                onSkipThinking={onSkipThinking}
                            />
                        </div>
                    )}

                    {/* 4. Message Markdown Body */}
                    {msg.text ? (
                        <div
                            onMouseUp={handleMouseUp}
                            className="w-full overflow-hidden select-text text-[var(--text-primary)] font-[family-name:var(--font-family)]"
                            style={{ fontSize: 'var(--chat-bubble-font-size, 14px)', fontFamily: 'var(--font-family)' }}
                        >
                            <MarkdownRenderer content={msg.text} allowWorkspaceOpen={true} />
                        </div>
                    ) : null}

                    {/* 5. Waiting indicator when streaming/generating and no text/tools/thinking yet */}
                    {isStreaming && !msg.text && !msg.toolCalls?.some(tc => tc.status === 'running') && !msg.thinking && !msg.postToolThinking && !msg.telemetry && (
                        <div className="flex items-center gap-1.5 py-2 px-1 text-[var(--text-muted)]">
                            <span className="w-2 h-2 rounded-full bg-[var(--accent-color)] animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-2 h-2 rounded-full bg-[var(--accent-color)] animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-2 h-2 rounded-full bg-[var(--accent-color)] animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                    )}

                    {/* 6. Telemetry & Time Footer */}
                    <div
                        className="flex items-center justify-between gap-3 mt-2.5 pt-1.5 font-[family-name:var(--font-family)] text-[var(--text-muted)] select-none w-full border-t border-[var(--border-color)]/10"
                        style={{ fontSize: 'calc(var(--chat-bubble-font-size, 14px) * 0.78)', fontFamily: 'var(--font-family)' }}
                    >
                        {msg.telemetry ? (
                            <div className="flex items-center gap-2 flex-wrap" style={{ fontSize: 'inherit' }}>
                                <span><b className="text-[var(--text-primary)] font-semibold">{msg.telemetry.tps}</b> TPS</span>
                                <span>·</span>
                                <span><b className="text-[var(--text-primary)] font-semibold">{formatSecondsOnly(msg.telemetry.elapsed)}</b>s</span>
                                <span>·</span>
                                <span><b className="text-[var(--text-primary)] font-semibold">{formatSecondsOnly(msg.telemetry.ttft)}</b>s TTFT</span>
                                <span>·</span>
                                <span><b className="text-[var(--text-primary)] font-semibold">{msg.telemetry.tokens}</b> Tokens</span>
                            </div>
                        ) : <div />}

                        <div className="flex items-center gap-1 ml-auto" style={{ fontSize: 'inherit' }}>
                            <span>{formatDisplayTime(msg.time)}</span>
                        </div>
                    </div>

                    {/* 7. Reactions for AI */}
                    {msg.reactions && msg.reactions.length > 0 && (
                        <div className="flex items-center gap-1 mt-1.5">
                            <div className="flex items-center gap-0.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-full px-2 py-0.5 shadow-sm">
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
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

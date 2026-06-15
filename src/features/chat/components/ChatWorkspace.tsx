import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useLayoutStore } from '../../../store/ui/useLayoutStore';
import { useThemeStore } from '../../../store/ui/useThemeStore';
import { useEngineStore } from '../../../store/engine/useEngineStore';
import { useChatStore } from '../../../store/chat/useChatStore';
import { FileCode, FileText, Play, Database, Maximize2, ChevronDown, Copy, Trash2, X, HatGlasses } from 'lucide-react';
import { MessageContextMenu } from '../../../components/ui/context-menu/MessageContextMenu';
import { GlobalChatContextMenu } from '../../../components/ui/context-menu/GlobalChatContextMenu';
import { DateDivider } from '../../../components/ui/DateDivider';
import { ChatHeader } from './ChatHeader';
import { ChatInput } from './ChatInput';
import { MessageBubble } from './MessageBubble';
import { DateRange } from '../../../components/ui/dropdown/CalendarDropdown';
import { useChatScroll } from '../hooks/useChatScroll';
import { motion, AnimatePresence } from 'framer-motion';
import { Tooltip } from '../../../components/ui/tooltip';

export function ChatWorkspace() {
    const { splitPaneWidth, setSplitPaneWidth, activeChatData } = useLayoutStore();
    const { chatBackground } = useThemeStore();
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [activeFilter, setActiveFilter] = useState('All');
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [isIncognito, setIsIncognito] = useState(false);

    const {
        activeSessionId,
        sessions,
        switchSession,
        updateMessage,
        deleteMessage
    } = useChatStore();

    // The active session's messages
    const activeSession = activeSessionId ? sessions[activeSessionId] : null;
    const messages = activeSession ? activeSession.messages : [];

    const [inputValue, setInputValue] = useState('');

    useEffect(() => {
        const handleNewChat = () => {
            switchSession(null);
            setIsIncognito(false);
        };
        const handleNewPrivateChat = () => {
            switchSession(null);
            setIsIncognito(true);
        };
        document.addEventListener('start-new-chat', handleNewChat);
        document.addEventListener('start-new-private-chat', handleNewPrivateChat);
        return () => {
            document.removeEventListener('start-new-chat', handleNewChat);
            document.removeEventListener('start-new-private-chat', handleNewPrivateChat);
        };
    }, [switchSession]);

    const [msgMenu, setMsgMenu] = useState<{
        x: number;
        y: number;
        isOpen: boolean;
        messageIndex: number;
        isPinned: boolean;
        isStarred: boolean;
    } | null>(null);

    const [globalMenu, setGlobalMenu] = useState<{
        x: number;
        y: number;
        isOpen: boolean;
    } | null>(null);

    const [selectionMenu, setSelectionMenu] = useState<{
        x: number;
        y: number;
        text: string;
        messageIndex: number;
    } | null>(null);

    const [replyingTo, setReplyingTo] = useState<{ text: string, messageIndex: number, type?: 'message' | 'selection' } | null>(null);

    const [unhighlightMenu, setUnhighlightMenu] = useState<{
        x: number;
        y: number;
        text: string;
        messageIndex: number;
    } | null>(null);

    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedMessageIndices, setSelectedMessageIndices] = useState<number[]>([]);

    useEffect(() => {
        const handleClickOutside = () => {
            if (selectionMenu) setSelectionMenu(null);
            if (unhighlightMenu) setUnhighlightMenu(null);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [selectionMenu]);

    const handleMessageContextMenu = (e: React.MouseEvent, index: number) => {
        e.preventDefault();
        e.stopPropagation();
        const msg = messages[index];
        setMsgMenu({
            x: e.clientX,
            y: e.clientY,
            isOpen: true,
            messageIndex: index,
            isPinned: !!msg.pinned,
            isStarred: !!msg.isStarred
        });
    };

    const handleMessageAction = (action: string, index: number) => {
        if (!activeSessionId) return;

        if (action === 'delete') {
            deleteMessage(activeSessionId, index);
        } else if (action === 'pin') {
            const msg = messages[index];
            if (!msg.pinned && messages.filter(m => m.pinned).length >= 10) {
                alert('You can only pin up to 10 messages.');
            } else {
                updateMessage(activeSessionId, index, (m) => ({ ...m, pinned: !m.pinned }));
            }
        } else if (action === 'star') {
            updateMessage(activeSessionId, index, (m) => ({ ...m, isStarred: !m.isStarred }));
        } else if (action === 'copy') {
            navigator.clipboard.writeText(messages[index].text);
        } else if (action === 'reply') {
            setReplyingTo({ text: messages[index].text, messageIndex: index, type: 'message' });
        } else if (action === 'select') {
            setIsSelectionMode(true);
            setSelectedMessageIndices([index]);
        }
        setMsgMenu(null);
    };

    const handleMessageReact = (emoji: string, index: number) => {
        if (!activeSessionId) return;
        updateMessage(activeSessionId, index, (m) => {
            const currentReactions = m.reactions || [];
            const newReactions = currentReactions.includes(emoji)
                ? currentReactions.filter(r => r !== emoji)
                : [...currentReactions, emoji];
            return { ...m, reactions: newReactions };
        });
    };

    const handleMessageHighlight = (index: number, text: string) => {
        if (!activeSessionId) return;
        updateMessage(activeSessionId, index, (m) => {
            const currentHighlights = m.highlights || [];
            if (!currentHighlights.includes(text)) {
                return { ...m, highlights: [...currentHighlights, text] };
            }
            return m;
        });
        setSelectionMenu(null);
        window.getSelection()?.removeAllRanges();
    };

    const handleMessageRemoveHighlight = (index: number, text: string) => {
        if (!activeSessionId) return;
        updateMessage(activeSessionId, index, (m) => {
            const currentHighlights = m.highlights || [];
            return { ...m, highlights: currentHighlights.filter(h => h !== text) };
        });
        setUnhighlightMenu(null);
    };

    const handleGlobalContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        setGlobalMenu({
            x: e.clientX,
            y: e.clientY,
            isOpen: true
        });
    };

    const handleGlobalAction = (action: string) => {
        console.log('Global Action:', action);
    };

    const [activeTab, setActiveTab] = useState<'editor' | 'pdf'>('editor');
    const [codeContent, setCodeContent] = useState(`// Neural Core Sandbox v1.0.0
import { initializeAgent } from '@cluaizd/agent';
import { db } from '@cluaizd/db';

async function main() {
    const agent = await initializeAgent({
        model: "qwen3.5:4b",
        temperature: 0.2,
        maxTokens: 2048
    });

    console.log("Agent online. Awaiting directive...");
    await agent.execute("sandbox_init");
}

main().catch(console.error);`);

    const { launchOnStartup, loadModelOnSend } = useEngineStore();

    useEffect(() => {
        let unlistenToken: (() => void) | undefined;
        let isUnmounted = false;

        import('../../../core/engine').then(({ CluaizeEngine }) => {
            // Conditionally boot the engine based on user settings
            if (launchOnStartup) {
                CluaizeEngine.boot().then(() => {
                    useChatStore.getState().fetchSessionsFromEngine();
                }).catch(console.error);
            }

            CluaizeEngine.onToken((token) => {
                const store = useChatStore.getState();
                if (!store.activeSessionId) return;

                const session = store.sessions[store.activeSessionId];
                const lastMsg = session?.messages[session.messages.length - 1];

                if (!lastMsg || lastMsg.sender !== 'assistant') {
                    const now = new Date();
                    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
                    store.addMessage(store.activeSessionId, {
                        sender: 'assistant',
                        text: token === '[DONE]' ? '' : token,
                        time: timeStr,
                        date: now.getTime()
                    });
                } else if (token !== '[DONE]') {
                    store.appendTokenToLastMessage(store.activeSessionId, token);
                }
            }).then(unlisten => {
                if (isUnmounted) {
                    unlisten();
                } else {
                    unlistenToken = unlisten;
                }
            }).catch(console.error);
        });

        return () => {
            isUnmounted = true;
            if (unlistenToken) unlistenToken();
        };
    }, []);

    const handleSendMessage = async () => {
        if (!inputValue.trim() && !replyingTo) return;
        const messageText = inputValue || 'Replying to context...';

        // Dynamically boot the engine on the first send if "Load Model on Send" is enabled
        if (loadModelOnSend) {
            import('../../../core/engine').then(({ CluaizeEngine }) => {
                CluaizeEngine.boot().catch(console.error);
            });
        }

        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

        const store = useChatStore.getState();
        let sessionId = store.activeSessionId;

        if (!sessionId) {
            sessionId = store.createNewSession();
        }

        store.addMessage(sessionId, {
            sender: 'user',
            text: messageText,
            time: timeStr,
            date: now.getTime()
        });

        setInputValue('');
        setReplyingTo(null);

        try {
            const { CluaizeEngine } = await import('../../../core/engine');
            await CluaizeEngine.send(messageText);
        } catch (error) {
            console.error("Engine connection error:", error);
            const currentStore = useChatStore.getState();
            if (currentStore.activeSessionId) {
                currentStore.addMessage(currentStore.activeSessionId, {
                    sender: 'system',
                    text: `[System Error]: Failed to connect to Cluaize Engine via FFI.`,
                    time: timeStr,
                    date: now.getTime()
                });
            }
        }
    };

    const filteredMessages = useMemo(() => {
        let result = messages;
        if (dateRange?.from) {
            const from = new Date(dateRange.from);
            from.setHours(0, 0, 0, 0);
            const to = dateRange.to ? new Date(dateRange.to) : new Date(from);
            to.setHours(23, 59, 59, 999);

            result = result.filter(msg => {
                const msgDate = new Date(msg.date);
                return msgDate >= from && msgDate <= to;
            });
        }
        return result;
    }, [messages, dateRange]);

    const {
        viewportRef,
        bottomRef,
        unreadCount,
        showScrollButton,
        isHeaderVisible,
        handleScroll,
        scrollToBottom
    } = useChatScroll({ messages: filteredMessages });

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging || !containerRef.current) return;
            const containerRect = containerRef.current.getBoundingClientRect();
            const relativeX = e.clientX - containerRect.left;
            const percentage = (relativeX / containerRect.width) * 100;

            if (percentage >= 20 && percentage <= 80) {
                setSplitPaneWidth(percentage);
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            document.body.style.cursor = 'default';
        };

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, setSplitPaneWidth]);

    return (
        <div ref={containerRef} className="flex-1 flex overflow-hidden relative themed-border border-0">
            <div
                style={{ width: `${splitPaneWidth}%` }}
                className="h-full flex flex-col bg-[var(--bg-primary)] overflow-hidden relative"
            >
                {/* Top Right Incognito Toggle - Only on Landing Page */}
                {messages.length === 0 && (
                    <div className="absolute top-4 right-4 z-40">
                        <Tooltip
                            title={isIncognito ? 'Disable Private Mode' : 'Enable Private Mode'}
                            position="bottom-end"
                        >
                            <button
                                onClick={() => setIsIncognito(!isIncognito)}
                                className={`flex items-center justify-center w-10 h-10 rounded-full border transition-colors shadow-sm ${isIncognito
                                    ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] border-[var(--text-primary)]'
                                    : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] border-[var(--border-color)] hover:text-[var(--text-primary)] hover:border-[var(--text-primary)]'
                                    }`}
                            >
                                <HatGlasses size={20} />
                            </button>
                        </Tooltip>
                    </div>
                )}

                {!isIncognito && messages.length > 0 && (
                    <div
                        className={`transition-all duration-300 ease-in-out flex-shrink-0 relative z-10 grid ${isHeaderVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                        style={{ gridTemplateRows: isHeaderVisible ? '1fr' : '0fr' }}
                    >
                        <div className="overflow-hidden">
                            <ChatHeader
                                activeChatData={activeChatData}
                                searchQuery={searchQuery}
                                setSearchQuery={setSearchQuery}
                                isFilterOpen={isFilterOpen}
                                setIsFilterOpen={setIsFilterOpen}
                                activeFilter={activeFilter}
                                setActiveFilter={setActiveFilter}
                                pinnedMessages={messages.map((m, i) => ({ ...m, originalIndex: i })).filter(m => m.pinned)}
                                onUnpin={(index) => handleMessageAction('pin', index)}
                            />
                        </div>
                        {/* Bottom Fade-Out Shadow Effect for the entire header area */}
                        <div className="absolute left-0 right-0 h-8 -bottom-8 bg-gradient-to-b from-[var(--bg-primary)] to-transparent pointer-events-none z-10" />
                    </div>
                )}

                {messages.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 z-20 relative">
                        <motion.h1
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-3xl font-extrabold text-center mb-8 text-[var(--text-primary)] tracking-tight"
                        >
                            Hi, User
                        </motion.h1>
                        <motion.div layout layoutId="chat-input-wrapper" className="w-full max-w-2xl z-10">
                            <ChatInput
                                inputValue={inputValue}
                                setInputValue={setInputValue}
                                handleSendMessage={handleSendMessage}
                                replyingTo={replyingTo}
                                setReplyingTo={setReplyingTo}
                                isFloating={true}
                            />
                        </motion.div>
                    </div>
                ) : (
                    <>
                        <div
                            className="flex-1 overflow-y-auto p-4 space-y-4 font-sans text-[13px] leading-relaxed relative z-0 flex flex-col lg:px-14"
                            style={{ backgroundImage: chatBackground !== 'none' ? `url("${chatBackground}")` : 'none', backgroundSize: '120px', backgroundBlendMode: 'overlay', backgroundColor: 'var(--bg-primary)' }}
                            onContextMenu={handleGlobalContextMenu}
                            ref={viewportRef}
                            onScroll={handleScroll}
                        >
                            {(() => {
                                let absoluteIndex = 0;
                                const grouped = (filteredMessages || []).reduce((groups, msg) => {
                                    const safeDate = msg.date || (msg as any).timestamp || Date.now();
                                    const dateStr = new Date(safeDate).toDateString();
                                    if (!groups[dateStr]) groups[dateStr] = [];
                                    groups[dateStr].push(msg);
                                    return groups;
                                }, {} as Record<string, typeof filteredMessages>);

                                return Object.entries(grouped).map(([dateStr, groupMsgs]) => (
                                    <div key={dateStr} className="relative flex flex-col">
                                        {!isIncognito && (
                                            <DateDivider
                                                date={new Date(groupMsgs[0].date || (groupMsgs[0] as any).timestamp || Date.now())}
                                                dateRange={dateRange}
                                                onDateRangeChange={setDateRange}
                                                bookedDates={(messages || []).map(m => new Date(m.date || (m as any).timestamp || Date.now()))}
                                                filteredMessagesCount={(filteredMessages || []).length}
                                            />
                                        )}
                                        <div className="flex flex-col gap-4">
                                            {groupMsgs.map((msg) => {
                                                const currentIndex = absoluteIndex++;
                                                return (
                                                    <MessageBubble
                                                        key={currentIndex}
                                                        msg={msg}
                                                        index={currentIndex}
                                                        handleMessageContextMenu={handleMessageContextMenu}
                                                        onTextSelect={setSelectionMenu}
                                                        onHighlightClick={setUnhighlightMenu}
                                                        isSelectionMode={isSelectionMode}
                                                        isSelected={selectedMessageIndices.includes(currentIndex)}
                                                        onToggleSelect={() => {
                                                            setSelectedMessageIndices(prev =>
                                                                prev.includes(currentIndex)
                                                                    ? prev.filter(i => i !== currentIndex)
                                                                    : [...prev, currentIndex]
                                                            );
                                                        }}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>
                                ));
                            })()}
                            <div ref={bottomRef} />
                        </div>

                        <div className="relative">
                            <AnimatePresence>
                                {showScrollButton && (
                                    <motion.button
                                        initial={{ opacity: 0, y: 10, scale: 0.8 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.8 }}
                                        onClick={() => scrollToBottom()}
                                        className="absolute right-6 -top-12 z-50 bg-[var(--bg-tertiary)] text-[var(--accent-color)] p-2 rounded-full shadow-2xl border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] transition-colors"
                                        style={{ borderStyle: 'var(--border-style)' }}
                                    >
                                        <ChevronDown size={20} />
                                        {unreadCount > 0 && (
                                            <span className="absolute -top-1 -right-1 bg-[var(--accent-color)] text-white text-[10px] font-bold min-w-[1.25rem] h-5 px-1 flex items-center justify-center rounded-full shadow-md">
                                                {unreadCount > 99 ? '99+' : unreadCount}
                                            </span>
                                        )}
                                    </motion.button>
                                )}
                            </AnimatePresence>
                            {isSelectionMode ? (
                                <div className="flex-shrink-0 bg-[var(--bg-primary)] border border-[var(--border-color)] p-3 mx-2 mb-2 rounded-2xl flex items-center justify-between shadow-lg">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => { setIsSelectionMode(false); setSelectedMessageIndices([]); }}
                                            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1.5 rounded-md hover:bg-[var(--bg-secondary)]"
                                        >
                                            <X size={20} />
                                        </button>
                                        <span className="text-[var(--text-primary)] font-bold text-sm">{selectedMessageIndices.length} Selected</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => {
                                                if (selectedMessageIndices.length === 0) return;
                                                const textToCopy = selectedMessageIndices.sort((a, b) => a - b).map(i => messages[i].text).join('\n\n');
                                                navigator.clipboard.writeText(textToCopy);
                                                setIsSelectionMode(false);
                                                setSelectedMessageIndices([]);
                                            }}
                                            disabled={selectedMessageIndices.length === 0}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors font-medium text-sm disabled:opacity-50"
                                        >
                                            <Copy size={16} /> Copy
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (selectedMessageIndices.length === 0) return;
                                                if (activeSessionId) {
                                                    // Delete them from highest index to lowest so indices don't shift
                                                    [...selectedMessageIndices].sort((a, b) => b - a).forEach(i => {
                                                        deleteMessage(activeSessionId, i);
                                                    });
                                                }
                                                setIsSelectionMode(false);
                                                setSelectedMessageIndices([]);
                                            }}
                                            disabled={selectedMessageIndices.length === 0}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors font-medium text-sm disabled:opacity-50"
                                        >
                                            <Trash2 size={16} /> Delete
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <motion.div layout layoutId="chat-input-wrapper" className="relative z-10">
                                    <ChatInput
                                        inputValue={inputValue}
                                        setInputValue={setInputValue}
                                        handleSendMessage={handleSendMessage}
                                        replyingTo={replyingTo}
                                        setReplyingTo={setReplyingTo}
                                    />
                                </motion.div>
                            )}
                        </div>
                    </>
                )}

                {selectionMenu && (
                    <div
                        className="fixed z-[100] bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg shadow-xl flex items-center p-1 gap-1 -translate-x-1/2 -translate-y-full"
                        style={{ left: selectionMenu.x, top: selectionMenu.y - 10, borderStyle: 'var(--border-style)' }}
                        onMouseDown={(e) => e.stopPropagation()} // Prevent closing immediately when clicking inside
                    >
                        <button
                            className="px-2.5 py-1.5 text-xs font-bold hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:text-[var(--accent-color)] transition-colors rounded-md flex items-center gap-1.5"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                navigator.clipboard.writeText(selectionMenu.text);
                                setSelectionMenu(null);
                            }}
                        >
                            <FileText size={14} /> Copy
                        </button>
                        <div className="w-px h-4 bg-[var(--border-color)]" />
                        <button
                            className="px-2.5 py-1.5 text-xs font-bold hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:text-[var(--accent-color)] transition-colors rounded-md flex items-center gap-1.5"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                setReplyingTo({ text: selectionMenu.text, messageIndex: selectionMenu.messageIndex, type: 'selection' });
                                setSelectionMenu(null);
                            }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" /></svg>
                            Reply
                        </button>
                        <div className="w-px h-4 bg-[var(--border-color)]" />
                        <button
                            className="px-2.5 py-1.5 text-xs font-bold hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:text-[var(--accent-color)] transition-colors rounded-md flex items-center gap-1.5"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                handleMessageHighlight(selectionMenu.messageIndex, selectionMenu.text);
                            }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z" /><path d="m5 2 5 5" /><path d="M2 13h15" /><path d="M22 20H7v-2h15z" /></svg>
                            Highlight
                        </button>
                    </div>
                )}

                {unhighlightMenu && (
                    <div
                        className="fixed z-[100] bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg shadow-xl flex items-center p-1 gap-1 -translate-x-1/2 -translate-y-full"
                        style={{ left: unhighlightMenu.x, top: unhighlightMenu.y - 10, borderStyle: 'var(--border-style)' }}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <button
                            className="px-2.5 py-1.5 text-xs font-bold hover:bg-red-500/10 text-red-400 hover:text-red-500 transition-colors rounded-md flex items-center gap-1.5"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                handleMessageRemoveHighlight(unhighlightMenu.messageIndex, unhighlightMenu.text);
                            }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l18 18M15 9l-6 6" /></svg>
                            Remove Highlight
                        </button>
                    </div>
                )}
            </div>

            {splitPaneWidth < 100 && (
                <>
                    <div
                        className="w-1.5 h-full cursor-col-resize z-20 bg-transparent relative resizer-hover select-none flex-shrink-0"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            setIsDragging(true);
                        }}
                    />

                    <div
                        style={{ width: `${100 - splitPaneWidth}%` }}
                        className="h-full flex flex-col bg-[var(--bg-secondary)] overflow-hidden"
                    >
                        <div
                            className="h-14 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-tertiary)] flex-shrink-0 px-2"
                            style={{ borderStyle: 'var(--border-style)' }}
                        >
                            <div className="flex gap-1">
                                <button
                                    onClick={() => setActiveTab('editor')}
                                    className={`px-3 py-1.5 text-xs font-bold rounded tracking-wide uppercase flex items-center gap-1.5 transition-colors ${activeTab === 'editor'
                                        ? 'bg-[var(--bg-primary)] text-[var(--accent-color)] border border-[var(--border-color)]'
                                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                        }`}
                                    style={{ borderStyle: activeTab === 'editor' ? 'var(--border-style)' : 'none' }}
                                >
                                    <FileCode className="w-3.5 h-3.5" />
                                    main.ts
                                </button>
                                <button
                                    onClick={() => setActiveTab('pdf')}
                                    className={`px-3 py-1.5 text-xs font-bold rounded tracking-wide uppercase flex items-center gap-1.5 transition-colors ${activeTab === 'pdf'
                                        ? 'bg-[var(--bg-primary)] text-[var(--accent-color)] border border-[var(--border-color)]'
                                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                        }`}
                                    style={{ borderStyle: activeTab === 'pdf' ? 'var(--border-style)' : 'none' }}
                                >
                                    <FileText className="w-3.5 h-3.5" />
                                    engine_spec.pdf
                                </button>
                            </div>

                            <div className="flex items-center gap-1">
                                <button className="p-1.5 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors active:scale-95">
                                    <Play className="w-3.5 h-3.5 text-emerald-500" />
                                </button>
                                <button className="p-1.5 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors active:scale-95">
                                    <Maximize2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        {/* Workspace body */}
                        <div className="flex-1 overflow-auto bg-[var(--bg-primary)] p-4 font-mono text-sm relative">
                            {activeTab === 'editor' ? (
                                <textarea
                                    className="w-full h-full bg-transparent border-0 outline-none resize-none font-mono text-xs md:text-sm leading-relaxed text-[var(--text-primary)]"
                                    value={codeContent}
                                    onChange={(e) => setCodeContent(e.target.value)}
                                    spellCheck={false}
                                />
                            ) : (
                                <div className="space-y-4 text-xs md:text-sm text-[var(--text-secondary)] leading-relaxed">
                                    <div className="border-b border-[var(--border-color)] pb-2 mb-2">
                                        <h3 className="text-sm font-bold text-[var(--accent-color)] uppercase tracking-wider">CLUAIZE ENGINE ARCHITECTURE SPECIFICATIONS</h3>
                                        <p className="text-[var(--text-muted)] text-xs">Document Version: v1.0.3 | Reference Node: CLZ-9892</p>
                                    </div>
                                    <p>
                                        <strong>1. System Overview:</strong> The Cluaize Engine is designed to facilitate native compilation routing for both web and Tauri-powered desktop architectures. Theme assets are decoupled from UI code via standardized variables.
                                    </p>
                                    <p>
                                        <strong>2. Component Isolation:</strong> Every visual unit exists inside isolated namespaces. Reusability is achieved through structural bindings. Accents are fed dynamically from state machines.
                                    </p>
                                    <p>
                                        <strong>3. Memory Map limits:</strong>
                                    </p>
                                    <ul className="list-disc list-inside pl-2 space-y-1">
                                        <li>Global Cache: 512MB RAM</li>
                                        <li>Local Context Token Buffer: 8192 tokens</li>
                                        <li>Worker Thread Pools: 4 parallel threads</li>
                                    </ul>
                                    <div className="p-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded mt-4" style={{ borderStyle: 'var(--border-style)' }}>
                                        <p className="text-xs font-semibold text-[var(--accent-color)] uppercase flex items-center gap-1.5">
                                            <Database className="w-3.5 h-3.5" />
                                            Active Database Handshake
                                        </p>
                                        <p className="text-[var(--text-muted)] text-xs mt-1">
                                            Local DB engine linked via socket IPC. Sync completed at standard tick 19892.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {msgMenu?.isOpen && (
                <MessageContextMenu
                    x={msgMenu.x}
                    y={msgMenu.y}
                    isOpen={msgMenu.isOpen}
                    isPinned={msgMenu.isPinned}
                    isStarred={msgMenu.isStarred}
                    onClose={() => setMsgMenu(null)}
                    onAction={(act) => handleMessageAction(act, msgMenu.messageIndex)}
                    onReact={(emoji) => handleMessageReact(emoji, msgMenu.messageIndex)}
                />
            )}

            {globalMenu?.isOpen && (
                <GlobalChatContextMenu
                    x={globalMenu.x}
                    y={globalMenu.y}
                    isOpen={globalMenu.isOpen}
                    onClose={() => setGlobalMenu(null)}
                    onAction={handleGlobalAction}
                />
            )}
        </div>
    );
}

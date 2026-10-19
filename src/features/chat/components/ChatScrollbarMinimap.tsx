import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { RichHoverCard } from '../../../components/ui/RichHoverCard';
import type { ChatMessage } from '../../../store/chat/useChatStore';

export interface ChatScrollbarMinimapProps {
    messages: ChatMessage[];
    containerRef: React.RefObject<HTMLDivElement | null>;
    sessionId?: string | null;
}

export interface MinimapTick {
    id: string;
    domId: string;
    turnIndex: number;
    userPrompt?: string;
    aiSnippet?: string;
    time?: string;
}

const STEP_REGEX = /\[(STEP \d+\/\d+[^\]\n]*)\]/i;

export const ChatScrollbarMinimap: React.FC<ChatScrollbarMinimapProps> = ({
    messages,
    containerRef,
    sessionId,
}) => {
    const [isScrollActive, setIsScrollActive] = useState(false);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [scrollActiveIdx, setScrollActiveIdx] = useState<number>(0);

    // [P30] Persistent Bookmarked Turn IDs via localStorage (per-session)
    const storageKey = `cluaiz_minimap_bookmarks_${sessionId || 'global'}`;
    const [bookmarkedTurnIds, setBookmarkedTurnIds] = useState<Set<string>>(() => {
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    return new Set(parsed);
                }
            }
        } catch {
            // ignore fallback
        }
        return new Set();
    });

    // Hydrate when sessionId changes
    useEffect(() => {
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    setBookmarkedTurnIds(new Set(parsed));
                    return;
                }
            }
        } catch {}
        setBookmarkedTurnIds(new Set());
    }, [storageKey]);

    const trackRef = useRef<HTMLDivElement>(null);
    const isDraggingRef = useRef(false);

    // Check if container has an active scrollbar (scrollHeight > clientHeight)
    const checkScrollable = useCallback(() => {
        const el = containerRef.current;
        if (!el) {
            setIsScrollActive(false);
            return;
        }
        const maxScroll = el.scrollHeight - el.clientHeight;
        const hasScroll = maxScroll > 24;
        setIsScrollActive(hasScroll);
    }, [containerRef]);

    // Group conversation by Turns: User Prompt + AI Response = 1 Single Dot/Tick
    const ticks = useMemo(() => {
        if (!messages || messages.length === 0) return [];

        const items: MinimapTick[] = [];
        let currentTurn: MinimapTick | null = null;

        messages.forEach((msg, idx) => {
            const rawText = (msg.text || '').trim();
            if (!rawText) return;

            const cleanText = rawText.replace(STEP_REGEX, '').trim();

            if (msg.sender === 'user') {
                const domId = `msg-turn-${msg.id || idx}`;
                currentTurn = {
                    id: msg.id || `turn-${items.length}`,
                    domId,
                    turnIndex: items.length + 1,
                    userPrompt: rawText.slice(0, 200),
                    time: msg.time,
                };
                items.push(currentTurn);
            } else if (msg.sender === 'assistant') {
                if (currentTurn && !currentTurn.aiSnippet) {
                    currentTurn.aiSnippet = cleanText.slice(0, 260) || rawText.slice(0, 260);
                } else {
                    const domId = `msg-turn-${msg.id || idx}`;
                    items.push({
                        id: msg.id || `turn-${items.length}`,
                        domId,
                        turnIndex: items.length + 1,
                        aiSnippet: cleanText.slice(0, 260) || rawText.slice(0, 260),
                        time: msg.time,
                    });
                }
            }
        });

        return items;
    }, [messages]);

    // [P31] Dynamically scale gap with comfortable floor (+1px to +2px wider spacing)
    const gapPx = useMemo(() => {
        if (ticks.length <= 15) return 8;
        if (ticks.length <= 30) return 6;
        return 5; // Minimum floor is 5px - never cramped or squished
    }, [ticks.length]);

    // Track exactly 1 active scroll position index (smooth single focal point)
    const updateActiveScrollIdx = useCallback(() => {
        const el = containerRef.current;
        if (!el || ticks.length === 0) {
            setScrollActiveIdx(0);
            return;
        }
        const maxScroll = el.scrollHeight - el.clientHeight;
        if (maxScroll <= 0) {
            setScrollActiveIdx(ticks.length - 1);
            return;
        }
        const scrollRatio = Math.min(1, Math.max(0, el.scrollTop / maxScroll));
        const activeIdx = Math.min(ticks.length - 1, Math.max(0, Math.round(scrollRatio * (ticks.length - 1))));
        setScrollActiveIdx(activeIdx);
    }, [containerRef, ticks]);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        checkScrollable();
        updateActiveScrollIdx();

        const handleScroll = () => {
            updateActiveScrollIdx();
        };

        el.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('resize', () => {
            checkScrollable();
            updateActiveScrollIdx();
        });

        const ro = new ResizeObserver(() => {
            checkScrollable();
            updateActiveScrollIdx();
        });
        ro.observe(el);

        return () => {
            el.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', checkScrollable);
            ro.disconnect();
        };
    }, [containerRef, messages, checkScrollable, updateActiveScrollIdx]);

    // [P32] Click-to-Scroll with targeted message pulse highlight and reliable container scrolling
    const handleScrollToTurn = (domId: string) => {
        const el = document.getElementById(domId);
        const container = containerRef.current;
        if (el && container) {
            const containerRect = container.getBoundingClientRect();
            const elRect = el.getBoundingClientRect();
            const targetScrollTop = container.scrollTop + (elRect.top - containerRect.top) - (containerRect.height / 2) + (elRect.height / 2);
            container.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });

            el.classList.remove('chat-turn-focused');
            // Force reflow
            void el.offsetWidth;
            el.classList.add('chat-turn-focused');
            setTimeout(() => {
                el.classList.remove('chat-turn-focused');
            }, 1800);
        } else if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };

    // Scrub / Drag-to-scroll handler along the minimap track
    const handleScrub = useCallback((clientY: number) => {
        const el = containerRef.current;
        const track = trackRef.current;
        if (!el || !track) return;

        const rect = track.getBoundingClientRect();
        const relativeY = Math.min(rect.height, Math.max(0, clientY - rect.top));
        const ratio = rect.height > 0 ? relativeY / rect.height : 0;
        const maxScroll = el.scrollHeight - el.clientHeight;
        if (maxScroll > 0) {
            el.scrollTop = ratio * maxScroll;
        }
    }, [containerRef]);

    const handleMouseDown = (e: React.MouseEvent) => {
        isDraggingRef.current = true;
        handleScrub(e.clientY);

        const handleMouseMove = (moveEvent: MouseEvent) => {
            if (isDraggingRef.current) {
                handleScrub(moveEvent.clientY);
            }
        };

        const handleMouseUp = () => {
            isDraggingRef.current = false;
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    // [P30] Bookmark toggle with immediate localStorage persistence
    const handleToggleBookmark = (turnId: string) => {
        setBookmarkedTurnIds((prev) => {
            const next = new Set(prev);
            if (next.has(turnId)) {
                next.delete(turnId);
            } else {
                next.add(turnId);
            }
            try {
                localStorage.setItem(storageKey, JSON.stringify(Array.from(next)));
            } catch (err) {
                console.warn('[Minimap] Failed to persist bookmark to localStorage:', err);
            }
            return next;
        });
    };

    const activeTickRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Keep active tick in view inside the bounded minimap rail
    useEffect(() => {
        if (activeTickRef.current) {
            activeTickRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [scrollActiveIdx]);

    // Calculate if user is at the top or bottom of the conversation
    const isAtTop = scrollActiveIdx <= 1;
    const isAtBottom = scrollActiveIdx >= ticks.length - 2;

    const maskGradient = useMemo(() => {
        if (ticks.length <= 10) return 'none';
        if (isAtBottom && !isAtTop) {
            // User is at bottom: bottom is 100% solid, top is smoke faded
            return 'linear-gradient(to bottom, transparent 0%, black 16%, black 100%)';
        }
        if (isAtTop && !isAtBottom) {
            // User is at top: top is 100% solid, bottom is smoke faded
            return 'linear-gradient(to bottom, black 0%, black 84%, transparent 100%)';
        }
        // Middle: both edges smoothly smoke fade
        return 'linear-gradient(to bottom, transparent 0%, black 16%, black 84%, transparent 100%)';
    }, [isAtTop, isAtBottom, ticks.length]);

    // Rule: Tabhi active hoga jab container scrollable ho
    if (!isScrollActive || ticks.length === 0) {
        return null;
    }

    return (
        <div
            ref={trackRef}
            aria-label="Chat scrollbar minimap"
            className="absolute left-3.5 top-16 z-30 pointer-events-auto flex flex-col items-start select-none animate-fade-in py-1 cursor-default hidden lg:flex"
            style={{
                maxHeight: 'calc(100vh - 240px)',
            }}
            onMouseLeave={() => setHoveredIndex(null)}
            onMouseDown={handleMouseDown}
            onWheel={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (scrollContainerRef.current) {
                    scrollContainerRef.current.scrollTop += e.deltaY;
                }
            }}
        >
            {/* Vertically centered column of turns with magnetic hover & live scrubbing */}
            <div
                ref={scrollContainerRef}
                className="flex flex-col items-start py-2 max-h-full overflow-y-auto no-scrollbar"
                style={{
                    gap: `${gapPx}px`,
                    maskImage: maskGradient,
                    WebkitMaskImage: maskGradient,
                }}
            >
                {ticks.map((tick, idx) => {
                    const isBookmarked = bookmarkedTurnIds.has(tick.id);

                    // Strictly ONE active focal point at any given moment:
                    // If hovered: hovered tick is center of wave.
                    // If not hovered: scrollActiveIdx is the single active tick.
                    let widthPx = 8;
                    let opacity = 0.28;
                    let isCenter = false;

                    if (hoveredIndex !== null) {
                        const dist = Math.abs(idx - hoveredIndex);
                        if (dist === 0) {
                            widthPx = 22;
                            opacity = 1;
                            isCenter = true;
                        } else if (dist === 1) {
                            widthPx = 16;
                            opacity = 0.8;
                        } else if (dist === 2) {
                            widthPx = 12;
                            opacity = 0.6;
                        } else if (dist === 3) {
                            widthPx = 10;
                            opacity = 0.45;
                        } else {
                            widthPx = 8;
                            opacity = 0.25;
                        }
                    } else if (idx === scrollActiveIdx) {
                        widthPx = 14;
                        opacity = 1;
                        isCenter = true;
                    }

                    // [P34] ChatGPT style top & bottom smooth dim/smoke effect (disabled on active edge)
                    const totalTicks = ticks.length;
                    let edgeDimFactor = 1;
                    if (totalTicks > 12) {
                        const fadeCount = Math.min(6, Math.floor(totalTicks * 0.16));
                        if (idx < fadeCount && !isAtTop) {
                            edgeDimFactor = 0.25 + 0.75 * ((idx + 1) / (fadeCount + 1));
                        } else if (idx >= totalTicks - fadeCount && !isAtBottom) {
                            edgeDimFactor = 0.25 + 0.75 * ((totalTicks - idx) / (fadeCount + 1));
                        }
                    }

                    const finalOpacity = isCenter ? 1 : Math.max(0.12, opacity * edgeDimFactor);

                    return (
                        <div
                            key={tick.id}
                            ref={idx === scrollActiveIdx ? activeTickRef : undefined}
                            className="relative flex items-center shrink-0"
                            onMouseEnter={() => setHoveredIndex(idx)}
                        >
                            <RichHoverCard
                                usePortal={true}
                                userPrompt={tick.userPrompt}
                                aiSnippet={tick.aiSnippet}
                                isBookmarked={isBookmarked}
                                onToggleBookmark={() => handleToggleBookmark(tick.id)}
                                position="right"
                                onClick={() => handleScrollToTurn(tick.domId)}
                            >
                                {/* Generous magnetic hit box (py-1.5 px-1) with cursor-default and ZERO title attribute */}
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleScrollToTurn(tick.domId);
                                    }}
                                    className="py-1.5 -my-1.5 px-1 -mx-1 flex items-center cursor-default bg-transparent border-0 outline-none select-none"
                                >
                                    <span
                                        style={{
                                            width: `${widthPx}px`,
                                            opacity: finalOpacity,
                                        }}
                                        className={`h-[2px] rounded-[1px] transition-all duration-120 ease-out block ${
                                            isCenter
                                                ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.85)]'
                                                : 'bg-white'
                                        }`}
                                    />
                                    {/* Bookmark Indicator Dot in Theme Color (Exact 2px x 2px matching tick height) */}
                                    {isBookmarked && (
                                        <span className="w-[2px] h-[2px] rounded-[1px] bg-[var(--accent-color)] ml-[2px] shrink-0 block" />
                                    )}
                                </button>
                            </RichHoverCard>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

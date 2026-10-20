import React, {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
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
const TICK_HEIGHT = 5;
const EDGE_FADE_ROWS = 6;
const SCROLL_EPSILON = 3;
const DRAG_THRESHOLD = 5;

interface RailMetrics {
    scrollTop: number;
    clientHeight: number;
    maxScroll: number;
    firstRowOffset: number;
}

interface DragState {
    pointerId: number;
    startY: number;
    didDrag: boolean;
}

export const ChatScrollbarMinimap: React.FC<ChatScrollbarMinimapProps> = ({
    messages,
    containerRef,
    sessionId,
}) => {
    const [isScrollActive, setIsScrollActive] = useState(false);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [scrollActiveIdx, setScrollActiveIdx] = useState(0);
    const [railMetrics, setRailMetrics] = useState<RailMetrics>({
        scrollTop: 0,
        clientHeight: 0,
        maxScroll: 0,
        firstRowOffset: 0,
    });

    const railRef = useRef<HTMLDivElement>(null);
    const activeTickRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<DragState | null>(null);
    const suppressClickUntilRef = useRef(0);
    const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const railAnimationRef = useRef<number | null>(null);
    const railCenteredRef = useRef(false);

    const storageKey = `cluaiz_minimap_bookmarks_${sessionId || 'global'}`;
    const [bookmarkedTurnIds, setBookmarkedTurnIds] = useState<Set<string>>(
        () => {
            try {
                const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) || '[]');
                if (Array.isArray(parsed)) {
                    return new Set(parsed.filter((id): id is string => typeof id === 'string'));
                }
            } catch {
                // Storage may be unavailable (private mode / server render).
            }
            return new Set();
        },
    );

    useEffect(() => {
        try {
            const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) || '[]');
            setBookmarkedTurnIds(
                Array.isArray(parsed)
                    ? new Set(parsed.filter((id): id is string => typeof id === 'string'))
                    : new Set(),
            );
        } catch {
            setBookmarkedTurnIds(new Set());
        }
    }, [storageKey]);

    const ticks = useMemo(() => {
        if (!messages?.length) return [] as MinimapTick[];

        const items: MinimapTick[] = [];
        let currentTurn: MinimapTick | null = null;

        messages.forEach((msg, idx) => {
            const rawText = (msg.text || '').trim();
            if (!rawText) return;

            const cleanText = rawText.replace(STEP_REGEX, '').trim();
            if (msg.sender === 'user') {
                currentTurn = {
                    id: String(msg.id || `turn-${idx}`),
                    domId: `msg-turn-${msg.id || idx}`,
                    turnIndex: items.length + 1,
                    userPrompt: rawText.slice(0, 200),
                    time: msg.time,
                };
                items.push(currentTurn);
            } else if (msg.sender === 'assistant') {
                if (currentTurn && !currentTurn.aiSnippet) {
                    currentTurn.aiSnippet = cleanText.slice(0, 260) || rawText.slice(0, 260);
                } else {
                    items.push({
                        id: String(msg.id || `turn-${idx}`),
                        domId: `msg-turn-${msg.id || idx}`,
                        turnIndex: items.length + 1,
                        aiSnippet: cleanText.slice(0, 260) || rawText.slice(0, 260),
                        time: msg.time,
                    });
                }
            }
        });
        return items;
    }, [messages]);

    const gapPx = 3; // Keep the compact 5px tick + 3px gap spacing.

    const findTurn = useCallback(
        (domId: string): HTMLElement | null => {
            const container = containerRef.current;
            const target = document.getElementById(domId);
            return container && target && container.contains(target) ? target : null;
        },
        [containerRef],
    );

    const getFocalOffset = useCallback((container: HTMLDivElement) => {
        return Math.min(220, container.clientHeight * 0.4);
    }, []);

    const checkScrollable = useCallback(() => {
        const container = containerRef.current;
        setIsScrollActive(
            Boolean(container && container.scrollHeight - container.clientHeight > 24),
        );
    }, [containerRef]);

    const updateActiveScrollIdx = useCallback(() => {
        const container = containerRef.current;
        if (!container || ticks.length === 0) {
            setScrollActiveIdx(0);
            return;
        }

        const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
        if (container.scrollTop <= 15 || maxScroll === 0) {
            setScrollActiveIdx(0);
            return;
        }
        if (container.scrollTop >= maxScroll - 25) {
            setScrollActiveIdx(ticks.length - 1);
            return;
        }

        // Same reading anchor is used by click and by scroll tracking.
        const focalY = container.getBoundingClientRect().top + getFocalOffset(container);
        let index = 0;
        for (let i = 0; i < ticks.length; i += 1) {
            const target = findTurn(ticks[i].domId);
            if (!target) continue;
            if (target.getBoundingClientRect().top <= focalY) index = i;
            else break;
        }
        setScrollActiveIdx(index);
    }, [containerRef, findTurn, getFocalOffset, ticks]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const sync = () => {
            checkScrollable();
            updateActiveScrollIdx();
        };
        sync();
        const onScroll = () => updateActiveScrollIdx();
        container.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', sync);
        const resizeObserver = new ResizeObserver(sync);
        resizeObserver.observe(container);

        return () => {
            container.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', sync); // Same function attached/removed.
            resizeObserver.disconnect();
        };
    }, [containerRef, checkScrollable, updateActiveScrollIdx]);

    const updateRailMetrics = useCallback(() => {
        const rail = railRef.current;
        if (!rail) return;
        const firstRow = rail.querySelector<HTMLElement>('[data-minimap-index="0"]');
        const next: RailMetrics = {
            scrollTop: rail.scrollTop,
            clientHeight: rail.clientHeight,
            maxScroll: Math.max(0, rail.scrollHeight - rail.clientHeight),
            firstRowOffset: firstRow?.offsetTop ?? 0,
        };
        setRailMetrics((prev) =>
            Math.abs(prev.scrollTop - next.scrollTop) < 0.5 &&
                prev.clientHeight === next.clientHeight &&
                Math.abs(prev.maxScroll - next.maxScroll) < 0.5 &&
                Math.abs(prev.firstRowOffset - next.firstRowOffset) < 0.5
                ? prev
                : next,
        );
    }, []);

    // Only move the minimap's own rail. Never call scrollIntoView() on a tick:
    // it can also scroll the CHAT and recreate the click/reload feedback loop.
    // Initial alignment is immediate; subsequent active-turn changes ease smoothly.
    useLayoutEffect(() => {
        if (!isScrollActive || dragRef.current?.didDrag) return;
        const rail = railRef.current;
        const active = activeTickRef.current;
        if (!rail || !active) return;

        if (railAnimationRef.current !== null) {
            cancelAnimationFrame(railAnimationRef.current);
            railAnimationRef.current = null;
        }

        const maxScroll = Math.max(0, rail.scrollHeight - rail.clientHeight);
        const desiredTop = Math.max(
            0,
            Math.min(maxScroll, active.offsetTop + active.offsetHeight / 2 - rail.clientHeight / 2),
        );

        // Avoid a visible travel animation on page reload / initial render.
        if (!railCenteredRef.current) {
            rail.scrollTop = desiredTop;
            railCenteredRef.current = true;
            updateRailMetrics();
            return;
        }

        if (Math.abs(rail.scrollTop - desiredTop) <= 0.5) {
            updateRailMetrics();
            return;
        }

        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
            rail.scrollTop = desiredTop;
            updateRailMetrics();
            return;
        }

        // Frame-based easing follows rapid chat-scroll changes without restarting
        // native smooth-scroll animations and without snapping from turn to turn.
        let lastFrameTime: number | null = null;
        const animate = (time: number) => {
            const frameMs = lastFrameTime === null ? 16 : Math.min(64, time - lastFrameTime);
            lastFrameTime = time;
            const difference = desiredTop - rail.scrollTop;
            if (Math.abs(difference) <= 0.5) {
                rail.scrollTop = desiredTop;
                railAnimationRef.current = null;
                updateRailMetrics();
                return;
            }
            const blend = 1 - Math.exp(-frameMs / 80);
            rail.scrollTop += difference * blend;
            updateRailMetrics();
            railAnimationRef.current = requestAnimationFrame(animate);
        };
        railAnimationRef.current = requestAnimationFrame(animate);

        return () => {
            if (railAnimationRef.current !== null) {
                cancelAnimationFrame(railAnimationRef.current);
                railAnimationRef.current = null;
            }
        };
    }, [isScrollActive, scrollActiveIdx, ticks.length, railMetrics.clientHeight, updateRailMetrics]);

    useEffect(() => {
        if (!isScrollActive || !railRef.current) return;
        updateRailMetrics();
        const observer = new ResizeObserver(updateRailMetrics);
        observer.observe(railRef.current);
        window.addEventListener('resize', updateRailMetrics);
        return () => {
            observer.disconnect();
            window.removeEventListener('resize', updateRailMetrics);
        };
    }, [isScrollActive, ticks.length, updateRailMetrics]);

    useEffect(() => {
        return () => {
            if (highlightTimeoutRef.current !== null) {
                clearTimeout(highlightTimeoutRef.current);
            }
        };
    }, []);

    const pulseTurn = useCallback((element: HTMLElement) => {
        if (highlightTimeoutRef.current !== null) clearTimeout(highlightTimeoutRef.current);
        element.classList.remove('chat-turn-focused');
        void element.offsetWidth;
        element.classList.add('chat-turn-focused');
        highlightTimeoutRef.current = setTimeout(() => {
            element.classList.remove('chat-turn-focused');
            highlightTimeoutRef.current = null;
        }, 1800);
    }, []);

    const scrollToTurn = useCallback(
        (index: number, behavior: ScrollBehavior = 'smooth', highlight = false) => {
            const container = containerRef.current;
            const tick = ticks[index];
            const target = tick ? findTurn(tick.domId) : null;
            if (!container || !target) return;

            const containerRect = container.getBoundingClientRect();
            const targetRect = target.getBoundingClientRect();
            const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
            const desiredScroll =
                index === 0
                    ? 0
                    : index === ticks.length - 1
                        ? maxScroll
                        : container.scrollTop +
                        (targetRect.top - containerRect.top) -
                        getFocalOffset(container);
            const clamped = Math.max(0, Math.min(maxScroll, desiredScroll));

            // If the selected active turn is already visible, do NOT recenter it.
            // Also do not repeat near-identical scroll commands during smoothing.
            const isVisible =
                targetRect.bottom > containerRect.top + 8 &&
                targetRect.top < containerRect.bottom - 8;
            const alreadyHere =
                (index === scrollActiveIdx && isVisible) ||
                Math.abs(container.scrollTop - clamped) <= SCROLL_EPSILON;

            if (!alreadyHere) {
                container.scrollTo({ top: clamped, behavior });
            }
            if (highlight) pulseTurn(target);
        },
        [containerRef, findTurn, getFocalOffset, pulseTurn, scrollActiveIdx, ticks],
    );

    // Pointer-down never scrolls. A real drag starts after the threshold;
    // ordinary clicks therefore perform exactly ONE navigation.
    const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return;
        dragRef.current = {
            pointerId: event.pointerId,
            startY: event.clientY,
            didDrag: false,
        };
    };

    const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        const rail = railRef.current;
        if (!drag || drag.pointerId !== event.pointerId || !rail) return;
        if (!drag.didDrag && Math.abs(event.clientY - drag.startY) < DRAG_THRESHOLD) return;

        if (!drag.didDrag) {
            drag.didDrag = true;
            rail.setPointerCapture(event.pointerId);
        }
        event.preventDefault();
        const rect = rail.getBoundingClientRect();
        const contentY = event.clientY - rect.top + rail.scrollTop;
        const firstRow = rail.querySelector<HTMLElement>('[data-minimap-index="0"]');
        const firstRowTop = firstRow?.offsetTop ?? 0;
        const index = Math.min(
            ticks.length - 1,
            Math.max(0, Math.round((contentY - firstRowTop - TICK_HEIGHT / 2) / (TICK_HEIGHT + gapPx))),
        );
        setHoveredIndex(index);
        scrollToTurn(index, 'auto');
    };

    const finishPointer = (event: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        if (drag.didDrag) {
            suppressClickUntilRef.current = Date.now() + 250;
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
            }
        }
        dragRef.current = null;
    };

    const handleToggleBookmark = (turnId: string) => {
        setBookmarkedTurnIds((previous) => {
            const next = new Set(previous);
            if (next.has(turnId)) next.delete(turnId);
            else next.add(turnId);
            try {
                localStorage.setItem(storageKey, JSON.stringify(Array.from(next)));
            } catch {
                // Bookmark still works for this mounted session.
            }
            return next;
        });
    };

    // EXACTLY ONE luminous focal line: hover overrides the scroll-active line.
    // On pointer exit it smoothly returns to the actual active chat turn.
    const focusedIndex = hoveredIndex ?? scrollActiveIdx;
    const fadePx = Math.min(
        EDGE_FADE_ROWS * (TICK_HEIGHT + gapPx),
        Math.max(0, railMetrics.clientHeight / 3),
    );
    const focalY =
        railMetrics.firstRowOffset + focusedIndex * (TICK_HEIGHT + gapPx) -
        railMetrics.scrollTop + TICK_HEIGHT / 2;
    // While hovering near an edge, its smoke clears; moving away restores it.
    const clearTopFade =
        hoveredIndex !== null && focalY >= 0 && focalY <= fadePx;
    const clearBottomFade =
        hoveredIndex !== null &&
        focalY >= railMetrics.clientHeight - fadePx &&
        focalY <= railMetrics.clientHeight;

    if (!isScrollActive || ticks.length === 0) return null;

    return (
        <div
            aria-label="Chat scrollbar minimap"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 z-30 hidden lg:flex pointer-events-auto select-none"
            onMouseLeave={() => setHoveredIndex(null)}
        >
            <div
                ref={railRef}
                className="relative flex flex-col items-start overflow-y-auto no-scrollbar"
                style={{
                    width: '38px',
                    // Fixed viewing window + symmetric spacers: turn 1 truly starts
                    // in the CENTER, never at the top of a long minimap.
                    height: 'calc(100dvh - 160px)',
                    padding: '0 4px',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    // Fade individual ticks, not the entire rail. This keeps the
                    // hovered/active line bright and avoids hard mask switches.
                    scrollBehavior: 'auto',
                    touchAction: 'none',
                }}
                onScroll={updateRailMetrics}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={finishPointer}
                onPointerCancel={finishPointer}
                onClickCapture={(event) => {
                    if (Date.now() < suppressClickUntilRef.current) {
                        event.preventDefault();
                        event.stopPropagation();
                        suppressClickUntilRef.current = 0;
                    }
                }}
                onWheel={(event) => {
                    event.stopPropagation();
                    // The wheel explores the minimap, not the chat.
                    // Browser's native rail scrolling handles the delta.
                }}
            >
                {/* 50% of rail height minus half a tick. Allows first/last turn to center. */}
                <div
                    aria-hidden="true"
                    className="shrink-0"
                    style={{ height: 'max(0px, calc(50dvh - 87px))' }}
                />
                <div className="flex flex-col items-start shrink-0" style={{ gap: `${gapPx}px` }}>
                    {ticks.map((tick, index) => {
                        const isBookmarked = bookmarkedTurnIds.has(tick.id);
                        const isActive = index === scrollActiveIdx;
                        const isFocal = index === focusedIndex; // Never isActive || isHovered.
                        const distance = Math.abs(index - focusedIndex);
                        const widthPx = hoveredIndex === null
                            ? (index === scrollActiveIdx ? 12 : 8)
                            : distance === 0 ? 22 : distance === 1 ? 16 : distance === 2 ? 12 : distance === 3 ? 10 : 8;
                        const baseOpacity = distance === 0 ? 1 : distance === 1 ? 0.82 : distance === 2 ? 0.58 : distance === 3 ? 0.43 : 0.30;

                        // Fade the outer 6 VISIBLE rows (not the first/last 6
                        // messages). Keep the sole focal bar at full brightness.
                        const y = railMetrics.firstRowOffset + index * (TICK_HEIGHT + gapPx) - railMetrics.scrollTop + TICK_HEIGHT / 2;
                        const topFactor = clearTopFade || fadePx <= 0 ? 1 : Math.min(1, Math.max(0.14, y / fadePx));
                        const bottomFactor = clearBottomFade || fadePx <= 0 ? 1 : Math.min(1, Math.max(0.14, (railMetrics.clientHeight - y) / fadePx));
                        const opacity = isFocal ? 1 : baseOpacity * Math.min(topFactor, bottomFactor);

                        return (
                            <div
                                key={tick.id}
                                data-minimap-index={index}
                                ref={isActive ? activeTickRef : undefined}
                                className="relative flex shrink-0 items-center"
                                style={{ height: `${TICK_HEIGHT}px` }}
                                onMouseEnter={() => setHoveredIndex(index)}
                            >
                                <RichHoverCard
                                    usePortal={true}
                                    userPrompt={tick.userPrompt}
                                    aiSnippet={tick.aiSnippet}
                                    isBookmarked={isBookmarked}
                                    onToggleBookmark={() => handleToggleBookmark(tick.id)}
                                    position="right"
                                >
                                    <button
                                        type="button"
                                        aria-label={`Go to conversation turn ${tick.turnIndex}`}
                                        aria-current={isActive ? 'location' : undefined}
                                        onClick={() => scrollToTurn(index, 'smooth', true)}
                                        className="flex items-center bg-transparent border-0 outline-none select-none cursor-pointer"
                                        style={{ height: `${TICK_HEIGHT}px`, padding: '0 1px' }}
                                    >
                                        <span
                                            className="block h-[2px] rounded-[1px] bg-white"
                                            style={{
                                                width: `${widthPx}px`,
                                                opacity,
                                                boxShadow: hoveredIndex === index
                                                    ? '0 0 8px 1px rgba(255,255,255,0.85)'
                                                    : 'none',
                                                transition: 'width 220ms cubic-bezier(0.2,0.8,0.2,1), opacity 220ms ease, box-shadow 220ms ease',
                                            }}
                                        />
                                        {isBookmarked && (
                                            <span className="ml-[2px] block h-[2px] w-[2px] shrink-0 rounded-[1px] bg-[var(--accent-color)]" />
                                        )}
                                    </button>
                                </RichHoverCard>
                            </div>
                        );
                    })}
                </div>
                <div
                    aria-hidden="true"
                    className="shrink-0"
                    style={{ height: 'max(0px, calc(50dvh - 87px))' }}
                />
            </div>
        </div>
    );
};
//////
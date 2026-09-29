import { useState, useEffect, useRef, useCallback } from 'react';

interface UseChatScrollProps {
    messages: any[];
    isStreaming?: boolean;
}

export const useChatScroll = ({ messages, isStreaming = false }: UseChatScrollProps) => {
    const viewportRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const prevMsgLengthRef = useRef(messages.length);

    const lastMsg = messages[messages.length - 1];
    const lastContentLength = (lastMsg?.text?.length || 0) + (lastMsg?.thinking?.length || 0) + (lastMsg?.postToolThinking?.length || 0);
    const prevContentLengthRef = useRef(0);

    const [unreadCount, setUnreadCount] = useState(0);
    const [isAtBottom, setIsAtBottom] = useState(true);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [isHeaderVisible, setIsHeaderVisible] = useState(true);
    const lastScrollTopRef = useRef(0);
    const isProgrammaticScrollRef = useRef(false);
    const scrollTimeoutRef = useRef<any>(null);

    // User interaction guard: prevents auto-scroll from hijacking manual scrolling
    const userInteractingRef = useRef(false);
    const userInteractionTimerRef = useRef<any>(null);

    const scrollToBottom = useCallback((instant = false) => {
        if (!viewportRef.current) return;

        // Never fight the user's manual scroll
        if (userInteractingRef.current) return;

        const viewport = viewportRef.current;
        const targetScroll = viewport.scrollHeight - viewport.clientHeight;

        // Skip if already at bottom (within 2px tolerance)
        if (Math.abs(viewport.scrollTop - targetScroll) < 2) return;

        isProgrammaticScrollRef.current = true;
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);

        viewport.scrollTo({
            top: targetScroll,
            behavior: instant ? 'auto' : 'smooth'
        });

        // Release programmatic lock after animation
        scrollTimeoutRef.current = setTimeout(() => {
            isProgrammaticScrollRef.current = false;
        }, instant ? 50 : 400);
    }, []);

    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        const isCloseToBottom = distanceFromBottom < 30;

        const delta = scrollTop - lastScrollTopRef.current;

        if (!isProgrammaticScrollRef.current) {
            // Require at least a 10px intentional scroll to change header visibility
            if (Math.abs(delta) > 10) {
                if (delta > 0 && scrollTop > 50) {
                    setIsHeaderVisible(false);
                } else if (delta < 0) {
                    setIsHeaderVisible(true);
                }
                lastScrollTopRef.current = scrollTop;
            }
        } else {
            // Always keep lastScrollTop updated even during programmatic scrolls
            lastScrollTopRef.current = scrollTop;
        }

        setIsAtBottom(isCloseToBottom);
        setShowScrollButton(distanceFromBottom > 300);

        if (isCloseToBottom) {
            setUnreadCount(0);
        }
    }, []);

    // Register wheel/touch listeners to detect user manual scroll interaction
    useEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport) return;

        const markUserInteracting = () => {
            userInteractingRef.current = true;
            // Clear any pending programmatic scroll lock
            isProgrammaticScrollRef.current = false;

            if (userInteractionTimerRef.current) clearTimeout(userInteractionTimerRef.current);
            // Release user interaction lock after 800ms of no wheel/touch activity
            userInteractionTimerRef.current = setTimeout(() => {
                userInteractingRef.current = false;
            }, 800);
        };

        viewport.addEventListener('wheel', markUserInteracting, { passive: true });
        viewport.addEventListener('touchstart', markUserInteracting, { passive: true });
        viewport.addEventListener('touchmove', markUserInteracting, { passive: true });

        return () => {
            viewport.removeEventListener('wheel', markUserInteracting);
            viewport.removeEventListener('touchstart', markUserInteracting);
            viewport.removeEventListener('touchmove', markUserInteracting);
            if (userInteractionTimerRef.current) clearTimeout(userInteractionTimerRef.current);
        };
    }, []);

    // Initial Scroll
    useEffect(() => {
        const timer = setTimeout(() => {
            scrollToBottom(true);
        }, 100);
        return () => clearTimeout(timer);
    }, [scrollToBottom]);

    // Handle New Messages
    useEffect(() => {
        if (messages.length === 0) return;

        const isNewMessage = messages.length > prevMsgLengthRef.current;
        const msgDiff = messages.length - prevMsgLengthRef.current;
        prevMsgLengthRef.current = messages.length;

        if (!isNewMessage) return;

        if (isAtBottom) {
            scrollToBottom();
            setTimeout(() => scrollToBottom(), 100);
            setUnreadCount(0);
        } else {
            setUnreadCount(prev => prev + msgDiff);
        }
    }, [messages, isAtBottom, scrollToBottom]);

    // Handle Streaming Tokens & Content Expansion
    useEffect(() => {
        if (!isAtBottom) return;

        if (lastContentLength !== prevContentLengthRef.current) {
            prevContentLengthRef.current = lastContentLength;
            requestAnimationFrame(() => {
                scrollToBottom(true);
            });
        }
    }, [lastContentLength, isAtBottom, scrollToBottom]);

    // Observer for size changes of inner content (debounced)
    useEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport) return;

        const target = viewport.firstElementChild || viewport;
        let rafId: number | null = null;

        const resizeObserver = new ResizeObserver(() => {
            if (!isAtBottom || userInteractingRef.current) return;

            // Debounce with rAF to avoid excessive scroll calls
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                scrollToBottom(true);
                rafId = null;
            });
        });

        resizeObserver.observe(target);
        return () => {
            resizeObserver.disconnect();
            if (rafId) cancelAnimationFrame(rafId);
        };
    }, [isAtBottom, scrollToBottom]);

    return {
        viewportRef,
        bottomRef,
        unreadCount,
        isAtBottom,
        showScrollButton,
        isHeaderVisible,
        handleScroll,
        scrollToBottom
    };
};

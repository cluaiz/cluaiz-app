import { useState, useEffect, useRef, useCallback } from 'react';

interface UseChatScrollProps {
    messages: any[];
}

export const useChatScroll = ({ messages }: UseChatScrollProps) => {
    const viewportRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const prevMsgLengthRef = useRef(messages.length);
    const prevScrollHeightRef = useRef(0);

    const [unreadCount, setUnreadCount] = useState(0);
    const [isAtBottom, setIsAtBottom] = useState(true);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [isHeaderVisible, setIsHeaderVisible] = useState(true);
    const lastScrollTopRef = useRef(0);
    const isProgrammaticScrollRef = useRef(false);
    const scrollTimeoutRef = useRef<any>(null);

    const scrollToBottom = useCallback((instant = false) => {
        if (!viewportRef.current) return;

        isProgrammaticScrollRef.current = true;
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);

        const viewport = viewportRef.current;
        const targetScroll = viewport.scrollHeight - viewport.clientHeight;

        viewport.scrollTo({
            top: targetScroll,
            behavior: instant ? 'auto' : 'smooth'
        });

        // Use a longer timeout for smooth scrolling
        scrollTimeoutRef.current = setTimeout(() => {
            isProgrammaticScrollRef.current = false;
        }, instant ? 100 : 500);
    }, []);

    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        const isCloseToBottom = distanceFromBottom < 20;

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

    // Observer for size changes
    useEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport) return;

        const resizeObserver = new ResizeObserver(() => {
            if (isAtBottom) {
                requestAnimationFrame(() => {
                    scrollToBottom(true);
                });
            }
        });

        resizeObserver.observe(viewport);
        return () => resizeObserver.disconnect();
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

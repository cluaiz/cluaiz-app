import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface TooltipProps {
    children: React.ReactNode;
    title: string;
    subtitle?: string;
    disabled?: boolean;
    position?: 'right' | 'top' | 'bottom' | 'bottom-end' | 'left';
    className?: string;
}

interface CoordsState {
    x: number;
    y: number;
    arrowX: number;
    actualPosition: 'top' | 'bottom' | 'right';
}

export function Tooltip({ children, title, subtitle, disabled = false, position = 'top', className = '' }: TooltipProps) {
    const [isVisible, setIsVisible] = useState(false);
    const triggerRef = useRef<HTMLElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const [coords, setCoords] = useState<CoordsState>({
        x: 0,
        y: 0,
        arrowX: 0,
        actualPosition: position === 'bottom' || position === 'bottom-end' ? 'bottom' : 'top'
    });

    const updateCoords = useCallback(() => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const tooltipEl = tooltipRef.current;

        const tooltipWidth = tooltipEl ? tooltipEl.offsetWidth : 260;
        const tooltipHeight = tooltipEl ? tooltipEl.offsetHeight : 44;
        const padding = 12;

        const triggerCenterX = rect.left + (rect.width / 2);

        // Horizontal and Vertical position with smart space detection & flip
        let actualPos: 'top' | 'bottom' | 'right' = 'top';
        let finalLeft = 0;
        let finalTop = 0;
        let arrowX = 0;

        if (position === 'right') {
            actualPos = 'right';
            finalLeft = rect.right + 10;
            if (finalLeft + tooltipWidth > window.innerWidth - padding) {
                finalLeft = Math.max(padding, rect.left - tooltipWidth - 10);
            }
            finalTop = rect.top + (rect.height / 2) - (tooltipHeight / 2);
        } else if (position === 'bottom' || position === 'bottom-end') {
            actualPos = 'bottom';
            const halfWidth = tooltipWidth / 2;
            const idealLeft = triggerCenterX - halfWidth;
            finalLeft = Math.max(padding, Math.min(window.innerWidth - tooltipWidth - padding, idealLeft));
            arrowX = Math.max(14, Math.min(tooltipWidth - 14, triggerCenterX - finalLeft));
            finalTop = rect.bottom + 8;
        } else {
            // 'top' is preferred: check if enough room above
            const halfWidth = tooltipWidth / 2;
            const idealLeft = triggerCenterX - halfWidth;
            finalLeft = Math.max(padding, Math.min(window.innerWidth - tooltipWidth - padding, idealLeft));
            arrowX = Math.max(14, Math.min(tooltipWidth - 14, triggerCenterX - finalLeft));
            const roomAbove = rect.top;
            if (roomAbove < tooltipHeight + 16) {
                actualPos = 'bottom';
                finalTop = rect.bottom + 8;
            } else {
                actualPos = 'top';
                finalTop = rect.top - tooltipHeight - 8;
            }
        }

        // Clamp vertically
        finalTop = Math.max(padding, Math.min(window.innerHeight - tooltipHeight - padding, finalTop));

        setCoords({
            x: Math.round(finalLeft),
            y: Math.round(finalTop),
            arrowX: Math.round(arrowX),
            actualPosition: actualPos
        });
    }, [position]);

    useEffect(() => {
        if (isVisible) {
            updateCoords();
            // Re-measure after element is mounted to get exact DOM dimensions
            const raf = requestAnimationFrame(() => {
                updateCoords();
            });
            const handleScroll = () => setIsVisible(false);
            window.addEventListener('scroll', handleScroll, true);
            window.addEventListener('resize', updateCoords);
            return () => {
                cancelAnimationFrame(raf);
                window.removeEventListener('scroll', handleScroll, true);
                window.removeEventListener('resize', updateCoords);
            };
        }
    }, [isVisible, updateCoords]);

    return (
        <span
            ref={triggerRef as any}
            className={`relative inline-flex items-center align-middle cursor-pointer ${className}`}
            onMouseEnter={() => {
                if (!disabled) {
                    updateCoords();
                    setIsVisible(true);
                }
            }}
            onMouseLeave={() => setIsVisible(false)}
        >
            {children}

            {/* Tooltip Portal */}
            {!disabled && createPortal(
                <AnimatePresence>
                    {isVisible && (
                        <motion.div
                            ref={tooltipRef}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.12, ease: 'easeOut' }}
                            style={{
                                position: 'fixed',
                                left: coords.x,
                                top: coords.y,
                                maxWidth: 'min(420px, calc(100vw - 24px))',
                                zIndex: 99999,
                            }}
                            className="bg-[var(--bg-tertiary)] z-10 shadow-2xl rounded-lg pointer-events-none border border-[var(--border-color)]/80 backdrop-blur-xl py-1 px-2.5 transition-none"
                        >
                            <div className="text-[var(--text-primary)] font-semibold text-[10px] font-mono break-all leading-tight">
                                {title}
                            </div>
                            {subtitle && (
                                <div className="text-[var(--text-muted)] text-[9px] font-sans mt-0.5 leading-snug">
                                    {subtitle}
                                </div> 
                            )}

                            {/* Dynamic Tracking Arrow */}
                            {coords.actualPosition === 'top' && (
                                <div
                                    style={{ left: coords.arrowX }}
                                    className="absolute -z-10 bottom-[-4px] -translate-x-1/2 w-2.5 h-2.5 bg-[var(--bg-tertiary)] border-b border-r border-[var(--border-color)]/80 rotate-45"
                                />
                            )}
                            {coords.actualPosition === 'bottom' && (
                                <div
                                    style={{ left: coords.arrowX }}
                                    className="absolute -z-10 top-[-4px] -translate-x-1/2 w-2.5 h-2.5 bg-[var(--bg-tertiary)] border-t border-l border-[var(--border-color)]/80 rotate-45"
                                />
                            )}
                            {coords.actualPosition === 'right' && (
                                <div
                                    className="absolute -z-10 left-[-4px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-[var(--bg-tertiary)] border-b border-l border-[var(--border-color)]/80 rotate-45"
                                />
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </span>
    );
}

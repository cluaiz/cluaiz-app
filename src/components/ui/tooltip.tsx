import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface TooltipProps {
    children: React.ReactNode;
    title: string;
    subtitle?: string;
    disabled?: boolean;
    position?: 'right' | 'top' | 'bottom' | 'bottom-end' | 'left'; // Currently supports right, bottom, bottom-end
    className?: string;
}

export function Tooltip({ children, title, subtitle, disabled = false, position = 'right', className = '' }: TooltipProps) {
    const [isVisible, setIsVisible] = useState(false);
    const triggerRef = useRef<HTMLDivElement>(null);
    const [coords, setCoords] = useState({ x: 0, y: 0 });

    const updateCoords = () => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            if (position === 'bottom') {
                setCoords({
                    x: rect.left + (rect.width / 2),
                    y: rect.bottom + 12
                });
            } else if (position === 'bottom-end') {
                setCoords({
                    x: rect.right,
                    y: rect.bottom + 12
                });
            } else {
                setCoords({
                    x: rect.right + 12,
                    y: rect.top + (rect.height / 2)
                });
            }
        }
    };

    useEffect(() => {
        if (isVisible) {
            updateCoords();
            const handleScroll = () => setIsVisible(false);
            window.addEventListener('scroll', handleScroll, true);
            return () => window.removeEventListener('scroll', handleScroll, true);
        }
    }, [isVisible]);

    return (
        <div
            ref={triggerRef}
            className={`relative flex items-center justify-center cursor-pointer ${className}`}
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
                            initial={position.startsWith('bottom') ? { opacity: 0, y: -8, scale: 0.95 } : { opacity: 0, x: -8, scale: 0.95 }}
                            animate={position.startsWith('bottom') ? { opacity: 1, y: 0, scale: 1 } : { opacity: 1, x: 0, scale: 1 }}
                            exit={position.startsWith('bottom') ? { opacity: 0, y: -8, scale: 0.95 } : { opacity: 0, x: -8, scale: 0.95 }}
                            transition={{ duration: 0.15, ease: 'easeOut' }}
                            style={position.startsWith('bottom') ? {
                                position: 'fixed',
                                left: coords.x,
                                top: coords.y,
                                x: position === 'bottom-end' ? 'calc(-100% + 8px)' : '-50%', // align to right or center
                                zIndex: 99999,
                            } : {
                                position: 'fixed',
                                left: coords.x,
                                top: coords.y,
                                y: '-50%', // center vertically relative to the trigger
                                zIndex: 99999,
                            }}
                            className={`bg-[var(--bg-tertiary)] z-10 shadow-xl rounded-xl pointer-events-none max-w-[260px] backdrop-blur-xl ${position.startsWith('bottom') ? 'p-2' : 'p-1 pl-1.5'}`}
                        >
                            <div className="text-[var(--text-primary)] font-bold text-[13px]  truncate">
                                {title}
                            </div>
                            {subtitle && (
                                <div className="text-[var(--text-muted)] text-[11px] font-medium leading-relaxed line-clamp-2">
                                    {subtitle}
                                </div> 
                            )}

                            {position === 'bottom' ? (
                                <div
                                    className="absolute -z-10 top-[-4px] left-1/2 -translate-x-1/2 w-3 h-3 bg-[var(--bg-tertiary)] rotate-45"
                                />
                            ) : position === 'bottom-end' ? (
                                <div
                                    className="absolute -z-10 top-[-4px] right-[18px] w-3 h-3 bg-[var(--bg-tertiary)] rotate-45"
                                />
                            ) : (
                                <div
                                    className="absolute -z-10 top-1/2 -translate-y-1/2 -left-1 w-3 h-3 bg-[var(--bg-tertiary)] rotate-45"
                                />
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
}

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useIconHover } from '../../animate-ui/icons';

export interface ActionDropdownProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    align?: 'left' | 'right';
    className?: string;
    /** Open the menu in a portal at document.body with fixed coordinates so parent overflow-hidden or clipping never cuts it */
    floating?: boolean;
    triggerRef?: React.RefObject<HTMLElement | null>;
}

export function ActionDropdown({
    isOpen,
    onClose,
    children,
    align = 'right',
    className = '',
    floating = false,
    triggerRef
}: ActionDropdownProps) {
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

    // Smart viewport positioning when floating=true
    useEffect(() => {
        if (!floating || !isOpen) return;

        const place = () => {
            const anchor = triggerRef?.current || dropdownRef.current?.parentElement;
            if (!anchor) return;

            const rect = anchor.getBoundingClientRect();
            const below = window.innerHeight - rect.bottom;
            const style: React.CSSProperties = {
                position: 'fixed',
                zIndex: 9999,
            };

            if (align === 'right') {
                style.right = Math.max(8, window.innerWidth - rect.right);
            } else {
                style.left = Math.max(8, rect.left);
            }

            // If not enough room below (less than 240px) and more room above, flip upward
            if (below < 240 && rect.top > below) {
                style.bottom = window.innerHeight - rect.top + 6;
            } else {
                style.top = rect.bottom + 6;
            }

            setMenuStyle(style);
        };

        place();
        window.addEventListener('resize', place);
        window.addEventListener('scroll', place, true);
        return () => {
            window.removeEventListener('resize', place);
            window.removeEventListener('scroll', place, true);
        };
    }, [floating, isOpen, align, triggerRef]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(target) &&
                (!triggerRef?.current || !triggerRef.current.contains(target))
            ) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose, triggerRef]);

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const panel = (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    ref={dropdownRef}
                    initial={{ opacity: 0, y: -4, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.97 }}
                    transition={{ duration: 0.12, ease: 'easeOut' }}
                    style={floating ? menuStyle : undefined}
                    onClick={(e) => e.stopPropagation()}
                    className={`ui-dropdown ${
                        floating
                            ? ''
                            : `absolute mt-1.5 ${align === 'right' ? 'right-0' : 'left-0'} z-50`
                    } ${className}`}
                >
                    {children}
                </motion.div>
            )}
        </AnimatePresence>
    );

    return floating ? createPortal(panel, document.body) : panel;
}

export interface ActionDropdownItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
    icon?: React.ReactNode;
    active?: boolean;
    danger?: boolean;
}

export function ActionDropdownItem({
    children,
    icon,
    active = false,
    danger = false,
    className = '',
    onClick,
    ...props
}: ActionDropdownItemProps) {
    const { ref: iconRef, triggerProps } = useIconHover();

    const renderedIcon = React.isValidElement(icon)
        ? React.cloneElement(icon as React.ReactElement<any>, { ref: iconRef })
        : icon;

    return (
        <button
            type="button"
            onClick={onClick}
            {...triggerProps}
            className={`w-full text-left px-3 py-1.5 text-xs rounded-xl font-medium transition-all duration-150 flex items-center gap-2.5 cursor-pointer border border-transparent select-none ${
                danger
                    ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10 hover:border-red-500/20'
                    : active
                    ? 'bg-[var(--accent-color)]/15 text-[var(--accent-color)] border-[var(--accent-color)]/25'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
            } ${className}`}
            {...props}
        >
            {renderedIcon && <span className="shrink-0 flex items-center justify-center">{renderedIcon}</span>}
            <span className="truncate flex-1">{children}</span>
        </button>
    );
}

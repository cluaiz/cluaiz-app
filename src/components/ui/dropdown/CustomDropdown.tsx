import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, Loader2 } from 'lucide-react';

export interface DropdownOption {
    value: string;
    label: string;
    description?: string;
}

export interface CustomDropdownProps {
    options: (string | DropdownOption)[];
    value?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    loading?: boolean;
    allowCustomInput?: boolean;
    customInputPlaceholder?: string;
    /** Open the list above the page (portal) so a scrolling or clipped parent cannot cut it */
    floating?: boolean;
}

/** Marks a floating list so popovers treat clicks in it as inside themselves */
export const FLOATING_MENU_ATTR = 'data-floating-menu';

export function CustomDropdown({
    options,
    value,
    onChange,
    placeholder = 'Select option...',
    className = '',
    disabled = false,
    loading = false,
    allowCustomInput = false,
    customInputPlaceholder = 'Type custom...',
    floating = false
}: CustomDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [customInputVal, setCustomInputVal] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

    // Floating list: placed at the trigger, below it or above when the window has no room below
    useEffect(() => {
        if (!floating || !isOpen || !containerRef.current) return;
        const place = () => {
            const rect = containerRef.current!.getBoundingClientRect();
            const below = window.innerHeight - rect.bottom;
            const style: React.CSSProperties = {
                position: 'fixed',
                right: Math.max(8, window.innerWidth - rect.right),
                minWidth: Math.max(rect.width, 200),
            };
            if (below < 280 && rect.top > below) style.bottom = window.innerHeight - rect.top + 6;
            else style.top = rect.bottom + 6;
            setMenuStyle(style);
        };
        place();
        window.addEventListener('resize', place);
        window.addEventListener('scroll', place, true);
        return () => {
            window.removeEventListener('resize', place);
            window.removeEventListener('scroll', place, true);
        };
    }, [floating, isOpen]);

    // Normalize options
    const normalizedOptions: DropdownOption[] = options.map((opt) =>
        typeof opt === 'string' ? { value: opt, label: opt } : opt
    );

    const selectedOption = normalizedOptions.find(
        (opt) => String(opt.value) === String(value)
    );

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            if (containerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
            setIsOpen(false);
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Close on Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    const handleSelect = (val: string) => {
        onChange?.(val);
        setIsOpen(false);
    };

    return (
        <div
            ref={containerRef}
            className={`relative text-left ${className || 'w-auto'}`}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Trigger Button */}
            <button
                type="button"
                disabled={disabled || loading}
                onClick={() => setIsOpen((prev) => !prev)}
                className={`w-full flex items-center justify-between gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] hover:border-[var(--accent-color)]/40 transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)]/40 min-w-[180px] ${
                    isOpen ? 'border-[var(--accent-color)] ring-1 ring-[var(--accent-color)]/30' : ''
                } ${disabled || loading ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
                <span className="truncate">
                    {selectedOption ? selectedOption.label : (value !== undefined && value !== '' ? String(value) : placeholder)}
                </span>
                {loading ? (
                    <Loader2 size={14} className="text-[var(--accent-color)] animate-spin shrink-0" />
                ) : (
                    <ChevronDown
                        size={14}
                        className={`text-[var(--text-muted)] transition-transform duration-200 shrink-0 ${
                            isOpen ? 'rotate-180 text-[var(--accent-color)]' : ''
                        }`}
                    />
                )}
            </button>

            {/* Dropdown Menu Panel */}
            {(() => {
                const panel = (
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        ref={menuRef}
                        {...{ [FLOATING_MENU_ATTR]: floating ? '' : undefined }}
                        onClick={(e) => e.stopPropagation()}
                        initial={{ opacity: 0, y: -4, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.98 }}
                        transition={{ duration: 0.12, ease: 'easeOut' }}
                        style={floating ? menuStyle : undefined}
                        className={`${floating ? 'z-[1000] max-w-xs' : 'absolute right-0 top-full mt-1.5 z-[300] min-w-[240px] max-w-md'} w-max origin-top-right bg-[var(--bg-secondary)]/95 backdrop-blur-xl border border-[var(--border-color)] rounded-2xl shadow-2xl p-1.5 overflow-hidden flex flex-col gap-0.5`}
                    >
                        <div className="max-h-60 overflow-y-auto space-y-0.5 custom-scrollbar">
                            {normalizedOptions.map((opt) => {
                                const isSelected = String(opt.value) === String(value);
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => handleSelect(opt.value)}
                                        className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-xs font-medium text-left transition-colors cursor-pointer group ${
                                            isSelected
                                                ? 'bg-[var(--accent-color)]/15 text-[var(--accent-color)] font-bold'
                                                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                                        }`}
                                    >
                                        <div className="flex flex-col min-w-0">
                                            <span className="truncate">{opt.label}</span>
                                            {opt.description && (
                                                <span className="text-[10px] text-[var(--text-muted)] font-normal truncate mt-0.5">
                                                    {opt.description}
                                                </span>
                                            )}
                                        </div>
                                        {isSelected && (
                                            <Check
                                                size={14}
                                                className="text-[var(--accent-color)] shrink-0"
                                            />
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {allowCustomInput && (
                            <div className="pt-2 mt-1 border-t border-[var(--border-color)] px-1">
                                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                    <input
                                        type="text"
                                        value={customInputVal}
                                        onChange={(e) => setCustomInputVal(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                const trimmed = customInputVal.trim();
                                                if (trimmed) {
                                                    handleSelect(trimmed);
                                                    setCustomInputVal('');
                                                }
                                            }
                                        }}
                                        placeholder={customInputPlaceholder || 'Type custom...'}
                                        className="w-full px-2.5 py-1.5 text-xs rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:border-[var(--accent-color)] focus:outline-none transition-all placeholder:text-[var(--text-muted)]"
                                    />
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const trimmed = customInputVal.trim();
                                            if (trimmed) {
                                                handleSelect(trimmed);
                                                setCustomInputVal('');
                                            }
                                        }}
                                        className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-[var(--accent-color)]/15 hover:bg-[var(--accent-color)]/25 text-[var(--accent-color)] border border-[var(--accent-color)]/30 shrink-0 cursor-pointer transition-all"
                                    >
                                        Set
                                    </button>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
                );
                return floating ? createPortal(panel, document.body) : panel;
            })()}
        </div>
    );
}

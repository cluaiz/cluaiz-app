import React, { useId, useRef } from 'react';
import { motion } from 'framer-motion';

export interface TabItem<T extends string = string> {
    id: T;
    label: React.ReactNode;
    icon?: React.ComponentType<{ className?: string }>;
    count?: number;
    badge?: React.ReactNode;
    disabled?: boolean;
}

export interface TabsProps<T extends string = string> {
    items: (TabItem<T> | T)[];
    value: T;
    onChange: (value: T) => void;
    variant?: 'pill' | 'underline' | 'tags';
    bordered?: boolean;
    className?: string;
    id?: string;
}

export function Tabs<T extends string = string>({
    items,
    value,
    onChange,
    variant = 'pill',
    bordered = true,
    className = '',
    id: explicitId,
}: TabsProps<T>) {
    const autoId = useId();
    const layoutScope = explicitId || autoId;
    const scrollRef = useRef<HTMLDivElement>(null);

    const handleWheel = (e: React.WheelEvent) => {
        if (scrollRef.current) {
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                scrollRef.current.scrollLeft += e.deltaY;
            } else {
                scrollRef.current.scrollLeft += e.deltaX;
            }
        }
    };

    // Normalize raw string items into TabItem objects
    const normalizedItems: TabItem<T>[] = items.map((item) => {
        if (typeof item === 'string') {
            return { id: item as T, label: item };
        }
        return item;
    });

    if (variant === 'underline') {
        return (
            <div
                ref={scrollRef}
                onWheel={handleWheel}
                className={`flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth border-b border-[var(--border-color)]/60 ${className}`}
            >
                {normalizedItems.map((item) => {
                    const isActive = item.id.toLowerCase() === value.toLowerCase();
                    const Icon = item.icon;

                    return (
                        <button
                            key={item.id}
                            type="button"
                            disabled={item.disabled}
                            onClick={() => !item.disabled && onChange(item.id)}
                            className={`relative px-3.5 py-2 text-xs transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2 select-none ${
                                isActive 
                                    ? 'text-[var(--text-primary)] font-semibold' 
                                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                            } ${item.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                        >
                            <span className="relative z-10 flex items-center gap-2">
                                {Icon && <Icon className="w-3.5 h-3.5" />}
                                <span>{item.label}</span>
                                {item.count !== undefined && (
                                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[var(--bg-secondary)] text-[var(--text-secondary)] font-bold">
                                        {item.count}
                                    </span>
                                )}
                                {item.badge}
                            </span>
                            {isActive && (
                                <motion.div
                                    layoutId={`tab-underline-${layoutScope}`}
                                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--accent-color)] shadow-[0_0_8px_var(--accent-color)]"
                                    transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                                />
                            )}
                        </button>
                    );
                })}
            </div>
        );
    }

    if (variant === 'tags' || !bordered) {
        return (
            <div className={`relative w-full overflow-hidden ${className}`}>
                {/* Left smoke fade-out mask */}
                <div className="absolute left-0 top-0 bottom-0 w-5 bg-gradient-to-r from-[var(--bg-secondary)] to-transparent pointer-events-none z-10" />

                {/* Tags scrollable track with CSS mask */}
                <div
                    ref={scrollRef}
                    onWheel={handleWheel}
                    style={{
                        maskImage: 'linear-gradient(to right, transparent 0%, black 14px, black calc(100% - 14px), transparent 100%)',
                        WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 14px, black calc(100% - 14px), transparent 100%)',
                    }}
                    className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth w-full py-0.5 px-2"
                >
                    {normalizedItems.map((item) => {
                        const isActive = item.id.toLowerCase() === value.toLowerCase();
                        const Icon = item.icon;

                        return (
                            <button
                                key={item.id}
                                type="button"
                                disabled={item.disabled}
                                onClick={() => !item.disabled && onChange(item.id)}
                                className={`relative px-2.5 py-1 text-xs rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 select-none border ${
                                    isActive
                                        ? 'bg-[var(--accent-color)]/15 text-[var(--accent-color)] border-[var(--accent-color)]/40 font-semibold shadow-2xs'
                                        : 'bg-[var(--bg-tertiary)]/50 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] border-[var(--border-color)]/50'
                                } ${item.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                            >
                                <span className="relative z-10 flex items-center gap-1.5">
                                    {Icon && <Icon className="w-3 h-3" />}
                                    <span>{item.label}</span>
                                    {item.count !== undefined && (
                                        <span className="px-1 py-0.2 rounded-md text-[9px] font-mono bg-[var(--bg-secondary)] text-[var(--text-muted)] font-bold">
                                            {item.count}
                                        </span>
                                    )}
                                    {item.badge}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Right smoke fade-out mask */}
                <div className="absolute right-0 top-0 bottom-0 w-5 bg-gradient-to-l from-[var(--bg-secondary)] to-transparent pointer-events-none z-10" />
            </div>
        );
    }

    // Default 'pill' variant with bordered container
    return (
        <div
            ref={scrollRef}
            onWheel={handleWheel}
            className={`flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth p-1 rounded-xl bg-[var(--bg-secondary)]/70 border border-[var(--border-color)]/60 ${className}`}
        >
            {normalizedItems.map((item) => {
                const isActive = item.id.toLowerCase() === value.toLowerCase();
                const Icon = item.icon;

                return (
                    <button
                        key={item.id}
                        type="button"
                        disabled={item.disabled}
                        onClick={() => !item.disabled && onChange(item.id)}
                        className={`relative px-3 py-1.5 text-xs rounded-lg transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 select-none ${
                            isActive
                                ? 'text-[var(--text-primary)] font-semibold'
                                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/[0.04]'
                        } ${item.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                        {isActive && (
                            <motion.div
                                layoutId={`tab-pill-${layoutScope}`}
                                className="absolute inset-0 rounded-lg bg-[var(--bg-tertiary)] border border-white/10 shadow-xs"
                                transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                            />
                        )}
                        <span className="relative z-10 flex items-center gap-1.5">
                            {Icon && <Icon className="w-3.5 h-3.5" />}
                            <span>{item.label}</span>
                            {item.count !== undefined && (
                                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[var(--bg-secondary)] text-[var(--text-secondary)] font-bold">
                                    {item.count}
                                </span>
                            )}
                            {item.badge}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

export default Tabs;

import React, { useId } from 'react';
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
    variant?: 'pill' | 'underline';
    className?: string;
    id?: string;
}

export function Tabs<T extends string = string>({
    items,
    value,
    onChange,
    variant = 'pill',
    className = '',
    id: explicitId,
}: TabsProps<T>) {
    const autoId = useId();
    const layoutScope = explicitId || autoId;

    // Normalize raw string items into TabItem objects
    const normalizedItems: TabItem<T>[] = items.map((item) => {
        if (typeof item === 'string') {
            return { id: item as T, label: item };
        }
        return item;
    });

    if (variant === 'underline') {
        return (
            <div className={`flex items-center gap-1 overflow-x-auto no-scrollbar border-b border-[var(--border-color)]/60 ${className}`}>
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

    // Default 'pill' variant — smooth rubber sliding segment
    return (
        <div className={`flex items-center gap-1 overflow-x-auto no-scrollbar py-1 ${className}`}>
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
                                className="absolute inset-0 rounded-lg bg-[var(--accent-color)]/15 border border-[var(--accent-color)]/30 shadow-[0_0_12px_var(--accent-color)]/15"
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

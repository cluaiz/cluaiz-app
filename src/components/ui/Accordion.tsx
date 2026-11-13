import React from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useScrollReveal } from '../../hooks/useScrollReveal';

/** The API Explorer's folding list: a `group` box holds `subgroup` boxes or items; a `subgroup` box holds items. */
const LEVELS = {
    group: {
        box: 'rounded-lg border border-[var(--border-color)]/40 bg-white/[0.015] overflow-hidden transition-all shadow-sm',
        head: 'w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-white/[0.04] transition-colors cursor-pointer',
        name: 'flex items-center gap-2 truncate', title: 'truncate tracking-wide', side: 'flex items-center gap-1.5 shrink-0 ml-2',
        count: 'text-[10px] px-1.5 py-0.2 rounded-full font-mono font-medium opacity-70 bg-white/[0.06] text-[var(--text-secondary)]',
        chevron: 'w-3.5 h-3.5 text-[var(--text-muted)]',
        body: 'border-t border-[var(--border-color)]/30 p-1.5 space-y-1.5 bg-black/10',
    },
    subgroup: {
        box: 'rounded-md border border-[var(--border-color)]/25 bg-white/[0.01] overflow-hidden',
        head: 'w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.03] transition-colors cursor-pointer',
        name: 'flex items-center gap-1.5 truncate', title: 'truncate', side: 'flex items-center gap-1 shrink-0 ml-1.5',
        count: 'text-[9px] font-mono opacity-60',
        chevron: 'w-3 h-3 text-[var(--text-muted)]',
        body: 'p-1 space-y-0.5 border-t border-[var(--border-color)]/20 bg-black/20',
    },
};

export interface AccordionGroupProps {
    level?: keyof typeof LEVELS;
    icon: React.ReactNode;
    title: string;
    count: React.ReactNode;
    open: boolean;
    onToggle: () => void;
    /** Shown before the count (download progress, a green check) */
    marks?: React.ReactNode;
    children: React.ReactNode;
}

export function AccordionGroup({ level = 'group', icon, title, count, open, onToggle, marks, children }: AccordionGroupProps) {
    const style = LEVELS[level];
    const Chevron = open ? ChevronDown : ChevronRight;
    return (
        <div className={style.box}>
            <button type="button" onClick={onToggle} className={style.head}>
                <div className={style.name}>
                    {icon}
                    <span className={style.title}>{title}</span>
                </div>
                <div className={style.side}>
                    {marks}
                    <span className={style.count}>{count}</span>
                    <Chevron className={style.chevron} />
                </div>
            </button>
            {open && <div className={style.body}>{children}</div>}
        </div>
    );
}

/** One entry inside an `AccordionGroup`; `action` sits beside it (a Chat button). */
export function AccordionItem({ selected, onClick, title, action, children }: {
    selected: boolean; onClick: () => void; title?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
    const scrollReveal = useScrollReveal();
    const item = (
        <motion.button
            {...scrollReveal}
            type="button"
            onClick={onClick}
            className={`w-full min-w-0 flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition-all cursor-pointer ${
                selected
                    ? 'bg-[var(--accent-color)]/15 border border-[var(--accent-color)]/40 text-[var(--text-primary)] font-medium shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.04]'
            }`}
            title={title}
        >
            {children}
        </motion.button>
    );
    return action ? <div className="flex items-center gap-1">{item}{action}</div> : item;
}

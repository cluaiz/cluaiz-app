import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Download } from 'lucide-react';
import { useScrollReveal } from '../../hooks/useScrollReveal';

interface DirectoryRowProps {
    title: string;
    subtitle?: string;
    /** Logo or icon inside the square on the left */
    icon: React.ReactNode;
    tag?: string;
    count?: React.ReactNode;
    selected: boolean;
    /** Label of the green check (installed, connected) */
    done?: string;
    /** A download into this entry is running: its progress ("63%") or '' when the Engine gives no total */
    downloading?: string;
    onClick: () => void;
}

/** The download in progress, the green check and the open dot beside a sidebar entry */
export function DirectoryMarks({ selected, done, downloading }: { selected: boolean; done?: string; downloading?: string }) {
    return <>
        {downloading !== undefined && <span title="Downloading" className="flex items-center gap-0.5 text-[10px] font-mono font-semibold text-[var(--accent-color)] shrink-0">
            <Download size={12} className="animate-pulse" />{downloading}
        </span>}
        {done && <CheckCircle2 size={12} role="img" aria-label={done} className="text-emerald-400 shrink-0"><title>{done}</title></CheckCircle2>}
        {selected && <span title="Open" className="w-1.5 h-1.5 rounded-full bg-[var(--accent-color)] shrink-0" />}
    </>;
}

/** One row of a Toolkit sidebar directory (model families, providers): opens its detail in the content pane. */
export function DirectoryRow({ title, subtitle, icon, tag, count, selected, done, downloading, onClick }: DirectoryRowProps) {
    const scrollReveal = useScrollReveal({ amount: 0.15, scale: 0.96 });
    return (
        <motion.button
            {...scrollReveal}
            type="button"
            onClick={onClick}
            className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all cursor-pointer group ${
                selected
                    ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-color)] shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]/60 border border-transparent'
            }`}
        >
            <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-[var(--bg-tertiary)] border border-[var(--border-color)]/60 overflow-hidden">
                    {icon}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold leading-4 truncate text-[var(--text-primary)]">{title}</span>
                        {tag && (
                            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-[var(--bg-tertiary)] text-[var(--accent-color)] border border-[var(--border-color)]">
                                {tag}
                            </span>
                        )}
                    </div>
                    {subtitle && <div className="text-[10px] text-[var(--text-muted)] leading-3 truncate mt-0.5">{subtitle}</div>}
                </div>
            </div>
            <span className="flex items-center gap-1.5 shrink-0 ml-2">
                <DirectoryMarks selected={selected} done={done} downloading={downloading} />
                {count !== undefined && <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded text-[var(--text-muted)]">{count}</span>}
            </span>
        </motion.button>
    );
}

/**
 * Which `AccordionGroup`s of a sidebar list are folded (all open at first). A click on a group's head opens
 * that group's page; a click on the group already open there folds or unfolds it.
 */
export function useFolds() {
    const [folded, setFolded] = useState<Record<string, boolean>>({});
    return {
        open: (key: string) => !folded[key],
        click: (key: string, current: boolean, show: () => void) => {
            if (current) setFolded(value => ({ ...value, [key]: !value[key] }));
            else { setFolded(value => ({ ...value, [key]: false })); show(); }
        },
    };
}

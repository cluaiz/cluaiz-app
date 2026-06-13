import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Archive, 
    Sparkles, 
    History, 
    Check,
    Heart
} from 'lucide-react';
import { Bot as AnimatedBot } from '../../animate-ui/icons/bot';

interface FilterDropdownProps {
    isOpen: boolean;
    onClose: () => void;
    activeFilter: string;
    onFilterChange: (filter: string) => void;
    align?: 'left' | 'right';
    triggerRef?: React.RefObject<HTMLElement | null>;
}

export function FilterDropdown({ 
    isOpen, 
    onClose, 
    activeFilter, 
    onFilterChange,
    align = 'right',
    triggerRef
}: FilterDropdownProps) {
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current && 
                !dropdownRef.current.contains(event.target as Node) &&
                (!triggerRef?.current || !triggerRef.current.contains(event.target as Node))
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

    const filterOptions = [
        { label: "Favourites", icon: Heart },
        { label: "Archive", icon: Archive },
        { label: "Assistants", icon: AnimatedBot, isAnimated: true },
        { label: "New User", icon: Sparkles },
        { label: "Old User", icon: History }
    ];

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    ref={dropdownRef}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className={`absolute top-full mt-1.5 w-48 bg-zinc-950/95 border border-white/10 shadow-2xl p-1.5 z-50 rounded-2xl backdrop-blur-md ${
                        align === 'right' ? 'right-2' : 'left-2'
                    }`}
                >
                    <div className="text-[10px] font-black text-zinc-500 dark:text-zinc-500 uppercase tracking-[0.2em] px-3 py-2 select-none">
                        Advanced Filters
                    </div>
                    <div className="space-y-0.5 max-h-80 overflow-y-auto custom-scrollbar">
                        {filterOptions.map(({ label, icon: Icon, isAnimated }) => {
                            const isActive = activeFilter === label;
                            return (
                                <button
                                    key={label}
                                    onClick={() => {
                                        onFilterChange(label);
                                        onClose();
                                    }}
                                    className={`w-full text-left px-3 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-between group cursor-pointer border border-transparent ${
                                        isActive
                                            ? "bg-[var(--accent-color)]/10 border-[var(--accent-color)]/20 text-[var(--accent-color)] font-extrabold"
                                            : "text-zinc-300 hover:bg-white/5 hover:text-white"
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="shrink-0 flex items-center justify-center w-4 h-4">
                                            {isAnimated ? (
                                                <Icon 
                                                    size={14} 
                                                    animate={isActive}
                                                    className={isActive ? "text-[var(--accent-color)]" : "text-zinc-500 group-hover:text-zinc-300"} 
                                                />
                                            ) : (
                                                <Icon 
                                                    size={14} 
                                                    className={`transition-colors ${
                                                        isActive ? "text-[var(--accent-color)]" : "text-zinc-500 group-hover:text-zinc-300"
                                                    }`} 
                                                />
                                            )}
                                        </div>
                                        <span className="truncate">{label}</span>
                                    </div>
                                    {isActive && (
                                        <Check size={14} className="text-[var(--accent-color)] shrink-0" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

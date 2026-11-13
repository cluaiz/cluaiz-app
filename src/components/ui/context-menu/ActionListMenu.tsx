import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X as AnimatedX } from '../../animate-ui/icons/x';

export interface MenuAction {
    id: string;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    /** Text colour class, e.g. for a destructive action */
    color?: string;
    /** A line above this action */
    divider?: boolean;
    disabled?: boolean;
    /** Shown at the right, e.g. a shortcut */
    hint?: string;
}

interface ActionListMenuProps {
    x: number;
    y: number;
    isOpen: boolean;
    title: string;
    actions: MenuAction[];
    onAction: (id: string) => void;
    onClose: () => void;
}

const cn = (...classes: (string | boolean | undefined | null)[]) => classes.filter(Boolean).join(' ');
const WIDTH = 224, ROW = 40, HEAD = 44;

/** The chat's right-click menu look: a titled list of actions at the pointer, closed by a click outside */
export function ActionListMenu({ x, y, isOpen, title, actions, onAction, onClose }: ActionListMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) onClose();
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    if (!isOpen || typeof document === 'undefined') return null;
    const left = Math.min(x, window.innerWidth - WIDTH - 10);
    const top = Math.min(y, window.innerHeight - (HEAD + actions.length * ROW) - 10);

    return ReactDOM.createPortal(
        <AnimatePresence>
            <motion.div
                ref={menuRef}
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                style={{ position: 'fixed', top, left, zIndex: 99999 }}
                className="w-56 bg-zinc-950/95 border border-white/10 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] backdrop-blur-md overflow-hidden flex flex-col select-none py-1.5"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-4 py-2 mb-1 border-b border-white/5">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-tighter truncate">{title}</span>
                    <button onClick={onClose} className="text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer">
                        <AnimatedX size={14} animateOnHover />
                    </button>
                </div>

                {actions.map(act => (
                    <React.Fragment key={act.id}>
                        {act.divider && <div className="h-[1px] bg-white/5 mx-3 my-1" />}
                        <button
                            disabled={act.disabled}
                            onClick={() => { onAction(act.id); onClose(); }}
                            className={cn(
                                "w-full flex items-center gap-3.5 px-4 py-2.5 text-[13px] font-medium transition-all text-neutral-300 hover:bg-white/5 hover:text-white group text-left cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
                                act.color
                            )}
                        >
                            <act.icon size={16} className={cn("opacity-70 group-hover:opacity-100 transition-opacity", act.color)} />
                            <span className="flex-1 truncate">{act.label}</span>
                            {act.hint && <span className="text-[10px] font-mono text-neutral-500">{act.hint}</span>}
                        </button>
                    </React.Fragment>
                ))}
            </motion.div>
        </AnimatePresence>,
        document.body
    );
}

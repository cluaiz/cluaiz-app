import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

function cn(...classes: (string | boolean | undefined | null)[]) {
    return classes.filter(Boolean).join(' ');
}

export interface ToggleSwitchProps {
    active: boolean;
    onToggle?: () => void;
    size?: 'sm' | 'md';
    className?: string;
    disabled?: boolean;
    loading?: boolean;
    id?: string;
    'aria-label'?: string;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
    active,
    onToggle,
    size = 'md',
    className,
    disabled = false,
    loading = false,
    id,
    'aria-label': ariaLabel,
}) => {
    const [isPressed, setIsPressed] = useState(false);
    const isSm = size === 'sm';
    const isBlocked = disabled || loading;
    const travelDistance = isSm ? 15 : 20;

    return (
        <motion.div
            id={id}
            role="switch"
            aria-checked={active}
            aria-label={ariaLabel}
            tabIndex={isBlocked ? -1 : 0}
            whileTap={!isBlocked ? { scale: 0.94 } : undefined}
            onPointerDown={() => !isBlocked && setIsPressed(true)}
            onPointerUp={() => setIsPressed(false)}
            onPointerLeave={() => setIsPressed(false)}
            onClick={(e) => {
                e.stopPropagation();
                if (!isBlocked) onToggle?.();
            }}
            onKeyDown={(e) => {
                if (!isBlocked && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    e.stopPropagation();
                    onToggle?.();
                }
            }}
            className={cn(
                isSm 
                    ? "w-[34px] h-[19px] p-[2px]" 
                    : "w-[44px] h-[24px] p-[3px]",
                "rounded-full flex items-center transition-colors duration-250 shrink-0 select-none",
                isBlocked ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
                active
                    ? "bg-[var(--accent-color)] border border-[var(--accent-color)]/40 shadow-[0_0_12px_var(--accent-color)]/25"
                    : "bg-white/10 border border-white/10 hover:bg-white/15",
                className
            )}
        >
            <motion.div
                animate={{
                    x: active ? travelDistance : 0,
                    scaleX: isPressed ? 1.25 : 1,
                    scaleY: isPressed ? 0.82 : 1,
                }}
                transition={{
                    type: 'spring',
                    stiffness: 550,
                    damping: 32,
                    mass: 0.7,
                }}
                className={cn(
                    isSm ? "w-[15px] h-[15px]" : "w-[18px] h-[18px]",
                    "rounded-full shadow-md flex items-center justify-center transition-colors duration-200",
                    active 
                        ? "bg-[var(--bg-primary)]" 
                        : "bg-zinc-400"
                )}
            >
                {loading && (
                    <Loader2 className={cn("animate-spin text-zinc-600", isSm ? "w-2.5 h-2.5" : "w-3 h-3")} />
                )}
            </motion.div>
        </motion.div>
    );
};

export default ToggleSwitch;

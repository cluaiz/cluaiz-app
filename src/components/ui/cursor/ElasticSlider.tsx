import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, animate, useMotionValueEvent } from 'framer-motion';

const MAX_OVERFLOW = 50;

// Sigmoid-based decay function for the elastic stretch
function decay(value: number, max: number) {
    if (max === 0) return 0;
    let entry = value / max;
    let sigmoid = 2 * (1 / (1 + Math.exp(-entry)) - 0.5);
    return sigmoid * max;
}

interface ElasticSliderProps {
    min: number;
    max: number;
    step?: number;
    value: number;
    onChange: (value: number) => void;
    className?: string;
}

export function ElasticSlider({ min, max, step = 1, value, onChange, className }: ElasticSliderProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [region, setRegion] = useState<'left' | 'right' | 'middle'>('middle');
    const [isHovered, setIsHovered] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    
    const clientX = useMotionValue(0);
    const overflow = useMotionValue(0);

    useMotionValueEvent(clientX, 'change', (latest) => {
        if (containerRef.current) {
            const { left, right } = containerRef.current.getBoundingClientRect();
            let newValue = 0;

            if (latest < left) {
                setRegion('left');
                newValue = left - latest;
            } else if (latest > right) {
                setRegion('right');
                newValue = latest - right;
            } else {
                setRegion('middle');
                newValue = 0;
            }

            overflow.jump(decay(newValue, MAX_OVERFLOW));
        }
    });

    const updateValue = (clientXVal: number) => {
        if (containerRef.current) {
            const { left, width } = containerRef.current.getBoundingClientRect();
            if (width === 0) return;
            const percentage = Math.max(0, Math.min(1, (clientXVal - left) / width));
            const rawValue = min + percentage * (max - min);
            const snappedValue = parseFloat((Math.round(rawValue / step) * step).toFixed(4));
            onChange(Math.max(min, Math.min(max, snappedValue)));
        }
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setIsDragging(true);
        clientX.jump(e.clientX);
        updateValue(e.clientX);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (isDragging) {
            clientX.jump(e.clientX);
            updateValue(e.clientX);
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        e.currentTarget.releasePointerCapture(e.pointerId);
        setIsDragging(false);
        setRegion('middle');
        animate(overflow, 0, { type: 'spring', bounce: 0.5 });
    };

    // Calculate filled percentage
    const filledPercentage = max === min ? 0 : ((value - min) / (max - min)) * 100;

    return (
        <motion.div
            onHoverStart={() => setIsHovered(true)}
            onHoverEnd={() => setIsHovered(false)}
            animate={{ scale: isHovered ? 1.01 : 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className={`flex w-full select-none items-center gap-3 touch-none ${className || ''}`}
        >
            <div
                ref={containerRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                className="relative flex w-full h-8 cursor-grab items-center select-none active:cursor-grabbing grow"
            >
                {/* Elastic Track Wrapper */}
                <motion.div
                    style={{
                        scaleX: useTransform(() => {
                            if (containerRef.current) {
                                const { width } = containerRef.current.getBoundingClientRect();
                                if (width === 0) return 1;
                                return 1 + overflow.get() / width;
                            }
                            return 1;
                        }),
                        scaleY: useTransform(overflow, [0, MAX_OVERFLOW], [1, 0.8]),
                        transformOrigin: useTransform(() => {
                            if (containerRef.current) {
                                const { left, width } = containerRef.current.getBoundingClientRect();
                                return clientX.get() < left + width / 2 ? 'right' : 'left';
                            }
                            return 'center';
                        }),
                    }}
                    className="relative w-full h-1 bg-[var(--border-color)] dark:bg-zinc-800 rounded-full overflow-hidden"
                >
                    {/* Active range fill */}
                    <motion.div
                        style={{
                            width: `${filledPercentage}%`,
                            backgroundColor: 'var(--accent-color, #10b981)',
                        }}
                        className="h-full rounded-full"
                    />
                </motion.div>

                {/* Thumb handle */}
                <motion.div
                    animate={{
                        scale: isDragging ? 1.3 : (isHovered ? 1.15 : 1),
                    }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    style={{
                        left: `calc(${filledPercentage}% - 8px)`,
                        x: useTransform(() => {
                            if (region === 'left') {
                                return -overflow.get();
                            }
                            if (region === 'right') {
                                return overflow.get();
                            }
                            return 0;
                        }),
                        backgroundColor: 'var(--accent-color, #10b981)',
                        boxShadow: isDragging 
                            ? 'var(--accent-glow, 0 0 15px rgba(16, 185, 129, 0.6))' 
                            : 'var(--accent-glow, 0 0 10px rgba(16, 185, 129, 0.35))',
                    }}
                    className="absolute w-4 h-4 rounded-full border border-white/20 pointer-events-none transition-shadow shadow-md"
                />
            </div>
        </motion.div>
    );
}
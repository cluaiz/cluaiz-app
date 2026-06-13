import { useEffect, useState, useRef } from 'react';

interface Pulse {
    id: number;
    x: number;
    y: number;
}

export function NeonPulseCursor() {
    const pointerRef = useRef({ x: -100, y: -100 });
    const coreRef = useRef<HTMLDivElement>(null);
    const [pulses, setPulses] = useState<Pulse[]>([]);
    const isClickedRef = useRef(false);
    const pulseIdRef = useRef(0);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            pointerRef.current.x = e.clientX;
            pointerRef.current.y = e.clientY;
        };

        const handleMouseDown = (e: MouseEvent) => {
            isClickedRef.current = true;
            const id = pulseIdRef.current++;
            setPulses((prev) => [...prev, { id, x: e.clientX, y: e.clientY }]);
            setTimeout(() => {
                setPulses((prev) => prev.filter((p) => p.id !== id));
            }, 600);
        };

        const handleMouseUp = () => {
            isClickedRef.current = false;
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mouseup', handleMouseUp);

        let animationFrameId: number;

        const updatePosition = () => {
            const targetX = pointerRef.current.x;
            const targetY = pointerRef.current.y;

            if (coreRef.current) {
                const coreScale = isClickedRef.current ? 0.7 : 1.0;
                // w-3.5 h-3.5 is 14px, so subtracting 7 centers it
                coreRef.current.style.transform = `translate3d(${targetX - 7}px, ${targetY - 7}px, 0) scale(${coreScale})`;
            }

            animationFrameId = requestAnimationFrame(updatePosition);
        };

        animationFrameId = requestAnimationFrame(updatePosition);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mouseup', handleMouseUp);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <div className="fixed inset-0 pointer-events-none z-[999999] overflow-hidden">
            {/* Glowing Core Dot */}
            <div 
                ref={coreRef}
                className="absolute w-3.5 h-3.5 rounded-full transition-transform duration-150 ease-out"
                style={{ 
                    left: 0, 
                    top: 0,
                    backgroundColor: 'var(--accent-color, #10b981)',
                    boxShadow: 'var(--accent-glow, 0 0 15px rgba(16, 185, 129, 0.6)), 0 0 5px var(--accent-color, #10b981)'
                }}
            />
            {/* Expanding Click Pulses */}
            {pulses.map((pulse) => (
                <div 
                    key={pulse.id}
                    className="absolute w-8 h-8 border rounded-full -translate-x-1/2 -translate-y-1/2 animate-ping"
                    style={{ 
                        left: pulse.x, 
                        top: pulse.y, 
                        borderColor: 'var(--accent-color, #10b981)',
                        boxShadow: 'var(--accent-glow, 0 0 10px rgba(16, 185, 129, 0.4))',
                        animationDuration: '0.6s'
                    }}
                />
            ))}
        </div>
    );
}

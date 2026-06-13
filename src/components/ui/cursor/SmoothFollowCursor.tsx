import { useEffect, useRef } from 'react';

export function SmoothFollowCursor() {
    const pointerRef = useRef({ x: -100, y: -100 });
    const trailingRef = useRef({ x: -100, y: -100 });
    
    const coreRef = useRef<HTMLDivElement>(null);
    const trailingElementRef = useRef<HTMLDivElement>(null);
    const isClickedRef = useRef(false);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            pointerRef.current.x = e.clientX;
            pointerRef.current.y = e.clientY;
        };
        const handleMouseDown = () => {
            isClickedRef.current = true;
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
            
            // Core dot position update
            if (coreRef.current) {
                const coreScale = isClickedRef.current ? 0.6 : 1.0;
                coreRef.current.style.transform = `translate3d(${targetX - 4}px, ${targetY - 4}px, 0) scale(${coreScale})`;
            }

            // Lerp physics trail speed for outer ring
            const ease = 0.12;
            trailingRef.current.x += (targetX - trailingRef.current.x) * ease;
            trailingRef.current.y += (targetY - trailingRef.current.y) * ease;

            if (trailingElementRef.current) {
                const scale = isClickedRef.current ? 1.4 : 1.0;
                trailingElementRef.current.style.transform = `translate3d(${trailingRef.current.x - 12}px, ${trailingRef.current.y - 12}px, 0) scale(${scale})`;
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
            {/* Core dot (moved via translate3d) */}
            <div 
                ref={coreRef}
                className="absolute w-2 h-2 rounded-full transition-transform duration-150 ease-out"
                style={{ 
                    left: 0, 
                    top: 0,
                    backgroundColor: 'var(--accent-color, #10b981)',
                    boxShadow: 'var(--accent-glow, 0 0 10px rgba(16, 185, 129, 0.4))'
                }}
            />
            {/* Trailing circle (moved via translate3d) */}
            <div 
                ref={trailingElementRef}
                className="absolute w-6 h-6 border rounded-full transition-transform duration-150 ease-out"
                style={{ 
                    left: 0, 
                    top: 0,
                    borderColor: 'var(--accent-color, #10b981)',
                    boxShadow: 'var(--accent-glow, 0 0 8px rgba(16, 185, 129, 0.2))'
                }}
            />
        </div>
    );
}

import { useEffect, useRef } from 'react';

export function AuraCursor() {
    const pointerRef = useRef({ x: -100, y: -100 });
    const innerTrailRef = useRef({ x: -100, y: -100 });
    const outerTrailRef = useRef({ x: -100, y: -100 });
    
    const coreRef = useRef<HTMLDivElement>(null);
    const innerRingRef = useRef<HTMLDivElement>(null);
    const outerRingRef = useRef<HTMLDivElement>(null);
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
            
            // 1. Core Dot (Centered: w-1.5 h-1.5 is 6px, subtract 3)
            if (coreRef.current) {
                const scale = isClickedRef.current ? 0.6 : 1.0;
                coreRef.current.style.transform = `translate3d(${targetX - 3}px, ${targetY - 3}px, 0) scale(${scale})`;
            }

            // 2. Inner Ring Lerp (Centered: w-6 h-6 is 24px, subtract 12)
            const easeInner = 0.16;
            innerTrailRef.current.x += (targetX - innerTrailRef.current.x) * easeInner;
            innerTrailRef.current.y += (targetY - innerTrailRef.current.y) * easeInner;

            if (innerRingRef.current) {
                const scale = isClickedRef.current ? 1.3 : 1.0;
                innerRingRef.current.style.transform = `translate3d(${innerTrailRef.current.x - 12}px, ${innerTrailRef.current.y - 12}px, 0) scale(${scale})`;
            }

            // 3. Outer Ring Lerp (Centered: w-10 h-10 is 40px, subtract 20)
            const easeOuter = 0.08;
            outerTrailRef.current.x += (targetX - outerTrailRef.current.x) * easeOuter;
            outerTrailRef.current.y += (targetY - outerTrailRef.current.y) * easeOuter;

            if (outerRingRef.current) {
                const scale = isClickedRef.current ? 0.8 : 1.0;
                outerRingRef.current.style.transform = `translate3d(${outerTrailRef.current.x - 20}px, ${outerTrailRef.current.y - 20}px, 0) scale(${scale})`;
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
            {/* Core solid center dot */}
            <div 
                ref={coreRef}
                className="absolute w-1.5 h-1.5 rounded-full transition-transform duration-150 ease-out"
                style={{ 
                    left: 0, 
                    top: 0,
                    backgroundColor: 'var(--accent-color, #10b981)',
                    boxShadow: 'var(--accent-glow, 0 0 10px rgba(16, 185, 129, 0.6))'
                }}
            />
            {/* Inner responsive neon ring */}
            <div 
                ref={innerRingRef}
                className="absolute w-6 h-6 border rounded-full transition-transform duration-150 ease-out"
                style={{ 
                    left: 0, 
                    top: 0,
                    borderColor: 'var(--accent-color, #10b981)',
                    boxShadow: 'var(--accent-glow, 0 0 8px rgba(16, 185, 129, 0.3))'
                }}
            />
            {/* Outer parallax aura glow ring (larger, blurred, dashed border) */}
            <div 
                ref={outerRingRef}
                className="absolute w-10 h-10 border border-dashed rounded-full transition-transform duration-150 ease-out"
                style={{ 
                    left: 0, 
                    top: 0,
                    borderColor: 'rgba(var(--accent-color-rgb, 16, 185, 129), 0.25)',
                    backgroundColor: 'rgba(var(--accent-color-rgb, 16, 185, 129), 0.03)',
                    boxShadow: '0 0 12px rgba(var(--accent-color-rgb, 16, 185, 129), 0.15)'
                }}
            />
        </div>
    );
}

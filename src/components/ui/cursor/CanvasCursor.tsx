import { useEffect, useRef } from 'react';

export function CanvasCursor() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const pointerRef = useRef({ x: -100, y: -100 });
    const isClickedRef = useRef(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const resizeCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

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
        
        // Initialize coordinate history
        const pointsCount = 18;
        const points: { x: number; y: number }[] = [];
        for (let i = 0; i < pointsCount; i++) {
            points.push({ x: -100, y: -100 });
        }

        const render = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Lerp coordinates
            let targetX = pointerRef.current.x;
            let targetY = pointerRef.current.y;

            points.forEach((point, index) => {
                const ease = 0.35 - (index / pointsCount) * 0.25;
                point.x += (targetX - point.x) * ease;
                point.y += (targetY - point.y) * ease;
                targetX = point.x;
                targetY = point.y;
            });

            // Skip rendering if offscreen or cursor hasn't moved yet
            if (points[0].x < 0) {
                animationFrameId = requestAnimationFrame(render);
                return;
            }

            // Get accent color from CSS variables
            const accentColor = getComputedStyle(document.documentElement)
                .getPropertyValue('--accent-color')
                .trim() || '#10b981';

            // Draw glowing drop shadow path first (so it goes behind)
            ctx.shadowBlur = isClickedRef.current ? 16 : 8;
            ctx.shadowColor = accentColor;

            // Draw line trail
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            
            for (let i = 1; i < points.length - 1; i++) {
                const xc = (points[i].x + points[i + 1].x) / 2;
                const yc = (points[i].y + points[i + 1].y) / 2;
                ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
            }

            ctx.strokeStyle = accentColor;
            ctx.lineWidth = isClickedRef.current ? 6 : 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();

            // Draw click burst / dot at pointer head
            if (isClickedRef.current) {
                ctx.shadowBlur = 20;
                ctx.beginPath();
                ctx.arc(pointerRef.current.x, pointerRef.current.y, 5, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fill();
            }

            animationFrameId = requestAnimationFrame(render);
        };
        animationFrameId = requestAnimationFrame(render);

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mouseup', handleMouseUp);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <canvas 
            ref={canvasRef} 
            className="fixed inset-0 pointer-events-none z-[999999] w-screen h-screen overflow-hidden" 
        />
    );
}

import { useCallback, useEffect, useRef } from 'react';
import { fitViewport, wheelFactor, zoomViewport, type GraphBox, type Viewport } from '../utils/architectureLayout';

/** One viewport owner. Input changes refs; only the world transform paints on animation frames. */
export function useArchitectureViewport(bounds: GraphBox, frame: GraphBox, focusKey: string, focused: boolean) {
    const stage = useRef<HTMLDivElement>(null), world = useRef<HTMLDivElement>(null), label = useRef<HTMLSpanElement>(null);
    const view = useRef<Viewport>({ x: 0, y: 0, scale: 1 }), target = useRef(view.current);
    const raf = useRef(0), lastFrame = useRef(0), reduced = useRef(false), moved = useRef(false);
    const geometry = useRef({ bounds, frame, focused }); geometry.current = { bounds, frame, focused };
    const paint = useCallback(function draw(time: number) {
        const previous = view.current, next = target.current;
        const distance = Math.abs(previous.x - next.x) + Math.abs(previous.y - next.y) + Math.abs(previous.scale - next.scale) * 100;
        const mix = reduced.current || distance < 0.12 ? 1 : 1 - Math.exp(-Math.min(32, time - lastFrame.current || 16) / 45);
        view.current = { x: previous.x + (next.x - previous.x) * mix, y: previous.y + (next.y - previous.y) * mix,
            scale: previous.scale + (next.scale - previous.scale) * mix };
        lastFrame.current = time;
        if (world.current) world.current.style.transform = `translate(${view.current.x}px, ${view.current.y}px) scale(${view.current.scale})`;
        if (label.current) label.current.textContent = `${Math.round(view.current.scale * 100)}%`;
        raf.current = mix < 1 ? requestAnimationFrame(draw) : 0;
    }, []);
    const update = useCallback((next: Viewport, animate = true) => {
        target.current = next;
        if (!animate || reduced.current) view.current = next;
        if (!raf.current) { lastFrame.current = 0; raf.current = requestAnimationFrame(paint); }
    }, [paint]);
    const fit = useCallback((overview = false) => {
        const element = stage.current; if (!element) return;
        const { bounds: all, frame: branch, focused: readable } = geometry.current;
        const focus = !overview && readable && element.clientWidth < 680 && branch.width > 340
            ? { ...branch, x: branch.x + branch.width - 340, width: 340 } : branch;
        const next = fitViewport(overview ? all : focus, element.clientWidth, element.clientHeight, !overview && readable);
        if (!overview && readable) {
            const toolbar = element.querySelector('[data-architecture-toolbar]');
            next.y = (toolbar?.getBoundingClientRect().height || 48) + 28 - focus.y * next.scale;
        }
        update(next);
        moved.current = false;
    }, [update]);
    const zoom = useCallback((factor: number) => {
        const element = stage.current; if (!element) return;
        moved.current = true;
        update(zoomViewport(target.current, factor, element.clientWidth / 2, element.clientHeight / 2));
    }, [update]);
    const reveal = useCallback((box: GraphBox) => {
        const element = stage.current; if (!element) return;
        const v = target.current, left = box.x * v.scale + v.x, top = box.y * v.scale + v.y;
        if (left >= 0 && top >= 64 && left + box.width * v.scale <= element.clientWidth && top + box.height * v.scale <= element.clientHeight) return;
        moved.current = true; update(fitViewport(box, element.clientWidth, element.clientHeight, true));
    }, [update]);

    useEffect(() => { fit(); }, [focusKey, fit]);
    // Catalog loading can change graph bounds without changing the canvas size or navigation path.
    useEffect(() => {
        if (!moved.current) fit();
    }, [bounds.width, bounds.height, frame.x, frame.y, frame.width, frame.height, fit]);
    useEffect(() => {
        const element = stage.current; if (!element) return;
        const preference = matchMedia('(prefers-reduced-motion: reduce)');
        const changed = () => { reduced.current = preference.matches; };
        changed(); preference.addEventListener('change', changed);
        const resize = new ResizeObserver(() => { if (!moved.current) fit(); }); resize.observe(element);
        const interactive = (event: Event) => (event.target as Element).closest('button,a,input,textarea,select,[data-architecture-interactive]');
        const wheel = (event: WheelEvent) => {
            if (interactive(event)) return;
            const factor = wheelFactor(event.deltaY * (event.ctrlKey ? 3 : 1), event.deltaMode, element.clientHeight);
            if (factor === 1) return;
            event.preventDefault(); moved.current = true;
            const r = element.getBoundingClientRect();
            update(zoomViewport(target.current, factor, event.clientX - r.left, event.clientY - r.top));
        };
        const points = new Map<number, { x: number; y: number }>();
        const down = (event: PointerEvent) => {
            if (interactive(event) || event.button !== 0) return;
            points.set(event.pointerId, { x: event.clientX, y: event.clientY }); element.setPointerCapture(event.pointerId);
        };
        const move = (event: PointerEvent) => {
            const previous = points.get(event.pointerId); if (!previous) return;
            const next = { x: event.clientX, y: event.clientY }, other = [...points].find(([id]) => id !== event.pointerId)?.[1];
            points.set(event.pointerId, next); moved.current = true;
            let value = view.current;
            if (other) {
                const before = Math.hypot(previous.x - other.x, previous.y - other.y);
                const after = Math.hypot(next.x - other.x, next.y - other.y), r = element.getBoundingClientRect();
                if (before > 0) value = zoomViewport(value, after / before, (previous.x + other.x) / 2 - r.left, (previous.y + other.y) / 2 - r.top);
                value = { ...value, x: value.x + (next.x - previous.x) / 2, y: value.y + (next.y - previous.y) / 2 };
            } else value = { ...value, x: value.x + next.x - previous.x, y: value.y + next.y - previous.y };
            update(value, false);
        };
        const up = (event: PointerEvent) => {
            points.delete(event.pointerId); if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
        };
        element.addEventListener('wheel', wheel, { passive: false });
        element.addEventListener('pointerdown', down); element.addEventListener('pointermove', move);
        element.addEventListener('pointerup', up); element.addEventListener('pointercancel', up); element.addEventListener('lostpointercapture', up);
        return () => {
            resize.disconnect(); preference.removeEventListener('change', changed); cancelAnimationFrame(raf.current); raf.current = 0;
            element.removeEventListener('wheel', wheel); element.removeEventListener('pointerdown', down); element.removeEventListener('pointermove', move);
            element.removeEventListener('pointerup', up); element.removeEventListener('pointercancel', up); element.removeEventListener('lostpointercapture', up);
            points.clear();
        };
    }, [fit, update]);
    return { stage, world, label, fit, zoom, reveal };
}

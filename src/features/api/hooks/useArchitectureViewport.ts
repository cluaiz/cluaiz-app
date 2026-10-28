import { useCallback, useEffect, useRef } from 'react';
import { fitViewport, revealViewport, wheelFactor, zoomViewport, type GraphBox, type Viewport } from '../utils/architectureLayout';

/** One viewport owner. Input changes refs; only the world transform paints on animation frames. */
export function useArchitectureViewport(bounds: GraphBox, frame: GraphBox, ready: boolean, focused: boolean) {
    const stage = useRef<HTMLDivElement>(null), world = useRef<HTMLDivElement>(null), label = useRef<HTMLSpanElement>(null);
    const view = useRef<Viewport>({ x: 0, y: 0, scale: 1 }), target = useRef(view.current);
    const raf = useRef(0), lastFrame = useRef(0), reduced = useRef(false), initialized = useRef(false);
    const geometry = useRef({ bounds, frame, focused, ready }); geometry.current = { bounds, frame, focused, ready };
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
        const focus = branch;
        const next = fitViewport(overview ? all : focus, element.clientWidth, element.clientHeight);
        if (!overview && readable) {
            const toolbar = element.querySelector('[data-architecture-toolbar]');
            next.y = (toolbar?.getBoundingClientRect().height || 48) + 28 - focus.y * next.scale;
        }
        update(next);
    }, [update]);
    const zoom = useCallback((factor: number) => {
        const element = stage.current; if (!element) return;
        update(zoomViewport(target.current, factor, element.clientWidth / 2, element.clientHeight / 2));
    }, [update]);
    const reveal = useCallback((box: GraphBox) => {
        const element = stage.current; if (!element) return;
        const toolbar = element.querySelector('[data-architecture-toolbar]');
        const next = revealViewport(target.current, box, element.clientWidth, element.clientHeight, (toolbar?.getBoundingClientRect().height || 48) + 16);
        if (next !== target.current) update(next);
    }, [update]);

    // Only the first real catalog gets an automatic Fit. Selection and new descendants preserve the camera.
    useEffect(() => {
        if (ready && !initialized.current && stage.current?.clientWidth) { fit(true); initialized.current = true; }
    }, [ready, fit]);
    useEffect(() => {
        const element = stage.current; if (!element) return;
        const preference = matchMedia('(prefers-reduced-motion: reduce)');
        const changed = () => { reduced.current = preference.matches; };
        changed(); preference.addEventListener('change', changed);
        const resize = new ResizeObserver(() => {
            if (!initialized.current && geometry.current.ready) { fit(true); initialized.current = true; }
        }); resize.observe(element);
        const interactive = (event: Event) => (event.target as Element).closest('button,a,input,textarea,select,summary,[data-architecture-interactive]');
        const wheel = (event: WheelEvent) => {
            if (interactive(event)) return;
            const factor = wheelFactor(event.deltaY * (event.ctrlKey ? 3 : 1), event.deltaMode, element.clientHeight);
            if (factor === 1) return;
            event.preventDefault();
            const r = element.getBoundingClientRect();
            update(zoomViewport(target.current, factor, event.clientX - r.left, event.clientY - r.top));
        };
        const points = new Map<number, { x: number; y: number }>();
        const down = (event: PointerEvent) => {
            if (interactive(event) || event.button !== 0) return;
            element.style.cursor = 'grabbing';
            points.set(event.pointerId, { x: event.clientX, y: event.clientY }); element.setPointerCapture(event.pointerId);
        };
        const move = (event: PointerEvent) => {
            const previous = points.get(event.pointerId); if (!previous) return;
            const next = { x: event.clientX, y: event.clientY }, other = [...points].find(([id]) => id !== event.pointerId)?.[1];
            points.set(event.pointerId, next);
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
            if (!points.size) element.style.cursor = '';
        };
        element.addEventListener('wheel', wheel, { passive: false });
        element.addEventListener('pointerdown', down); element.addEventListener('pointermove', move);
        element.addEventListener('pointerup', up); element.addEventListener('pointercancel', up); element.addEventListener('lostpointercapture', up);
        return () => {
            resize.disconnect(); preference.removeEventListener('change', changed); cancelAnimationFrame(raf.current); raf.current = 0;
            element.removeEventListener('wheel', wheel); element.removeEventListener('pointerdown', down); element.removeEventListener('pointermove', move);
            element.removeEventListener('pointerup', up); element.removeEventListener('pointercancel', up); element.removeEventListener('lostpointercapture', up);
            points.clear();
            element.style.cursor = '';
        };
    }, [fit, update]);
    return { stage, world, label, fit, zoom, reveal };
}

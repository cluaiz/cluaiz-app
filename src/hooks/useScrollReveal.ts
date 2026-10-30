import { useReducedMotion } from 'framer-motion';

interface ScrollRevealOptions {
    disabled?: boolean;
    amount?: number | 'some' | 'all';
    scale?: number;
}

/** Viewport-only animation; native scrolling and the element's layout stay unchanged. */
export function useScrollReveal({ disabled = false, amount = 0.5, scale = 0.8 }: ScrollRevealOptions = {}) {
    const reduceMotion = useReducedMotion();
    const visible = { scale: 1, y: 0, opacity: 1 };
    return {
        initial: false as const,
        animate: disabled || reduceMotion ? visible : { scale, y: 12, opacity: 0 },
        whileInView: visible,
        viewport: { amount, once: false },
        transition: { type: 'spring' as const, stiffness: 320, damping: 24, opacity: { duration: 0.18 } },
    };
}

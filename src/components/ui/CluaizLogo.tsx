import React from 'react';
import { useThemeStore, isThemeDark } from '../../store/ui/useThemeStore';

export interface CluaizLogoProps {
    size?: number | string;
    className?: string;
    glow?: boolean;
    interactive?: boolean;
    alt?: string;
    variant?: 'auto' | 'dark' | 'light';
}

export const CluaizLogo: React.FC<CluaizLogoProps> = ({
    size = 32,
    className = '',
    glow = false,
    interactive = false,
    alt = 'Cluaiz Logo',
    variant = 'auto',
}) => {
    const theme = useThemeStore((s) => s.theme);
    const isDark = isThemeDark(theme);

    // Dynamic SVG resolution based on current theme:
    // On dark themes (dark/oled/etc.), cluaiz-light.svg gives crisp high-contrast white contour on dark background.
    // On light themes, cluaiz-dark.svg gives crisp high-contrast dark contour on light background.
    const logoSrc = variant === 'dark'
        ? '/logo/cluaiz-dark.svg'
        : variant === 'light'
            ? '/logo/cluaiz-light.svg'
            : isDark
                ? '/logo/cluaiz-light.svg'
                : '/logo/cluaiz-dark.svg';

    const dim = typeof size === 'number' ? `${size}px` : size;

    return (
        <div
            className={`relative inline-flex items-center justify-center shrink-0 ${
                interactive ? 'transition-transform duration-300 hover:scale-105 active:scale-95' : ''
            } ${className}`}
            style={{ width: dim, height: dim }}
        >
            {glow && (
                <div
                    className="absolute inset-0 rounded-full blur-md opacity-35 pointer-events-none"
                    style={{ background: 'var(--accent-color, #00f0ff)' }}
                    aria-hidden="true"
                />
            )}
            <img
                src={logoSrc}
                alt={alt}
                className="w-full h-full object-contain select-none pointer-events-none drop-shadow-[0_2px_10px_rgba(0,0,0,0.4)]"
                loading="eager"
            />
        </div>
    );
};

export default CluaizLogo;

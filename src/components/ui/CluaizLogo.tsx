import React from 'react';

export interface CluaizLogoProps {
    size?: number | string;
    className?: string;
    glow?: boolean;
    interactive?: boolean;
    alt?: string;
    /** Kept so callers still compile; every variant shows the same logo */
    variant?: 'auto' | 'dark' | 'light';
}

export const CluaizLogo: React.FC<CluaizLogoProps> = ({
    size = 32,
    className = '',
    glow = false,
    interactive = false,
    alt = 'Cluaiz Logo',
}) => {
    // One logo for every theme: its dark outline shows on light backgrounds and its white body on dark ones
    const logoSrc = '/logo/logo.svg';

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

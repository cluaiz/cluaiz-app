import React from 'react';

export interface CluaizLogoProps {
    size?: number | string;
    className?: string;
    glow?: boolean;
    interactive?: boolean;
    alt?: string;
}

export const CluaizLogo: React.FC<CluaizLogoProps> = ({
    size = 32,
    className = '',
    glow = false,
    interactive = false,
    alt = 'Cluaiz Logo'
}) => {
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
                src="/logo/icon-512.png"
                srcSet="/logo/icon-512.png 512w, /logo/logo-bg-black.png 4096w"
                sizes={`${dim}`}
                alt={alt}
                className="w-full h-full object-contain select-none pointer-events-none drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]"
                loading="eager"
            />
        </div>
    );
};

export default CluaizLogo;

import React, { useEffect, useState, useRef } from 'react';
import { Lottie } from 'lottie-react';

interface LottieEmojiProps {
    path: string;
    alt?: string;
    style?: React.CSSProperties;
    shouldPreload?: boolean;
    playOnHover?: boolean;
    loop?: boolean | number;
    autoplay?: boolean;
    [key: string]: any;
}

const animationCache: Record<string, any> = {};

export const LottieEmoji: React.FC<LottieEmojiProps> = ({ 
    path, 
    alt, 
    style, 
    shouldPreload = false, 
    playOnHover = true,
    ...props 
}) => {
    const [animationData, setAnimationData] = useState<any>(animationCache[path] || null);
    const [error, setError] = useState(false);
    const [isLoaded, setIsLoaded] = useState(!!animationCache[path]);

    useEffect(() => {
        if (animationCache[path]) {
            setAnimationData(animationCache[path]);
            setIsLoaded(true);
            setError(false);
            return;
        }

        let isMounted = true;
        setError(false);
        setIsLoaded(false);

        fetch(path)
            .then(res => {
                if (!res.ok) throw new Error('Failed to load emoji');
                return res.json();
            })
            .then(data => {
                if (isMounted) {
                    animationCache[path] = data; // Cache in memory
                    setAnimationData(data);
                    setIsLoaded(true);
                }
            })
            .catch(() => {
                if (isMounted) setError(true);
            });

        return () => { isMounted = false; };
    }, [path]);

    if (error) {
        return <span style={{ fontSize: '1.5em' }}>{alt || ''}</span>;
    }

    if (!isLoaded || !animationData) {
        return (
            <div style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="text-xl leading-none select-none">{alt || ''}</span>
            </div>
        );
    }

    return (
        <LottieInner
            animationData={animationData}
            playOnHover={playOnHover}
            style={style}
            alt={alt}
            {...props}
        />
    );
};

const LottieInner: React.FC<{
    animationData: any;
    playOnHover: boolean;
    style?: React.CSSProperties;
    alt?: string;
    loop?: boolean | number;
    autoplay?: boolean;
    onComplete?: (event?: any) => void;
    [key: string]: any;
}> = ({
    animationData,
    playOnHover,
    style,
    alt,
    loop,
    autoplay,
    onComplete,
    ...restProps
}) => {
    const lottieRef = useRef<any>(null);
    const [isHovered, setIsHovered] = useState(false);
    const initialPlayedRef = useRef(false);

    // Respect explicit autoplay prop; fallback to false if playOnHover
    const shouldAutoplay = autoplay !== undefined ? autoplay : !playOnHover;
    const shouldLoop = loop ?? false;

    useEffect(() => {
        if (!shouldAutoplay || !lottieRef.current || initialPlayedRef.current) return;
        initialPlayedRef.current = true;
        lottieRef.current?.goToAndPlay?.(0, true);
    }, [shouldAutoplay]);

    const handleMouseEnter = () => {
        if (!playOnHover) return;
        setIsHovered(true);
        lottieRef.current?.goToAndPlay?.(0, true);
    };

    const handleMouseLeave = () => {
        if (!playOnHover) return;
        setIsHovered(false);
    };

    return (
        <div 
            style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            className={`transition-transform duration-200 select-none ${playOnHover ? 'hover:scale-115 active:scale-95' : ''}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <Lottie
                lottieRef={lottieRef}
                src={animationData}
                loop={shouldLoop}
                autoplay={shouldAutoplay}
                style={{ width: '100%', height: '100%', ...style }}
                {...restProps}
            />
        </div>
    );
};

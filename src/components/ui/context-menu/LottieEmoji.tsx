import React, { useEffect, useState } from 'react';
import { useLottie, type LottieComponentProps } from 'lottie-react';

interface LottieEmojiProps extends Omit<LottieComponentProps, 'animationData'> {
    path: string;
    alt?: string;
    shouldPreload?: boolean;
    playOnHover?: boolean;
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
        if (animationData || error) return;

        let isMounted = true;

        fetch(path)
            .then(res => {
                if (!res.ok) throw new Error('Failed to load emoji');
                return res.json();
            })
            .then(data => {
                if (isMounted) {
                    animationCache[path] = data; // Cache it
                    setAnimationData(data);
                    setIsLoaded(true);
                }
            })
            .catch(() => {
                if (isMounted) setError(true);
            });

        return () => { isMounted = false; };
    }, [path, animationData, error]);

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
    onComplete?: LottieComponentProps['onComplete'];
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
    const [isHovered, setIsHovered] = useState(false);

    const defaultLoop = playOnHover ? isHovered : (loop ?? true);
    const defaultAutoplay = playOnHover ? true : (autoplay ?? true);

    const options = {
        animationData,
        loop: defaultLoop,
        autoplay: defaultAutoplay,
        onComplete: (event: any) => {
            if (playOnHover && !isHovered) {
                stop();
            } else if (onComplete) {
                onComplete(event);
            }
        },
        ...restProps
    };

    const { View, play, stop } = useLottie(options, style);

    useEffect(() => {
        if (!playOnHover) return;
        if (isHovered) {
            play();
        } else {
            stop();
        }
    }, [isHovered, playOnHover, play, stop]);

    const handleMouseEnter = () => {
        if (!playOnHover) return;
        setIsHovered(true);
    };

    const handleMouseLeave = () => {
        if (!playOnHover) return;
        setIsHovered(false);
    };

    return (
        <div 
            style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {View}
        </div>
    );
};


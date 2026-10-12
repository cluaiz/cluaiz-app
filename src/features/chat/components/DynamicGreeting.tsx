import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lottie } from 'lottie-react';

interface TimeGreeting {
    text: string;
    emojiPath: string;
    alt: string;
}

/**
 * 100% Dynamic local hardware RTC / Client Timezone resolution.
 * Accurately determines local time of day regardless of OS (Windows, Mac, Linux)
 * or Country/Timezone.
 */
function getTimeGreetingData(): TimeGreeting {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
        return {
            text: 'Good morning',
            emojiPath: '/emojis/sunwithface_1f31e.json',
            alt: 'Morning Sun',
        };
    }
    if (hour >= 12 && hour < 17) {
        return {
            text: 'Good afternoon',
            emojiPath: '/emojis/sunwithface_1f31e.json',
            alt: 'Afternoon Sun',
        };
    }
    if (hour >= 17 && hour < 22) {
        return {
            text: 'Good evening',
            emojiPath: '/emojis/warmsmile_263a_fe0f.json',
            alt: 'Warm Evening',
        };
    }
    // Late night / early morning (22:00 - 04:59)
    return {
        text: 'Good night',
        emojiPath: '/emojis/glowingstar_1f31f.json',
        alt: 'Good Night Star',
    };
}

interface GreetingDef {
    id: string;
    getText: () => string;
    getEmojiPath: () => string;
    getAlt: () => string;
    weight: number;
}

const GREETINGS: GreetingDef[] = [
    // 80% heavy dominance for primary greetings (40% + 40%)
    {
        id: 'hello',
        getText: () => 'Hello there',
        getEmojiPath: () => '/emojis/wave_1f44b.json',
        getAlt: () => 'Wave',
        weight: 40,
    },
    {
        id: 'time_aware',
        getText: () => getTimeGreetingData().text,
        getEmojiPath: () => getTimeGreetingData().emojiPath,
        getAlt: () => getTimeGreetingData().alt,
        weight: 40,
    },
    // Remaining 20% distributed among creative intelligent prompts (4% each)
    {
        id: 'help',
        getText: () => 'How can I help you today?',
        getEmojiPath: () => '/emojis/smile_1f600.json',
        getAlt: () => 'Smile',
        weight: 4,
    },
    {
        id: 'building',
        getText: () => 'What are we building today?',
        getEmojiPath: () => '/emojis/rocket_1f680.json',
        getAlt: () => 'Rocket',
        weight: 4,
    },
    {
        id: 'ideas',
        getText: () => 'Have an idea to explore?',
        getEmojiPath: () => '/emojis/lightbulb_1f4a1.json',
        getAlt: () => 'Idea',
        weight: 4,
    },
    {
        id: 'thinking',
        getText: () => "What's on your mind?",
        getEmojiPath: () => '/emojis/thinkingface_1f914.json',
        getAlt: () => 'Thinking',
        weight: 4,
    },
    {
        id: 'ready',
        getText: () => 'Ready when you are',
        getEmojiPath: () => '/emojis/robot_1f916.json',
        getAlt: () => 'Assistant',
        weight: 4,
    },
];

/**
 * True weighted random sampling (cumulative distribution wheel).
 * Completely eliminates serial / sequential looping.
 */
function pickNextGreeting(currentId: string): GreetingDef {
    const candidates = GREETINGS.filter((g) => g.id !== currentId);
    const totalWeight = candidates.reduce((sum, g) => sum + g.weight, 0);
    const rand = Math.random() * totalWeight;

    let cumulative = 0;
    for (const g of candidates) {
        cumulative += g.weight;
        if (rand < cumulative) {
            return g;
        }
    }
    return candidates[0] || GREETINGS[0];
}

const animationCache: Record<string, any> = {};

const ControlledLottie: React.FC<{ path: string; alt: string }> = ({ path, alt }) => {
    const [animationData, setAnimationData] = useState<any>(animationCache[path] || null);
    const lottieRef = useRef<any>(null);

    useEffect(() => {
        if (animationCache[path]) {
            setAnimationData(animationCache[path]);
            return;
        }
        let isMounted = true;
        fetch(path)
            .then((res) => {
                if (!res.ok) throw new Error('Failed to load emoji: ' + res.status);
                return res.json();
            })
            .then((data) => {
                if (isMounted) {
                    animationCache[path] = data;
                    setAnimationData(data);
                }
            })
            .catch(() => {});

        return () => {
            isMounted = false;
        };
    }, [path]);

    useEffect(() => {
        // Organic mid-cycle pulse: after initial animation + 3.5s-4.8s natural rest,
        // gently replay once to keep the UI emotionally alive and expressive.
        const randomDelay = 3600 + Math.random() * 1200;
        const pulseTimer = setTimeout(() => {
            if (lottieRef.current) {
                lottieRef.current.stop?.();
                lottieRef.current.play?.();
                lottieRef.current.goToAndPlay?.(0, true);
            }
        }, randomDelay);

        return () => clearTimeout(pulseTimer);
    }, [path]);

    const handleMouseEnter = () => {
        if (lottieRef.current) {
            lottieRef.current.stop?.();
            lottieRef.current.play?.();
            lottieRef.current.goToAndPlay?.(0, true);
        }
    };

    if (!animationData) {
        return <div style={{ width: 40, height: 40 }} className="flex-shrink-0" />;
    }

    return (
        <div
            style={{ width: 40, height: 40, minWidth: 40, minHeight: 40 }}
            className="flex items-center justify-center cursor-pointer transition-transform duration-200 hover:scale-110 active:scale-95 flex-shrink-0"
            onMouseEnter={handleMouseEnter}
            title={alt}
        >
            {(Lottie as any) && (
                <Lottie
                    {...({
                        lottieRef,
                        src: animationData,
                        animationData,
                        loop: false,
                        autoplay: true,
                        style: { width: 40, height: 40 }
                    } as any)}
                />
            )}
        </div>
    );
};

export const DynamicGreeting: React.FC = () => {
    // Initial greeting starts with Hello there or Time-aware
    const [currentGreeting, setCurrentGreeting] = useState<GreetingDef>(() => {
        return Math.random() < 0.5 ? GREETINGS[0] : GREETINGS[1];
    });
    const [cycleCount, setCycleCount] = useState(0);

    useEffect(() => {
        // Pre-cache all greeting emojis in background for zero-latency switches
        const pathsToPreload = [
            '/emojis/wave_1f44b.json',
            '/emojis/sunwithface_1f31e.json',
            '/emojis/warmsmile_263a_fe0f.json',
            '/emojis/glowingstar_1f31f.json',
            '/emojis/smile_1f600.json',
            '/emojis/rocket_1f680.json',
            '/emojis/lightbulb_1f4a1.json',
            '/emojis/thinkingface_1f914.json',
            '/emojis/robot_1f916.json',
        ];
        pathsToPreload.forEach((p) => {
            if (!animationCache[p]) {
                fetch(p)
                    .then((res) => (res.ok ? res.json() : null))
                    .then((data) => {
                        if (data) animationCache[p] = data;
                    })
                    .catch(() => {});
            }
        });

        // Rotates every 12 seconds with true weighted random draw
        const timer = setInterval(() => {
            setCurrentGreeting((prev) => pickNextGreeting(prev.id));
            setCycleCount((c) => c + 1);
        }, 12000);

        return () => clearInterval(timer);
    }, []);

    const greetingText = useMemo(() => {
        return currentGreeting.getText();
    }, [currentGreeting, cycleCount]);

    const greetingEmojiPath = useMemo(() => {
        return currentGreeting.getEmojiPath();
    }, [currentGreeting, cycleCount]);

    const greetingAlt = useMemo(() => {
        return currentGreeting.getAlt();
    }, [currentGreeting, cycleCount]);

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={`${currentGreeting.id}-${cycleCount}`}
                initial={{ opacity: 0, y: 8, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -8, filter: 'blur(6px)' }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-center justify-center gap-2.5 mb-8 select-none"
            >
                <ControlledLottie
                    path={greetingEmojiPath}
                    alt={greetingAlt}
                />
                <h1 className="text-xl sm:text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
                    {greetingText}
                </h1>
            </motion.div>
        </AnimatePresence>
    );
};

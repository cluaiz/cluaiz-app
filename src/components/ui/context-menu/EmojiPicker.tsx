import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Clock, Smile, User, Cat, Coffee, Plane, Activity, Lightbulb, Hash, Flag, X } from 'lucide-react';
import { EmojiMeta, type EmojiMetadata } from '../../../assets/EmojiMeta';
import { LottieEmoji } from './LottieEmoji';

interface EmojiPickerProps {
    onSelect: (emoji: string) => void;
    onClose?: () => void;
    isOpen?: boolean;
}

const CATEGORIES = [
    { id: 'recent', label: 'Recent', icon: Clock },
    { id: 'Smileys and emotions', label: 'Smileys', icon: Smile },
    { id: 'People', label: 'People', icon: User },
    { id: 'Animals and nature', label: 'Nature', icon: Cat },
    { id: 'Food and drink', label: 'Food', icon: Coffee },
    { id: 'Travel and places', label: 'Travel', icon: Plane },
    { id: 'Activities and events', label: 'Activity', icon: Activity },
    { id: 'Objects', label: 'Objects', icon: Lightbulb },
    { id: 'Symbols', label: 'Symbols', icon: Hash },
    { id: 'Flags', label: 'Flags', icon: Flag },
];

const RECENT_KEY = 'cluaiz_recent_emojis';
const MAX_RECENT = 18;

const getEmojiFromCodepoint = (codepoint: string) => {
    try {
        return String.fromCodePoint(parseInt(codepoint, 16));
    } catch {
        return '';
    }
};

function cn(...classes: (string | boolean | undefined | null)[]) {
    return classes.filter(Boolean).join(' ');
}

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelect }) => {
    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState('Smileys and emotions');
    const [recent, setRecent] = useState<string[]>([]);

    useEffect(() => {
        const stored = localStorage.getItem(RECENT_KEY);
        if (stored) {
            setRecent(JSON.parse(stored));
        }
    }, []);

    const handleSelect = (emoji: string, codepoint: string) => {
        onSelect(emoji);
        const newRecent = [codepoint, ...recent.filter(c => c !== codepoint)].slice(0, MAX_RECENT);
        setRecent(newRecent);
        localStorage.setItem(RECENT_KEY, JSON.stringify(newRecent));
    };

    const filteredEmojis = useMemo(() => {
        if (search) {
            const lowerSearch = search.toLowerCase();
            return (Object.entries(EmojiMeta) as [string, EmojiMetadata][]).filter(([_, data]) => {
                return data.name.includes(lowerSearch) || data.tags.some((t: string) => t.includes(lowerSearch));
            });
        }

        if (activeCategory === 'recent') {
            return recent.map(code => [code, EmojiMeta[code]]).filter(([_, data]) => !!data) as [string, EmojiMetadata][];
        }

        return (Object.entries(EmojiMeta) as [string, EmojiMetadata][]).filter(([_, data]) => data.category === activeCategory);
    }, [search, activeCategory, recent]);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="w-[320px] h-[350px] bg-white dark:bg-zinc-950/95 backdrop-blur-md border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        >
            {/* Header */}
            <div className="p-3 border-b border-black/5 dark:border-white/5 bg-black/5 dark:bg-white/5 space-y-3">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                    <input
                        type="text"
                        placeholder="Search emojis..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-zinc-100 dark:bg-[#0f1519] border border-black/10 dark:border-white/10 rounded-full py-2 pl-9 pr-4 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-blue-500/50 transition-colors"
                    />
                    {search && (
                        <button
                            onClick={() => setSearch('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Categories */}
                <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar scroll-smooth">
                    {CATEGORIES.map(cat => {
                        const Icon = cat.icon;
                        const isActive = !search && activeCategory === cat.id;
                        return (
                            <button
                                key={cat.id}
                                onClick={() => {
                                    setActiveCategory(cat.id);
                                    setSearch('');
                                }}
                                className={cn(
                                    "p-2 rounded-full transition-all flex-shrink-0 group relative",
                                    isActive ? "bg-blue-500/10 text-blue-500 dark:text-blue-400" : "text-zinc-500 hover:bg-black/5 dark:hover:bg-white/5 hover:text-zinc-700 dark:hover:text-zinc-300"
                                )}
                                title={cat.label}
                            >
                                <Icon className="w-5 h-5" />
                                {isActive && (
                                    <motion.div
                                        layoutId="active-pill"
                                        className="absolute inset-0 border-2 border-blue-500/30 rounded-full"
                                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                    />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* List scroll container */}
            <div className="flex-1 p-2 overflow-y-auto no-scrollbar">
                {activeCategory === 'recent' && !search && recent.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-2 min-h-[200px]">
                        <Clock className="w-8 h-8 opacity-50" />
                        <span className="text-sm">No recent emojis</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-6 gap-2 pb-2">
                        {filteredEmojis.map(([code, data]) => (
                            <button
                                key={code}
                                onClick={() => handleSelect(getEmojiFromCodepoint(code), code)}
                                className="aspect-square flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-transform hover:scale-110 active:scale-95 cursor-pointer"
                                title={data.name}
                            >
                                <LottieEmoji
                                    path={data.path}
                                    style={{ width: 32, height: 32 }}
                                    alt={getEmojiFromCodepoint(code)}
                                    playOnHover={false}
                                />
                            </button>
                        ))}
                    </div>
                )}
                {filteredEmojis.length === 0 && search && (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-2 pt-10 min-h-[200px]">
                        <span className="text-xl">😕</span>
                        <span className="text-sm">No emojis found</span>
                    </div>
                )}
            </div>
        </motion.div>
    );
};

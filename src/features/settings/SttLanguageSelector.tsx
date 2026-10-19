import React, { useEffect, useState, useMemo } from 'react';
import { Languages, Search, X, Check, Globe } from 'lucide-react';
import { audioApi } from '../../api/engine/audio/audio.api';
import {
    getSpeakerLanguages,
    saveSpeakerLanguages,
    languageLabel,
    MAX_SPEAKER_LANGUAGES,
} from '../../services/audio/speakerLanguages';

interface SttLanguageSelectorProps {
    modelId: string;
}

export function SttLanguageSelector({ modelId }: SttLanguageSelectorProps) {
    const [chosen, setChosen] = useState<string[]>(getSpeakerLanguages);
    const [available, setAvailable] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState('');

    useEffect(() => {
        if (!modelId) {
            setAvailable([]);
            return;
        }

        let isMounted = true;
        setLoading(true);
        setError(null);

        audioApi
            .languages(modelId)
            .then((list) => {
                if (!isMounted) return;
                setAvailable(list);
            })
            .catch((err) => {
                if (!isMounted) return;
                setError(err?.message || 'Could not load languages for this speech-to-text model');
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [modelId]);

    const update = (next: string[]) => {
        setChosen(next);
        saveSpeakerLanguages(next);
    };

    const toggle = (code: string) => {
        if (chosen.includes(code)) {
            update(chosen.filter((c) => c !== code));
        } else if (chosen.length < MAX_SPEAKER_LANGUAGES) {
            update([...chosen, code]);
        }
    };

    const labels = useMemo(
        () => new Map(available.concat(chosen).map((code) => [code, languageLabel(code)])),
        [available, chosen]
    );

    const matches = useMemo(() => {
        const q = query.trim().toLowerCase();
        return available
            .filter((code) => !q || code.includes(q) || (labels.get(code) || '').toLowerCase().includes(q))
            .sort((a, b) => (labels.get(a) || a).localeCompare(labels.get(b) || b));
    }, [available, labels, query]);

    return (
        <div className="w-full mt-2.5 p-3.5 bg-[var(--bg-secondary)]/40 border border-[var(--border-color)]/80 rounded-xl space-y-3 transition-all">
            {/* Header info */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-[var(--accent-color)]/10 text-[var(--accent-color)]">
                        <Languages size={15} />
                    </div>
                    <div>
                        <div className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                            <span>Recognized Spoken Languages</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)] border border-[var(--border-color)]">
                                {chosen.length === 0 ? 'All (Auto-Detect)' : `${chosen.length}/${MAX_SPEAKER_LANGUAGES} selected`}
                            </span>
                        </div>
                        <p className="text-[11px] text-[var(--text-muted)]">
                            Microphone prioritizes these languages during speech recognition. Leave empty for all.
                        </p>
                    </div>
                </div>

                {chosen.length > 0 && (
                    <button
                        type="button"
                        onClick={() => update([])}
                        className="text-[11px] text-[var(--text-muted)] hover:text-red-400 transition-colors cursor-pointer"
                    >
                        Clear All
                    </button>
                )}
            </div>

            {/* Chosen language chips */}
            {chosen.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-[var(--border-color)]/50">
                    {chosen.map((code) => (
                        <span
                            key={code}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--accent-color)]/15 text-[var(--accent-color)] border border-[var(--accent-color)]/30 transition-all"
                        >
                            <span>{labels.get(code) || code}</span>
                            <button
                                type="button"
                                onClick={() => toggle(code)}
                                className="p-0.5 hover:bg-black/20 rounded cursor-pointer transition-colors"
                                title={`Remove ${labels.get(code) || code}`}
                            >
                                <X size={11} />
                            </button>
                        </span>
                    ))}
                </div>
            )}

            {/* Search and picker box if model has languages */}
            {available.length > 0 && (
                <div className="space-y-2 pt-1 border-t border-[var(--border-color)]/40">
                    <div className="relative">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={`Search ${available.length} languages (e.g. Hindi, English, Spanish)...`}
                            className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-color)]"
                        />
                    </div>

                    <div className="max-h-36 overflow-y-auto pr-1 flex flex-wrap gap-1.5 custom-scrollbar">
                        {matches.slice(0, 40).map((code) => {
                            const isSelected = chosen.includes(code);
                            return (
                                <button
                                    key={code}
                                    type="button"
                                    onClick={() => toggle(code)}
                                    className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer border ${
                                        isSelected
                                            ? 'bg-[var(--accent-color)] text-white border-[var(--accent-color)] shadow-sm'
                                            : 'bg-[var(--bg-primary)]/70 text-[var(--text-secondary)] border-[var(--border-color)] hover:border-[var(--accent-color)]/50 hover:bg-[var(--bg-tertiary)]'
                                    }`}
                                >
                                    {isSelected && <Check size={10} />}
                                    <span>{labels.get(code) || code}</span>
                                </button>
                            );
                        })}
                        {matches.length === 0 && (
                            <p className="text-xs text-[var(--text-muted)] py-2 px-1">
                                No matching languages found for "{query}".
                            </p>
                        )}
                    </div>
                </div>
            )}

            {error && (
                <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
                    ⚠️ {error}
                </div>
            )}
        </div>
    );
}

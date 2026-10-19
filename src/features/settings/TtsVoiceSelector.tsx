import React, { useEffect, useState, useMemo } from 'react';
import { Volume2, Globe, Sparkles } from 'lucide-react';
import { CustomDropdown, DropdownOption } from '../../components/ui/dropdown/CustomDropdown';
import { audioApi } from '../../api/engine/audio/audio.api';
import type { TtsVoice } from '../../api/engine/audio/audio.types';
import { languageLabel } from '../../services/audio/speakerLanguages';
import {
    getStoredTtsSettings,
    saveStoredTtsSettings,
} from '../../components/ui/AudioControlSettingsModal';

interface TtsVoiceSelectorProps {
    modelId: string;
}

const LANG_DISPLAY_NAMES: Record<string, string> = {
    'en-us': 'English (US)',
    'en-gb': 'English (UK)',
    'hi': 'Hindi · हिन्दी',
    'ja': 'Japanese · 日本語',
    'zh': 'Chinese · 中文',
    'es': 'Spanish · Español',
    'fr': 'French · Français',
    'it': 'Italian · Italiano',
    'pt': 'Portuguese · Português',
    'de': 'German · Deutsch',
};

function inferVoiceLanguage(v: TtsVoice): string | null {
    if (v.language) return v.language.toLowerCase();
    if (v.id === 'default') return null;
    const prefix = v.id.slice(0, 2).toLowerCase();
    switch (prefix[0]) {
        case 'a': return 'en-us';
        case 'b': return 'en-gb';
        case 'h': return 'hi';
        case 'j': return 'ja';
        case 'z': return 'zh';
        case 'e': return 'es';
        case 'f': return 'fr';
        case 'i': return 'it';
        case 'p': return 'pt';
        default: return null;
    }
}

function getLangDisplayName(code: string): string {
    return LANG_DISPLAY_NAMES[code.toLowerCase()] || languageLabel(code);
}

export function TtsVoiceSelector({ modelId }: TtsVoiceSelectorProps) {
    const [voices, setVoices] = useState<TtsVoice[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [selectedVoice, setSelectedVoice] = useState<string>(() => {
        const stored = getStoredTtsSettings();
        return stored.selectedVoice || 'default';
    });

    const [selectedLang, setSelectedLang] = useState<string>('all');

    useEffect(() => {
        if (!modelId) {
            setVoices([]);
            return;
        }

        let isMounted = true;
        setLoading(true);
        setError(null);

        audioApi
            .voices(modelId)
            .then((list) => {
                if (!isMounted) return;
                setVoices(list);

                const currentStored = getStoredTtsSettings().selectedVoice || 'default';
                const matchedVoice = list.find((v) => v.id === currentStored);
                const nextVoice = matchedVoice ? currentStored : (list[0]?.id || 'default');
                setSelectedVoice(nextVoice);

                // Auto-detect language of initial voice
                if (matchedVoice && matchedVoice.id !== 'default') {
                    const l = inferVoiceLanguage(matchedVoice);
                    if (l) setSelectedLang(l);
                }

                saveStoredTtsSettings({
                    ...getStoredTtsSettings(),
                    selectedModel: modelId,
                    selectedVoice: nextVoice,
                });
            })
            .catch((err) => {
                if (!isMounted) return;
                setError(err?.message || 'Failed to load voices for this model');
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [modelId]);

    // Distinct list of available languages for this model
    const languageOptions: DropdownOption[] = useMemo(() => {
        const langSet = new Set<string>();
        for (const v of voices) {
            const l = inferVoiceLanguage(v);
            if (l) langSet.add(l);
        }

        const list = Array.from(langSet).sort();
        const opts: DropdownOption[] = [
            {
                value: 'all',
                label: 'All Languages',
                description: `Show all ${voices.length} voices in model`,
            },
        ];

        for (const code of list) {
            const count = voices.filter((v) => inferVoiceLanguage(v) === code).length;
            opts.push({
                value: code,
                label: getLangDisplayName(code),
                description: `${count} ${count === 1 ? 'voice' : 'voices'} available`,
            });
        }

        return opts;
    }, [voices]);

    // Voices filtered by chosen language
    const filteredVoices = useMemo(() => {
        if (selectedLang === 'all') return voices;
        return voices.filter((v) => {
            if (v.id === 'default') return true; // Always allow Default/Auto voice
            return inferVoiceLanguage(v) === selectedLang;
        });
    }, [voices, selectedLang]);

    // Dropdown options for filtered voices
    const voiceOptions: DropdownOption[] = useMemo(() => {
        if (filteredVoices.length === 0) {
            return [{ value: 'default', label: 'Default Voice (Auto)' }];
        }
        return filteredVoices.map((v) => {
            const isDef = v.id === 'default' || v.default;
            const langCode = inferVoiceLanguage(v);
            const langSuffix = langCode ? ` · ${getLangDisplayName(langCode)}` : '';
            return {
                value: v.id,
                label: isDef ? 'Default Voice (Language Auto-Detect)' : `${v.id}${langSuffix}`,
                description: isDef ? 'Engine dynamically matches voice to message language' : `Voice ID: ${v.id}`,
            };
        });
    }, [filteredVoices]);

    const handleLanguageChange = (langCode: string) => {
        setSelectedLang(langCode);
        // If current voice is not in the filtered language, switch to first available voice or default
        if (langCode !== 'all') {
            const matching = voices.filter((v) => inferVoiceLanguage(v) === langCode);
            if (matching.length > 0 && !matching.some((v) => v.id === selectedVoice)) {
                const newVoiceId = matching[0].id;
                setSelectedVoice(newVoiceId);
                saveStoredTtsSettings({
                    ...getStoredTtsSettings(),
                    selectedModel: modelId,
                    selectedVoice: newVoiceId,
                });
            }
        }
    };

    const handleVoiceChange = (voiceId: string) => {
        setSelectedVoice(voiceId);
        // Sync language selector if a specific voice was picked
        const targetVoice = voices.find((v) => v.id === voiceId);
        if (targetVoice && targetVoice.id !== 'default') {
            const l = inferVoiceLanguage(targetVoice);
            if (l && selectedLang !== 'all' && selectedLang !== l) {
                setSelectedLang(l);
            }
        }

        saveStoredTtsSettings({
            ...getStoredTtsSettings(),
            selectedModel: modelId,
            selectedVoice: voiceId,
        });
    };

    return (
        <div className="w-full mt-2.5 p-3.5 bg-[var(--bg-secondary)]/40 border border-[var(--border-color)]/80 rounded-xl space-y-3.5 transition-all">
            {/* Header info */}
            <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-[var(--accent-color)]/10 text-[var(--accent-color)]">
                    <Volume2 size={15} />
                </div>
                <div>
                    <div className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                        <span>Voice & Spoken Language Configuration</span>
                        {voices.length > 0 && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)] border border-[var(--border-color)]">
                                {voices.length} {voices.length === 1 ? 'voice' : 'voices'}
                            </span>
                        )}
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)]">
                        Select spoken language and voice character for speech generation.
                    </p>
                </div>
            </div>

            {/* Two-Column Responsive Controls: Language & Voice */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-[var(--border-color)]/50">
                {/* 1. Language Dropdown */}
                <div className="space-y-1.5 text-left">
                    <label className="text-[11px] font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
                        <Globe size={12} className="text-[var(--text-muted)]" />
                        <span>Spoken Language</span>
                    </label>
                    <CustomDropdown
                        options={languageOptions}
                        value={selectedLang}
                        onChange={handleLanguageChange}
                        placeholder={loading ? 'Loading languages...' : 'Select language...'}
                        disabled={loading || voices.length === 0}
                        loading={loading}
                        className="w-full text-xs"
                    />
                </div>

                {/* 2. Voice Dropdown */}
                <div className="space-y-1.5 text-left">
                    <label className="text-[11px] font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
                        <Sparkles size={12} className="text-[var(--text-muted)]" />
                        <span>Voice Character</span>
                    </label>
                    <CustomDropdown
                        options={voiceOptions}
                        value={selectedVoice}
                        onChange={handleVoiceChange}
                        placeholder={loading ? 'Loading voices...' : 'Select voice...'}
                        disabled={loading || filteredVoices.length === 0}
                        loading={loading}
                        className="w-full text-xs"
                    />
                </div>
            </div>

            {error && (
                <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
                    ⚠️ {error}
                </div>
            )}
        </div>
    );
}

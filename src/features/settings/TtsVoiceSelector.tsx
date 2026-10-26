import React, { useEffect, useState, useMemo } from 'react';
import { Volume2, Globe, Sparkles } from 'lucide-react';
import { CustomDropdown, DropdownOption } from '../../components/ui/dropdown/CustomDropdown';
import { audioApi } from '../../api/engine/audio/audio.api';
import type { TtsVoice, TtsCapabilities } from '../../api/engine/audio/audio.types';
import { settingsForTtsModel } from '../../services/audio/ttsSettings';
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
    return v.language?.toLowerCase() || null;
}

function getLangDisplayName(code: string): string {
    return LANG_DISPLAY_NAMES[code.toLowerCase()] || languageLabel(code);
}

export function TtsVoiceSelector({ modelId }: TtsVoiceSelectorProps) {
    const [voices, setVoices] = useState<TtsVoice[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [capabilities, setCapabilities] = useState<TtsCapabilities | null>(null);
    const [referenceSource, setReferenceSource] = useState('');

    const [selectedVoice, setSelectedVoice] = useState<string>(() => {
        const stored = getStoredTtsSettings();
        return stored.selectedVoice || 'default';
    });

    const [selectedLang, setSelectedLang] = useState<string>('all');

    useEffect(() => {
        if (!modelId) {
            setVoices([]);
            setCapabilities(null);
            setError(null);
            setLoading(false);
            return;
        }

        let isMounted = true;
        const controller = new AbortController();
        setVoices([]);
        setCapabilities(null);
        setLoading(true);
        setError(null);

        audioApi
            .voiceCatalog(modelId, controller.signal)
            .then(({ data: list, capabilities: caps }) => {
                if (!isMounted) return;
                setVoices(list);
                setCapabilities(caps);
                const preference = settingsForTtsModel(modelId);
                const currentStored = preference.selectedVoice || 'default';
                const matchedVoice = list.find((v) => v.id === currentStored);
                const nextVoice = matchedVoice ? currentStored : (list[0]?.id || 'default');
                setSelectedVoice(nextVoice);

                const nextLanguage = caps.language_control === 'explicit' && caps.languages.includes(preference.selectedLanguage || '') ? preference.selectedLanguage! : 'auto';
                setSelectedLang(nextLanguage === 'auto' ? 'all' : nextLanguage);
                setReferenceSource(preference.referenceSource || '');

                saveStoredTtsSettings({
                    ...preference,
                    selectedModel: modelId,
                    selectedVoice: nextVoice,
                    selectedLanguage: nextLanguage,
                    coherentInput: caps.coherent_input,
                    voiceMode: caps.voice_mode,
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
            controller.abort();
        };
    }, [modelId]);

    // Distinct list of available languages for this model
    const languageOptions: DropdownOption[] = useMemo(() => {
        const langSet = new Set<string>(capabilities?.languages || []);
        for (const v of voices) {
            const l = inferVoiceLanguage(v);
            if (l) langSet.add(l);
        }

        const list = Array.from(langSet).sort();
        const opts: DropdownOption[] = [
            {
                value: 'all',
                label: capabilities?.language_control === 'auto' ? 'Automatic (from text)' : 'Auto (from text or voice)',
                description: 'Let the model choose the spoken language',
            },
        ];

        for (const code of list) {
            const count = voices.filter((v) => inferVoiceLanguage(v) === code).length;
            opts.push({
                value: code,
                label: getLangDisplayName(code),
                description: count ? `${count} ${count === 1 ? 'voice' : 'voices'} available` : 'Model language',
            });
        }

        return opts;
    }, [voices, capabilities]);

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
                label: isDef ? (capabilities?.coherent_input ? 'Generated voice (no fixed speaker)' : 'Default Voice') : `${v.id}${langSuffix}`,
                description: isDef ? (capabilities?.coherent_input ? 'Use a reference for a consistent speaker' : 'The model chooses its voice') : `Voice ID: ${v.id}`,
            };
        });
    }, [filteredVoices, capabilities]);

    const handleLanguageChange = (langCode: string) => {
        setSelectedLang(langCode);
        const matching = voices.filter(v => inferVoiceLanguage(v) === langCode);
        const voice = voices.find(v => v.id === selectedVoice);
        const nextVoice = langCode !== 'all' && voice?.language && voice.language !== langCode ? matching[0]?.id || 'default' : selectedVoice;
        setSelectedVoice(nextVoice);
        saveStoredTtsSettings({ ...settingsForTtsModel(modelId), selectedVoice: nextVoice, selectedLanguage: langCode === 'all' ? 'auto' : langCode });
    };

    const handleVoiceChange = (voiceId: string) => {
        setSelectedVoice(voiceId);
        saveStoredTtsSettings({
            ...settingsForTtsModel(modelId),
            selectedModel: modelId,
            selectedVoice: voiceId,
            selectedLanguage: selectedLang === 'all' ? 'auto' : selectedLang,
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
                                {voices.filter(v => !v.default).length} named voices
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
                        disabled={loading || voices.length === 0 || capabilities?.language_control === 'auto'}
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

            {capabilities?.voice_mode === 'reference_source' && (
                <label className="block text-xs text-[var(--text-secondary)]">
                    Reference audio file path or URL (clear speech from the speaker you want)
                    <input aria-label="Speaker reference audio" value={referenceSource}
                        placeholder="Optional: audio file path or https:// URL"
                        className="mt-1 w-full rounded border border-[var(--border-color)] bg-[var(--bg-primary)] p-2"
                        onChange={event => {
                            const source = event.target.value;
                            setReferenceSource(source);
                            if (!saveStoredTtsSettings({ ...settingsForTtsModel(modelId), referenceSource: source })) setError('Unable to save speech settings');
                        }} />
                </label>
            )}
            {capabilities?.voice_mode === 'reference_profile' && (
                <p className="text-xs text-[var(--text-muted)]">Language follows the text. Choose an installed reference profile for a consistent speaker. Without one, the model generates a voice.</p>
            )}

            {error && (
                <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
                    ⚠️ {error}
                </div>
            )}
        </div>
    );
}

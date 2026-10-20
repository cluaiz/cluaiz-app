import React, { useState, useEffect, useRef } from 'react';
import { Mic, Volume2, AudioLines } from 'lucide-react';
import { CustomDropdown, FLOATING_MENU_ATTR } from './dropdown/CustomDropdown';
import { audioApi } from '../../api/engine/audio/audio.api';
import type { TtsVoice } from '../../api/engine/audio/audio.types';
import { getStoredTtsSettings, saveStoredTtsSettings, type TtsSettings } from '../../services/audio/ttsSettings';
export { getStoredTtsSettings, saveStoredTtsSettings, DEFAULT_TTS_SETTINGS, TTS_SETTINGS_KEY, type TtsSettings } from '../../services/audio/ttsSettings';

export interface MicSettings {
    /** record_send: words are typed while you speak; live_interaction: voice mode (talk with the AI) */
    mode: 'record_send' | 'live_interaction';
}

const MIC_MODES: { mode: MicSettings['mode']; label: string; description: string; icon: typeof Mic }[] = [
    { mode: 'record_send', label: 'Record', description: 'Your words are typed as you speak. Stop when done, then send.', icon: Mic },
    { mode: 'live_interaction', label: 'Voice mode', description: 'Talk with the AI: a pause sends, the answer is spoken, then it listens again.', icon: AudioLines },
];

/** Speaking rates offered (the engine accepts 0.25–4) */
const SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5];

export const MIC_SETTINGS_KEY = 'cluaiz_audio_mic_settings';

export const DEFAULT_MIC_SETTINGS: MicSettings = {
    mode: 'record_send',
};


export const getStoredMicSettings = (): MicSettings => {
    try {
        const saved = localStorage.getItem(MIC_SETTINGS_KEY);
        if (saved) return { mode: JSON.parse(saved).mode === 'live_interaction' ? 'live_interaction' : 'record_send' };
    } catch { }
    return DEFAULT_MIC_SETTINGS;
};

export const saveStoredMicSettings = (settings: MicSettings) => {
    try {
        localStorage.setItem(MIC_SETTINGS_KEY, JSON.stringify(settings));
        localStorage.setItem('cluaiz_voice_mode', settings.mode);
    } catch { }
};

export interface VoiceControlPopoverProps {
    isOpen: boolean;
    onClose: () => void;
    onSettingsChange?: (settings: MicSettings) => void;
}

/**
 * Compact, lightweight Popover anchored directly to the Mic capsule.
 * No screen-blocking backdrop, no blur overlay.
 */
export const VoiceControlPopover: React.FC<VoiceControlPopoverProps> = ({
    isOpen,
    onClose,
    onSettingsChange,
}) => {
    const [settings, setSettings] = useState<MicSettings>(getStoredMicSettings);
    const popoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            setSettings(getStoredMicSettings());
        }
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    const [placement, setPlacement] = useState<'top' | 'bottom'>('top');

    useEffect(() => {
        if (isOpen && popoverRef.current) {
            const rect = popoverRef.current.getBoundingClientRect();
            if (rect.top < 20) {
                setPlacement('bottom');
            } else {
                setPlacement('top');
            }
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const update = (updates: Partial<MicSettings>) => {
        const updated = { ...settings, ...updates };
        setSettings(updated);
        saveStoredMicSettings(updated);
        onSettingsChange?.(updated);
    };

    return (
        <div
            ref={popoverRef}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.stopPropagation()}
            className={`absolute right-0 ${
                placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
            } w-56 max-h-[85vh] overflow-y-auto p-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] shadow-2xl z-50 flex flex-col gap-2 font-[family-name:var(--font-family)] animate-in fade-in zoom-in-95 duration-100`}
            style={{ borderStyle: 'var(--border-style)' }}
        >
            {/* Header */}
            <div className="flex items-center justify-between pb-1 border-b border-[var(--border-color)]/30">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    <Mic className="w-3 h-3 text-[var(--accent-color)]" />
                    <span>Microphone</span>
                </div>
            </div>

            {/* Two ways to use the microphone; nothing else to set */}
            {MIC_MODES.map((option) => {
                const selected = settings.mode === option.mode;
                const Icon = option.icon;
                return (
                    <button
                        key={option.mode}
                        type="button"
                        onClick={() => update({ mode: option.mode })}
                        className={`w-full flex items-start gap-2 p-2 rounded-lg border text-left transition-all cursor-pointer ${
                            selected
                                ? 'border-[var(--accent-color)]/60 bg-[var(--accent-color)]/10'
                                : 'border-[var(--border-color)]/30 hover:bg-[var(--bg-secondary)]'
                        }`}
                    >
                        <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${selected ? 'text-[var(--accent-color)]' : 'text-[var(--text-muted)]'}`} />
                        <span className="flex flex-col">
                            <span className={`text-[10.5px] font-semibold ${selected ? 'text-[var(--accent-color)]' : 'text-[var(--text-primary)]'}`}>{option.label}</span>
                            <span className="text-[9px] text-[var(--text-muted)] leading-snug">{option.description}</span>
                        </span>
                    </button>
                );
            })}
        </div>
    );
};

export interface AudioPlayerPopoverProps {
    isOpen: boolean;
    onClose: () => void;
    onSettingsChange?: (settings: TtsSettings) => void;
}

/** Language code → its name in the user's language ("hi" → "Hindi"); the code when unknown */
const languageName = (code: string | null): string => {
    if (!code) return '';
    try {
        return new Intl.DisplayNames([navigator.language || 'en'], { type: 'language' }).of(code) || code;
    } catch {
        return code;
    }
};

/**
 * Speech settings of chat messages: voice, speed and model. Speech is always streamed (it starts
 * with the first sentence) and voice mode speaks answers by itself, so there are no switches.
 */
export const AudioPlayerPopover: React.FC<AudioPlayerPopoverProps> = ({
    isOpen,
    onClose,
    onSettingsChange,
}) => {
    const [settings, setSettings] = useState<TtsSettings>(getStoredTtsSettings);
    const [voices, setVoices] = useState<TtsVoice[]>([]);
    const [voicesLoading, setVoicesLoading] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        setSettings(getStoredTtsSettings());
    }, [isOpen]);

    // Voices for TTS synthesis
    useEffect(() => {
        if (!isOpen) return;
        setVoicesLoading(true);
        audioApi.voices(settings.selectedModel || undefined)
            .then(setVoices)
            .catch(() => setVoices([]))
            .finally(() => setVoicesLoading(false));
    }, [isOpen, settings.selectedModel]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // A floating dropdown list belongs to this popover
            if (target.closest?.(`[${FLOATING_MENU_ATTR}]`)) return;
            if (popoverRef.current && !popoverRef.current.contains(target)) onClose();
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    const [placement, setPlacement] = useState<'top' | 'bottom'>('top');
    useEffect(() => {
        if (isOpen && popoverRef.current) {
            setPlacement(popoverRef.current.getBoundingClientRect().top < 20 ? 'bottom' : 'top');
        }
    }, [isOpen]);

    const voiceOptions = React.useMemo(() => voices.map((v) => ({
        value: v.id,
        label: v.default ? 'Auto (matches the language)' : v.id,
        description: v.default ? "A voice that speaks the text's language" : languageName(v.language),
    })), [voices]);

    if (!isOpen) return null;

    const update = (updates: Partial<TtsSettings>) => {
        const updated = { ...settings, ...updates };
        setSettings(updated);
        saveStoredTtsSettings(updated);
        onSettingsChange?.(updated);
    };

    return (
        <div
            ref={popoverRef}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.stopPropagation()}
            className={`absolute right-0 ${
                placement === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
            } w-64 p-3 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-color)] shadow-2xl z-50 flex flex-col gap-2.5 font-[family-name:var(--font-family)] animate-in fade-in zoom-in-95 duration-100`}
            style={{ borderStyle: 'var(--border-style)' }}
        >
            <div className="flex items-center gap-1.5 pb-1.5 border-b border-[var(--border-color)]/30 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                <Volume2 className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                <span>Speech</span>
            </div>

            {/* Voice */}
            <div className="flex flex-col gap-1">
                <label className="text-[9.5px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Voice</label>
                <CustomDropdown
                    floating
                    options={voiceOptions}
                    value={settings.selectedVoice || 'default'}
                    onChange={(val) => update({ selectedVoice: val })}
                    loading={voicesLoading}
                    placeholder="Auto (matches the language)"
                    className="w-full"
                />
            </div>

            {/* Speed */}
            <div className="flex flex-col gap-1">
                <span className="text-[9.5px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Speed</span>
                <div className="grid grid-cols-3 gap-1.5 bg-[var(--bg-secondary)] p-1.5 rounded-xl border border-[var(--border-color)]/30">
                    {SPEEDS.map((spd) => (
                        <button
                            key={spd}
                            type="button"
                            onClick={() => update({ playbackSpeed: spd })}
                            className={`py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer text-center ${
                                settings.playbackSpeed === spd
                                    ? 'bg-[var(--accent-color)] text-[var(--accent-contrast)] shadow-sm'
                                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                            }`}
                        >
                            {spd}x
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

/**
 * Universal wrapper for backward compatibility with existing imports.
 */
export const AudioControlSettingsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    initialTab?: 'mic' | 'speaker';
    onMicSettingsChange?: (settings: MicSettings) => void;
    onTtsSettingsChange?: (settings: TtsSettings) => void;
}> = ({ isOpen, onClose, initialTab = 'mic', onMicSettingsChange, onTtsSettingsChange }) => {
    if (initialTab === 'mic') {
        return <VoiceControlPopover isOpen={isOpen} onClose={onClose} onSettingsChange={onMicSettingsChange} />;
    }
    return <AudioPlayerPopover isOpen={isOpen} onClose={onClose} onSettingsChange={onTtsSettingsChange} />;
};

export default AudioControlSettingsModal;

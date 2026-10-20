/** Persist actual synthesis preferences independently for each installed model. */
export interface TtsModelSettings {
    selectedVoice?: string;
    selectedLanguage?: string;
    coherentInput?: boolean;
    voiceMode?: string;
    /** Authorized by the engine using the same file/URL policy as other audio inputs. */
    referenceSource?: string;
}

export interface TtsSettings extends TtsModelSettings {
    playbackSpeed: number;
    selectedModel?: string;
    models?: Record<string, TtsModelSettings>;
}

export const TTS_SETTINGS_KEY = 'cluaiz_audio_tts_settings';
export const DEFAULT_TTS_SETTINGS: TtsSettings = {
    playbackSpeed: 1, selectedModel: '', selectedVoice: 'default', selectedLanguage: 'auto',
};

const listeners = new Set<(settings: TtsSettings) => void>();

/** Playback speed can change on cached audio; synthesis identity cannot. */
export const speechPreferenceKey = (settings: TtsSettings): string => JSON.stringify([
    settings.selectedModel, settings.selectedVoice, settings.selectedLanguage,
    settings.voiceMode, settings.referenceSource, settings.coherentInput,
]);

export function subscribeTtsSettings(listener: (settings: TtsSettings) => void): () => void {
    listeners.add(listener);
    const storage = (event: StorageEvent) => {
        if (event.key === TTS_SETTINGS_KEY || event.key === null) listener(getStoredTtsSettings());
    };
    if (typeof window !== 'undefined') window.addEventListener('storage', storage);
    return () => {
        listeners.delete(listener);
        if (typeof window !== 'undefined') window.removeEventListener('storage', storage);
    };
}

function modelSettings(raw: unknown): TtsModelSettings {
    const value = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    return {
        selectedVoice: typeof value.selectedVoice === 'string' ? value.selectedVoice : 'default',
        selectedLanguage: typeof value.selectedLanguage === 'string' ? value.selectedLanguage : 'auto',
        coherentInput: value.coherentInput === true,
        voiceMode: typeof value.voiceMode === 'string' ? value.voiceMode : undefined,
        referenceSource: typeof value.referenceSource === 'string' ? value.referenceSource : undefined,
    };
}

export function getStoredTtsSettings(): TtsSettings {
    try {
        const raw = JSON.parse(localStorage.getItem(TTS_SETTINGS_KEY) || '{}');
        const models = Object.fromEntries(Object.entries(raw.models || {}).map(([id, value]) => [id, modelSettings(value)]));
        return {
            ...modelSettings(raw), models,
            selectedModel: typeof raw.selectedModel === 'string' ? raw.selectedModel : '',
            playbackSpeed: Number.isFinite(raw.playbackSpeed) && raw.playbackSpeed >= 0.25 && raw.playbackSpeed <= 4 ? raw.playbackSpeed : 1,
        };
    } catch { return { ...DEFAULT_TTS_SETTINGS }; }
}

/** Older single-model settings are migrated when first saved; changing models clears foreign voices. */
export function settingsForTtsModel(model: string, stored = getStoredTtsSettings()): TtsSettings {
    const preference = stored.models?.[model] ?? (stored.selectedModel === model ? modelSettings(stored) : modelSettings(null));
    return { ...stored, ...preference, selectedModel: model };
}

export function saveStoredTtsSettings(settings: TtsSettings): boolean {
    try {
        const updated = { ...settings, models: {
            ...getStoredTtsSettings().models, ...settings.models,
            [settings.selectedModel || '']: modelSettings(settings),
        } };
        const encoded = JSON.stringify(updated);
        if (localStorage.getItem(TTS_SETTINGS_KEY) === encoded) return true;
        localStorage.setItem(TTS_SETTINGS_KEY, encoded);
        listeners.forEach(listener => listener(getStoredTtsSettings()));
        return true;
    } catch { return false; }
}

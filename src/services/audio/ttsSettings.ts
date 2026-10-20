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
        localStorage.setItem(TTS_SETTINGS_KEY, JSON.stringify(updated));
        return true;
    } catch { return false; }
}

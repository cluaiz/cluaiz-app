import { create } from 'zustand';

export interface SoundOption {
    id: string;
    label: string;
    filename: string;
    description?: string;
}

export const TRANSMISSION_SOUNDS: SoundOption[] = [
    { id: 'send-sms.mp3', label: 'SMS Message Sent', filename: 'send-sms.mp3', description: 'Classic message transmission tone' },
    { id: 'vadim_makes_sound-soft-app-button-tap-sound.mp3', label: 'Soft App Tap', filename: 'vadim_makes_sound-soft-app-button-tap-sound.mp3', description: 'Gentle rounded interface tap' },
    { id: 'justsomesounds-click.mp3', label: 'Crisp Send Click', filename: 'justsomesounds-click.mp3', description: 'Clean tactile switch click' },
];

export const COMPLETION_SOUNDS: SoundOption[] = [
    { id: 'new-notification.mp3', label: 'Delight Chime', filename: 'new-notification.mp3', description: 'Polite multi-tone arrival chime' },
    { id: 'synth:crystal-bell', label: 'Crystal Bell', filename: 'synth:crystal-bell', description: 'Pure resonant high-frequency chime' },
];

export const ALERT_SOUNDS: SoundOption[] = [
    { id: 'sms-vibration-notification-.mp3', label: 'Haptic Vibration Alert', filename: 'sms-vibration-notification-.mp3', description: 'Low tactile vibration pulse' },
    { id: 'synth:warning-pulse', label: 'Dual-Tone Alert', filename: 'synth:warning-pulse', description: 'Subtle attention diagnostic pulse' },
];

// Backwards-compatible union of all available sounds
export const AVAILABLE_SOUNDS: SoundOption[] = [
    ...TRANSMISSION_SOUNDS,
    ...COMPLETION_SOUNDS,
    ...ALERT_SOUNDS,
];

export interface NotificationState {
    soundEnabled: boolean;
    volume: number;
    soundOnSend: boolean;
    soundOnComplete: boolean;
    soundOnError: boolean;
    selectedSendSound: string;
    selectedCompleteSound: string;
    selectedErrorSound: string;
    desktopPush: boolean;

    // Actions
    setSoundEnabled: (enabled: boolean) => void;
    setVolume: (volume: number) => void;
    setSoundOnSend: (enabled: boolean) => void;
    setSoundOnComplete: (enabled: boolean) => void;
    setSoundOnError: (enabled: boolean) => void;
    setSelectedSendSound: (soundId: string) => void;
    setSelectedCompleteSound: (soundId: string) => void;
    setSelectedErrorSound: (soundId: string) => void;
    setDesktopPush: (enabled: boolean) => void;
}

const STORAGE_KEY = 'cluaiz_notification_settings';

export const sanitizeSoundSelection = (id: string | undefined, list: SoundOption[], defaultId: string): string => {
    if (!id) return defaultId;
    return list.some(s => s.id === id) ? id : defaultId;
};

const loadSavedState = () => {
    try {
        if (typeof localStorage === 'undefined') return null;
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
};

const saveState = (state: Partial<NotificationState>) => {
    try {
        if (typeof localStorage === 'undefined') return;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
};

const saved = loadSavedState();

export const useNotificationStore = create<NotificationState>()((set, get) => ({
    soundEnabled: saved?.soundEnabled ?? true,
    volume: saved?.volume ?? 0.75,
    soundOnSend: saved?.soundOnSend ?? true,
    soundOnComplete: saved?.soundOnComplete ?? true,
    soundOnError: saved?.soundOnError ?? true,
    selectedSendSound: sanitizeSoundSelection(saved?.selectedSendSound, TRANSMISSION_SOUNDS, 'send-sms.mp3'),
    selectedCompleteSound: sanitizeSoundSelection(saved?.selectedCompleteSound, COMPLETION_SOUNDS, 'new-notification.mp3'),
    selectedErrorSound: sanitizeSoundSelection(saved?.selectedErrorSound, ALERT_SOUNDS, 'sms-vibration-notification-.mp3'),
    desktopPush: saved?.desktopPush ?? true,

    setSoundEnabled: (soundEnabled) => {
        set({ soundEnabled });
        saveState({ ...get(), soundEnabled });
    },
    setVolume: (volume) => {
        set({ volume });
        saveState({ ...get(), volume });
    },
    setSoundOnSend: (soundOnSend) => {
        set({ soundOnSend });
        saveState({ ...get(), soundOnSend });
    },
    setSoundOnComplete: (soundOnComplete) => {
        set({ soundOnComplete });
        saveState({ ...get(), soundOnComplete });
    },
    setSoundOnError: (soundOnError) => {
        set({ soundOnError });
        saveState({ ...get(), soundOnError });
    },
    setSelectedSendSound: (soundId) => {
        const safe = sanitizeSoundSelection(soundId, TRANSMISSION_SOUNDS, 'send-sms.mp3');
        set({ selectedSendSound: safe });
        saveState({ ...get(), selectedSendSound: safe });
    },
    setSelectedCompleteSound: (soundId) => {
        const safe = sanitizeSoundSelection(soundId, COMPLETION_SOUNDS, 'new-notification.mp3');
        set({ selectedCompleteSound: safe });
        saveState({ ...get(), selectedCompleteSound: safe });
    },
    setSelectedErrorSound: (soundId) => {
        const safe = sanitizeSoundSelection(soundId, ALERT_SOUNDS, 'sms-vibration-notification-.mp3');
        set({ selectedErrorSound: safe });
        saveState({ ...get(), selectedErrorSound: safe });
    },
    setDesktopPush: (desktopPush) => {
        set({ desktopPush });
        saveState({ ...get(), desktopPush });
    },
}));

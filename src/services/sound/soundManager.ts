import { useNotificationStore } from '../../store/ui/useNotificationStore';

class SoundManager {
    private audioCache: Map<string, HTMLAudioElement> = new Map();

    private getAudio(filename: string): HTMLAudioElement {
        const path = `/assets/lottie/${filename}`;
        let audio = this.audioCache.get(path);
        if (!audio) {
            audio = new Audio(path);
            audio.preload = 'auto';
            this.audioCache.set(path, audio);
        }
        return audio;
    }

    /**
     * Synthesizes pure Web Audio tones (e.g. crystal bell, warning pulse).
     */
    private playSynth(synthId: string, volumeScale: number = 1.0): Promise<void> {
        try {
            if (typeof window === 'undefined') return Promise.resolve();
            const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext })?.webkitAudioContext;
            if (!AudioContextClass) return Promise.resolve();

            const ctx = new AudioContextClass();
            const store = useNotificationStore.getState();
            const finalVol = Math.max(0.01, Math.min(1, store.volume * volumeScale));

            const now = ctx.currentTime;
            const masterGain = ctx.createGain();
            masterGain.gain.setValueAtTime(finalVol * 0.35, now);
            masterGain.connect(ctx.destination);

            if (synthId === 'synth:crystal-bell') {
                // High resonant bell chime
                const osc1 = ctx.createOscillator();
                const osc2 = ctx.createOscillator();
                const gain1 = ctx.createGain();
                const gain2 = ctx.createGain();

                osc1.type = 'sine';
                osc1.frequency.setValueAtTime(880, now);
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(1760, now);

                gain1.gain.setValueAtTime(0.7, now);
                gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
                gain2.gain.setValueAtTime(0.3, now);
                gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

                osc1.connect(gain1);
                osc2.connect(gain2);
                gain1.connect(masterGain);
                gain2.connect(masterGain);

                osc1.start(now);
                osc2.start(now);
                osc1.stop(now + 0.7);
                osc2.stop(now + 0.7);
            } else if (synthId === 'synth:warning-pulse') {
                // Dual-tone diagnostic warning pulse
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(440, now);
                osc.frequency.setValueAtTime(330, now + 0.12);

                gain.gain.setValueAtTime(0.6, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                gain.gain.setValueAtTime(0.6, now + 0.12);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

                osc.connect(gain);
                gain.connect(masterGain);

                osc.start(now);
                osc.stop(now + 0.4);
            }

            return Promise.resolve();
        } catch (err) {
            console.warn('[SoundManager] Synth audio error:', err);
            return Promise.resolve();
        }
    }

    /**
     * Plays any sound file or synthesized tone with volume scaling and safe autoplay catch.
     */
    private playSound(soundId: string, volumeScale: number = 1.0): Promise<void> {
        try {
            if (typeof window === 'undefined') return Promise.resolve();

            if (soundId.startsWith('synth:')) {
                return this.playSynth(soundId, volumeScale);
            }

            const audio = this.getAudio(soundId);
            const store = useNotificationStore.getState();

            // Clone or reset to allow rapid sequential triggers
            audio.currentTime = 0;
            audio.volume = Math.max(0, Math.min(1, store.volume * volumeScale));

            const playPromise = audio.play();
            if (playPromise !== undefined) {
                return playPromise.catch((err) => {
                    // Autoplay blocked by browser before user interaction; ignore silently
                    if (err?.name !== 'NotAllowedError') {
                        console.warn('[SoundManager] Audio play failed:', err);
                    }
                });
            }
            return Promise.resolve();
        } catch (err) {
            console.warn('[SoundManager] Sound playback error:', err);
            return Promise.resolve();
        }
    }

    /**
     * Play message transmission sound (SMS send)
     */
    playSend(): void {
        const store = useNotificationStore.getState();
        if (!store.soundEnabled || !store.soundOnSend) return;
        this.playSound(store.selectedSendSound, 0.85);
    }

    /**
     * Play response / workflow complete chime
     */
    playComplete(): void {
        const store = useNotificationStore.getState();
        if (!store.soundEnabled || !store.soundOnComplete) return;
        this.playSound(store.selectedCompleteSound, 1.0);
    }

    /**
     * Play error / warning alert
     */
    playError(): void {
        const store = useNotificationStore.getState();
        if (!store.soundEnabled || !store.soundOnError) return;
        this.playSound(store.selectedErrorSound, 1.0);
    }

    /**
     * Play preview sound in Settings (audition any sound ID)
     */
    playPreview(soundId: string): void {
        this.playSound(soundId, 1.0);
    }

    /**
     * Request desktop notification permission from user
     */
    async requestPermission(): Promise<NotificationPermission | 'unsupported'> {
        if (typeof window === 'undefined' || !('Notification' in window)) {
            return 'unsupported';
        }
        try {
            const permission = await Notification.requestPermission();
            return permission;
        } catch {
            return 'denied';
        }
    }

    /**
     * Check if desktop notification permission is granted
     */
    getPermissionStatus(): NotificationPermission | 'unsupported' {
        if (typeof window === 'undefined' || !('Notification' in window)) {
            return 'unsupported';
        }
        return Notification.permission;
    }

    /**
     * Dispatch OS / desktop notification when user is in another tab or window is minimized
     */
    notifyBackground(title: string, options?: { body?: string; icon?: string }): void {
        if (typeof window === 'undefined' || !('Notification' in window)) return;
        const store = useNotificationStore.getState();
        if (!store.desktopPush) return;

        // Only send desktop push if window is hidden / backgrounded
        if (typeof document !== 'undefined' && !document.hidden) return;

        if (Notification.permission === 'granted') {
            try {
                const n = new Notification(title, {
                    body: options?.body || 'Cluaiz assistant response is ready.',
                    icon: options?.icon || '/favicon.ico',
                });
                n.onclick = () => {
                    window.focus();
                    n.close();
                };
            } catch (err) {
                console.warn('[SoundManager] Desktop push failed:', err);
            }
        }
    }
}

export const soundManager = new SoundManager();

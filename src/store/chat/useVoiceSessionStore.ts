import { create } from 'zustand';

/**
 * Voice mode: the user talks and the assistant answers aloud. While it is on, the answer being
 * written speaks by itself (MessageBubble) and the microphone listens again once it has been said.
 */
interface VoiceSessionState {
    active: boolean;
    setActive: (active: boolean) => void;
}

export const useVoiceSessionStore = create<VoiceSessionState>((set) => ({
    active: false,
    setActive: (active) => set({ active }),
}));

import { create } from 'zustand';

export interface ActiveAudioDeck {
    messageId: string;
    text: string;
    isStreaming?: boolean;
}

export interface SpeechHighlightState {
    /** Currently active top sticky audio deck, or null when closed */
    activeDeck: ActiveAudioDeck | null;
    /** Open or switch the active audio deck */
    openDeck: (deck: ActiveAudioDeck) => void;
    /** Close the active audio deck and stop speech */
    closeDeck: () => void;

    /** The message ID currently being spoken */
    activeMessageId: string | null;
    /** The plain text of the current sentence being spoken */
    sentenceText: string | null;
    /** 0-based index of the sentence within the message */
    sentenceIndex: number;
    /** 0-based index of the word currently being spoken within the sentence */
    activeWordIndex: number;
    /** The exact string token of the active word */
    activeWord: string | null;
    /** Whether audio is currently actively playing (false when paused) */
    isPlaying: boolean;

    /** Set the active sentence being synthesized/played */
    setActiveSentence: (params: {
        messageId: string;
        sentenceText: string;
        sentenceIndex: number;
    }) => void;

    /** Update the active word token and index as audio progress moves forward */
    updateWordProgress: (activeWordIndex: number, activeWord: string) => void;

    /** Update play/pause status */
    setPlaying: (isPlaying: boolean) => void;

    /** Current speech power/frequency volume level (0.0 to 1.0) */
    audioLevel: number;
    /** Update speech power level */
    setAudioLevel: (level: number) => void;

    /** Clear highlight state when playback stops, finishes, or is cancelled */
    clear: (messageId?: string) => void;
}

export const useSpeechHighlightStore = create<SpeechHighlightState>((set, get) => ({
    activeDeck: null,
    activeMessageId: null,
    sentenceText: null,
    sentenceIndex: -1,
    activeWordIndex: -1,
    activeWord: null,
    isPlaying: false,
    audioLevel: 0,

    openDeck: (deck) => {
        set({ activeDeck: deck });
    },

    closeDeck: () => {
        set({
            activeDeck: null,
            activeMessageId: null,
            sentenceText: null,
            sentenceIndex: -1,
            activeWordIndex: -1,
            activeWord: null,
            isPlaying: false,
            audioLevel: 0,
        });
    },

    setActiveSentence: ({ messageId, sentenceText, sentenceIndex }) => {
        set({
            activeMessageId: messageId,
            sentenceText,
            sentenceIndex,
            activeWordIndex: 0,
            activeWord: null,
            isPlaying: true,
        });
    },

    updateWordProgress: (activeWordIndex, activeWord) => {
        const state = get();
        if (state.activeWordIndex !== activeWordIndex || state.activeWord !== activeWord) {
            set({ activeWordIndex, activeWord });
        }
    },

    setPlaying: (isPlaying) => set({ isPlaying }),

    setAudioLevel: (audioLevel: number) => {
        const current = get().audioLevel;
        // Optimization: only update store if difference is discernible (> 0.02) to avoid unnecessary churn
        if (Math.abs(current - audioLevel) > 0.02 || (audioLevel === 0 && current !== 0)) {
            set({ audioLevel });
        }
    },

    clear: (messageId) => {
        const current = get().activeMessageId;
        if (!messageId || current === messageId) {
            set({
                activeDeck: null,
                activeMessageId: null,
                sentenceText: null,
                sentenceIndex: -1,
                activeWordIndex: -1,
                activeWord: null,
                isPlaying: false,
                audioLevel: 0,
            });
        }
    },
}));

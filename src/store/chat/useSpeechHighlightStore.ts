import { create } from 'zustand';

export interface SpeechHighlightState {
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

    /** Clear highlight state when playback stops, finishes, or is cancelled */
    clear: (messageId?: string) => void;
}

export const useSpeechHighlightStore = create<SpeechHighlightState>((set, get) => ({
    activeMessageId: null,
    sentenceText: null,
    sentenceIndex: -1,
    activeWordIndex: -1,
    activeWord: null,
    isPlaying: false,

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

    clear: (messageId) => {
        const current = get().activeMessageId;
        if (!messageId || current === messageId) {
            set({
                activeMessageId: null,
                sentenceText: null,
                sentenceIndex: -1,
                activeWordIndex: -1,
                activeWord: null,
                isPlaying: false,
            });
        }
    },
}));

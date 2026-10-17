import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** What happens when a message is sent in an archived chat. */
export type ArchivedActivity = 'unarchive' | 'reset' | 'keep';

/** Chat history preferences. Every period is in days; 0 = never. */
export interface ChatPrefs {
    /** Off = new chats start in Private Mode and are never written to storage */
    saveHistory: boolean;
    /** Delete archived chats this many days after they were archived */
    archiveDeleteAfterDays: number;
    /** A new message in an archived chat: move it back, restart its delete timer, or change nothing */
    archivedActivity: ArchivedActivity;
    /** Archive chats with no new message for this many days */
    autoArchiveAfterDays: number;
    /** Delete chats with no new message for this many days */
    deleteInactiveAfterDays: number;
    /** Keep at most this many saved chats; the oldest unprotected ones go first */
    maxChats: number;
    /** Pinned and favourite chats are never archived or deleted automatically */
    protectPinned: boolean;
}

export const DEFAULT_CHAT_PREFS: ChatPrefs = {
    saveHistory: true,
    archiveDeleteAfterDays: 0,
    archivedActivity: 'unarchive',
    autoArchiveAfterDays: 0,
    deleteInactiveAfterDays: 0,
    maxChats: 0,
    protectPinned: true,
};

interface ChatPrefsStore extends ChatPrefs {
    setPref: <K extends keyof ChatPrefs>(key: K, value: ChatPrefs[K]) => void;
}

export const useChatPrefsStore = create<ChatPrefsStore>()(
    persist(
        (set) => ({
            ...DEFAULT_CHAT_PREFS,
            setPref: (key, value) => set({ [key]: value } as Partial<ChatPrefs>),
        }),
        { name: 'cluaiz-chat-preferences' }
    )
);

/** The current preferences without the setter (for non-React code). */
export function currentChatPrefs(): ChatPrefs {
    const { setPref: _setPref, ...prefs } = useChatPrefsStore.getState();
    return prefs;
}

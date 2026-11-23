import { create } from 'zustand';
import { SAMPLING_KEYS, type SamplingKey } from '../../api/engine/chat/sampling';

export { SAMPLING_KEYS, type SamplingKey };

/**
 * A chat's run settings, sent with each of its requests. A field left out is not sent, so the Engine's own
 * default applies (the Engine reads them in `api/src/handlers/chat/types.rs`).
 */
export interface ChatControls {
    systemPrompt?: string;
    temperature?: number;
    top_p?: number;
    top_k?: number;
    min_p?: number;
    repetition_penalty?: number;
    presence_penalty?: number;
    frequency_penalty?: number;
    max_tokens?: number;
    seed?: number;
}


/** Live hardware reads: always, only while the panel is open and the window visible, or never */
export type TelemetryMode = 'on' | 'smart' | 'off';

/** The settings of chats not yet saved (and of new chats) live under this key */
export const NEW_CHAT = '';
const KEY = 'cluaiz_chat_controls_v1';

interface Saved { byChat: Record<string, ChatControls>; telemetry: TelemetryMode }

function read(): Saved {
    try {
        const value = JSON.parse(localStorage.getItem(KEY) ?? '{}');
        const byChat = value && typeof value.byChat === 'object' && !Array.isArray(value.byChat) ? value.byChat : {};
        const telemetry = ['on', 'smart', 'off'].includes(value?.telemetry) ? value.telemetry : 'smart';
        return { byChat, telemetry };
    } catch { return { byChat: {}, telemetry: 'smart' }; }
}

interface ChatControlsState extends Saved {
    panelOpen: boolean;
    setPanelOpen(open: boolean): void;
    /** Changes a chat's settings; a chat without its own settings starts from the new-chat ones */
    update(chatId: string | null | undefined, patch: Partial<ChatControls>): void;
    /** Back to the Engine's defaults for this chat */
    reset(chatId: string | null | undefined): void;
    setTelemetry(mode: TelemetryMode): void;
}

export const useChatControlsStore = create<ChatControlsState>((set, get) => {
    const save = (next: Partial<Saved>) => {
        const { byChat, telemetry } = { ...get(), ...next };
        try { localStorage.setItem(KEY, JSON.stringify({ byChat, telemetry })); } catch { /* kept for this session */ }
        set(next);
    };
    return {
        ...read(),
        panelOpen: false,
        setPanelOpen: panelOpen => set({ panelOpen }),
        update: (chatId, patch) => {
            const id = chatId || NEW_CHAT, byChat = get().byChat;
            const merged: ChatControls = { ...(byChat[id] ?? byChat[NEW_CHAT]), ...patch };
            // undefined means "Engine default": the field is dropped, not saved as null
            (Object.keys(merged) as (keyof ChatControls)[]).forEach(key => { if (merged[key] === undefined || merged[key] === '') delete merged[key]; });
            save({ byChat: { ...byChat, [id]: merged } });
        },
        reset: chatId => {
            const byChat = { ...get().byChat }; delete byChat[chatId || NEW_CHAT];
            save({ byChat });
        },
        setTelemetry: telemetry => save({ telemetry }),
    };
});

/** The settings a chat runs with: its own, else the new-chat ones */
export const controlsFor = (byChat: Record<string, ChatControls>, chatId: string | null | undefined): ChatControls =>
    (chatId && byChat[chatId]) || byChat[NEW_CHAT] || {};

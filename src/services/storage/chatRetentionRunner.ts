import { useChatStore } from '../../store/chat/useChatStore';
import { currentChatPrefs, useChatPrefsStore } from '../../store/chat/useChatPrefsStore';
import { planRetention, RetentionPlan } from './chatRetention';

const HOUR_MS = 60 * 60 * 1000;

/** Applies the chat history preferences now: archives, deletes and starts archive timers. */
export function applyChatRetention(now = Date.now()): RetentionPlan {
    const store = useChatStore.getState();
    if (!store.isHydrated) return { stamp: [], archive: [], remove: [] };
    const plan = planRetention(Object.values(store.sessions), currentChatPrefs(), now, store.activeSessionId);
    for (const id of plan.stamp) store.updateSession(id, s => ({ ...s, archivedAt: now }));
    // updateSession records the archive time when a chat is archived
    for (const id of plan.archive) store.updateSession(id, s => ({ ...s, archived: true }));
    for (const id of plan.remove) store.deleteSession(id);
    if (plan.archive.length || plan.remove.length) {
        console.info(`[ChatHistory] Archived ${plan.archive.length}, deleted ${plan.remove.length} chats by the history settings`);
    }
    return plan;
}

let started = false;

/** Runs the history preferences after startup, every hour, and whenever they change. */
export function startChatRetention(): void {
    if (started) return;
    started = true;
    applyChatRetention();
    setInterval(() => applyChatRetention(), HOUR_MS);
    useChatPrefsStore.subscribe(() => applyChatRetention());
}

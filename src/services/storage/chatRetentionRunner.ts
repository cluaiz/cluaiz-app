import { useChatStore } from '../../store/chat/useChatStore';
import { currentChatPrefs, useChatPrefsStore } from '../../store/chat/useChatPrefsStore';
import { planRetention, RetentionPlan } from './chatRetention';
import { deleteSessionBatch } from '../../store/chat/deletion';

const HOUR_MS = 60 * 60 * 1000;

/** Applies the chat history preferences now: archives, deletes and starts archive timers. */
async function sweep(now: number): Promise<RetentionPlan> {
    const store = useChatStore.getState();
    if (!store.isHydrated) return { stamp: [], archive: [], remove: [] };
    const plan = planRetention(Object.values(store.sessions).filter(s => s.id !== store.streamingSessionId), currentChatPrefs(), now, store.activeSessionId);
    for (const id of plan.stamp) store.updateSession(id, s => ({ ...s, archivedAt: now }));
    // updateSession records the archive time when a chat is archived
    for (const id of plan.archive) store.updateSession(id, s => ({ ...s, archived: true }));
    const remove = await deleteSessionBatch(plan.remove, id => {
        const eligible = () => {
            const current = useChatStore.getState();
            return planRetention(Object.values(current.sessions).filter(s => s.id !== current.streamingSessionId),
                currentChatPrefs(), now, current.activeSessionId).remove.includes(id);
        };
        return eligible() ? useChatStore.getState().deleteSession(id, eligible) : Promise.resolve(false);
    });
    if (plan.archive.length || plan.remove.length) {
        console.info(`[ChatHistory] Archived ${plan.archive.length}, deleted ${remove.length}, incomplete/skipped ${plan.remove.length - remove.length} chats by the history settings`);
    }
    return { ...plan, remove };
}

let running: Promise<RetentionPlan> | null = null;
export function applyChatRetention(now = Date.now()): Promise<RetentionPlan> {
    if (running) return running;
    running = sweep(now).finally(() => { running = null; });
    return running;
}

let started = false;

/** Runs the history preferences after startup, every hour, and whenever they change. */
export function startChatRetention(): void {
    if (started) return;
    started = true;
    const run = () => { void applyChatRetention().catch(error => console.error('[ChatHistory] Cleanup failed:', error)); };
    run();
    setInterval(run, HOUR_MS);
    useChatPrefsStore.subscribe(run);
}

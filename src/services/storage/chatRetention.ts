import type { ChatPrefs } from '../../store/chat/useChatPrefsStore';

const DAY_MS = 24 * 60 * 60 * 1000;

/** The session fields the retention rules read. */
export interface RetentionSession {
    id: string;
    archived: boolean;
    archivedAt?: number;
    updatedAt: number;
    pinned: boolean;
    favourite: boolean;
    isIncognito?: boolean;
}

export interface RetentionPlan {
    /** Archived chats with no archive time yet: their delete timer starts now */
    stamp: string[];
    /** Inactive chats to move to the archive */
    archive: string[];
    /** Chats to delete */
    remove: string[];
}

/**
 * Which chats the history preferences archive or delete at `now`. The open chat, private chats
 * and (when protected) pinned or favourite chats are never touched.
 */
export function planRetention(
    sessions: RetentionSession[],
    prefs: ChatPrefs,
    now: number,
    activeId: string | null
): RetentionPlan {
    const plan: RetentionPlan = { stamp: [], archive: [], remove: [] };
    const removed = new Set<string>();
    const isProtected = (s: RetentionSession) => prefs.protectPinned && (s.pinned || s.favourite);
    const olderThan = (time: number, days: number) => days > 0 && now - time >= days * DAY_MS;

    const saved = sessions.filter(s => !s.isIncognito && s.id !== activeId);
    for (const s of saved) {
        if (isProtected(s)) continue;
        if (olderThan(s.updatedAt, prefs.deleteInactiveAfterDays)) {
            removed.add(s.id);
        } else if (s.archived && prefs.archiveDeleteAfterDays > 0) {
            if (s.archivedAt === undefined) {
                // Archived before archive times were kept: count from now instead of deleting at once
                plan.stamp.push(s.id);
            } else if (olderThan(s.archivedAt, prefs.archiveDeleteAfterDays)) {
                removed.add(s.id);
            }
        } else if (!s.archived && olderThan(s.updatedAt, prefs.autoArchiveAfterDays)) {
            plan.archive.push(s.id);
        }
    }

    if (prefs.maxChats > 0) {
        const kept = sessions.filter(s => !s.isIncognito && !removed.has(s.id));
        let excess = kept.length - prefs.maxChats;
        const oldestFirst = kept
            .filter(s => s.id !== activeId && !isProtected(s))
            .sort((a, b) => a.updatedAt - b.updatedAt);
        for (const s of oldestFirst) {
            if (excess <= 0) break;
            removed.add(s.id);
            excess--;
        }
    }

    plan.remove = [...removed];
    plan.archive = plan.archive.filter(id => !removed.has(id));
    plan.stamp = plan.stamp.filter(id => !removed.has(id));
    return plan;
}

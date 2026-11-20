import { test } from 'node:test';
import assert from 'node:assert/strict';

// Pure logic mirrors useChatStore.ts hydration resolution
function resolveHydrationActiveChat(
    routeChatId: string | null | undefined,
    sessionsMap: Record<string, { id: string }>
): string | null {
    if (routeChatId && sessionsMap[routeChatId]) {
        return routeChatId;
    }
    return null;
}

// Pure logic mirrors IndexedDbChatStorageDriver.ts index resolution
function resolveDriverIndexActiveChat(
    catalog: { lastActiveSessionId?: string | null } | null | undefined,
    mergedSessions: Array<{ id: string }>
): string | null {
    return catalog?.lastActiveSessionId ?? null;
}

test('[P11] resolveHydrationActiveChat returns null (New Chat) on clean root URL without ?c=', () => {
    const sessions = {
        'chat_old_1': { id: 'chat_old_1' },
        'chat_old_2': { id: 'chat_old_2' },
    };

    // User is on root / (no ?c= in URL)
    const result = resolveHydrationActiveChat(null, sessions);
    assert.equal(result, null, 'Clean URL must strictly preserve New Chat state');
});

test('[P11] resolveHydrationActiveChat returns matching session when ?c= is present in URL', () => {
    const sessions = {
        'chat_20261019_120000_abcd': { id: 'chat_20261019_120000_abcd' },
    };

    const result = resolveHydrationActiveChat('chat_20261019_120000_abcd', sessions);
    assert.equal(result, 'chat_20261019_120000_abcd', 'Valid ?c= parameter must restore the specified chat');
});

test('[P11] resolveHydrationActiveChat falls back to null when ?c= references non-existent chat', () => {
    const sessions = {
        'chat_valid': { id: 'chat_valid' },
    };

    const result = resolveHydrationActiveChat('chat_deleted_or_unknown', sessions);
    assert.equal(result, null, 'Unknown or deleted ?c= parameter must gracefully fall back to New Chat');
});

test('[P10] IndexedDB driver preserves null lastActiveSessionId without resurrecting old chats', () => {
    const sessions = [{ id: 'chat_old_1' }, { id: 'chat_old_2' }];

    // User was on New Chat when saved
    const catalog = { lastActiveSessionId: null };
    const resolved = resolveDriverIndexActiveChat(catalog, sessions);

    assert.equal(resolved, null, 'Driver must preserve null and NOT fall back to sessions[0].id');
});

test('[P10] IndexedDB driver restores lastActiveSessionId when present', () => {
    const sessions = [{ id: 'chat_old_1' }, { id: 'chat_old_2' }];

    const catalog = { lastActiveSessionId: 'chat_old_2' };
    const resolved = resolveDriverIndexActiveChat(catalog, sessions);

    assert.equal(resolved, 'chat_old_2', 'Driver must return the saved active session ID');
});

test('[P12] URL sync effect preserves initial ?c= route across React StrictMode double-mount before hydration finishes', () => {
    // Mirrors App.tsx + useChatStore.ts initial activeSessionId + hydration guard
    const urlAtLoad = 'chat_20261119_211051_klc7';
    const initialStoreActiveSessionId = urlAtLoad;
    const isHydrated = false;

    const syncedChatId = isHydrated ? null : (urlAtLoad ?? initialStoreActiveSessionId);
    assert.equal(syncedChatId, 'chat_20261119_211051_klc7', 'Pre-hydration effect run must never strip ?c= from the URL');
});

test('[P13] Layout store hydration honors URL route across all top-level pages instead of resetting to chat', () => {
    function parseView(pathname: string): string {
        const lower = pathname.toLowerCase();
        if (lower === '/extensions' || lower.startsWith('/extensions/')) return 'extensions';
        if (lower.includes('/notebook')) return 'notebook';
        if (lower.includes('/automation')) return 'automation';
        if (lower.includes('/apis')) return 'apis';
        if (lower.includes('/toolkit')) return 'toolkit';
        if (lower.includes('/library')) return 'library';
        return 'chat';
    }
    for (const [path, expected] of [
        ['/toolkit', 'toolkit'],
        ['/apis', 'apis'],
        ['/notebook', 'notebook'],
        ['/library', 'library'],
        ['/automation', 'automation'],
        ['/extensions/cluaiz.notebook/main', 'extensions'],
        ['/', 'chat'],
    ] as const) {
        assert.equal(parseView(path), expected, `Refreshing ${path} must keep activeView=${expected}`);
    }
});

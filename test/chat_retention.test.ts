import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planRetention, type RetentionSession } from '../src/services/storage/chatRetention.ts';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;
const prefs = {
    saveHistory: true, archiveDeleteAfterDays: 0, archivedActivity: 'unarchive' as const,
    autoArchiveAfterDays: 0, deleteInactiveAfterDays: 0, maxChats: 0, protectPinned: true,
};
function chat(id: string, extra: Partial<RetentionSession> = {}): RetentionSession {
    return { id, archived: false, updatedAt: NOW, pinned: false, favourite: false, ...extra };
}

test('defaults never archive or delete anything', () => {
    const plan = planRetention([chat('a', { updatedAt: NOW - 900 * DAY }), chat('b', { archived: true, archivedAt: NOW - 900 * DAY })], prefs, NOW, null);
    assert.deepEqual(plan, { stamp: [], archive: [], remove: [] });
});

test('archived chats are deleted N days after archiving, counted from archivedAt', () => {
    const p = { ...prefs, archiveDeleteAfterDays: 30 };
    const plan = planRetention([
        chat('old', { archived: true, archivedAt: NOW - 31 * DAY }),
        chat('recent', { archived: true, archivedAt: NOW - 5 * DAY, updatedAt: NOW - 400 * DAY }),
        chat('legacy', { archived: true }),
    ], p, NOW, null);
    assert.deepEqual(plan.remove, ['old']);
    assert.deepEqual(plan.stamp, ['legacy']);
});

test('inactive chats are archived; pinned, favourite, open and private chats are untouched', () => {
    const p = { ...prefs, autoArchiveAfterDays: 30 };
    const stale = { updatedAt: NOW - 60 * DAY };
    const plan = planRetention([
        chat('stale', stale), chat('pinned', { ...stale, pinned: true }), chat('fav', { ...stale, favourite: true }),
        chat('open', stale), chat('private', { ...stale, isIncognito: true }), chat('fresh'),
    ], p, NOW, 'open');
    assert.deepEqual(plan.archive, ['stale']);
    assert.deepEqual(planRetention([chat('pinned', { ...stale, pinned: true })], { ...p, protectPinned: false }, NOW, null).archive, ['pinned']);
});

test('delete-inactive wins over archive, and keep-at-most removes the oldest unprotected', () => {
    const p = { ...prefs, autoArchiveAfterDays: 30, deleteInactiveAfterDays: 90 };
    assert.deepEqual(planRetention([chat('ancient', { updatedAt: NOW - 100 * DAY })], p, NOW, null), { stamp: [], archive: [], remove: ['ancient'] });
    const capped = planRetention([
        chat('c1', { updatedAt: NOW - 3 * DAY }), chat('c2', { updatedAt: NOW - 2 * DAY, pinned: true }),
        chat('c3', { updatedAt: NOW - 1 * DAY }), chat('c4'),
    ], { ...prefs, maxChats: 2 }, NOW, null);
    assert.deepEqual(capped.remove, ['c1', 'c3']);
});

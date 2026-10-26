import test from 'node:test';
import assert from 'node:assert/strict';
import { DesktopLifecycleController, BACKGROUND_PREFERENCE, type DesktopLifecycleAPI, type DesktopStatus } from '../src/core/desktopLifecycle';
function fixture(raw: string | null = null) {
    const values = new Map<string, string>(); if (raw !== null) values.set(BACKGROUND_PREFERENCE, raw);
    const calls: boolean[] = [];
    let native = false, reject = false, deniedStorage = false;
    const status = (): DesktopStatus => ({ backgroundEnabled: native, trayReady: true, mainVisible: true, quitting: false, error: null });
    const api: DesktopLifecycleAPI = { status: async () => status(), configure: async enabled => {
        calls.push(enabled); if (reject) throw Error('Controlled native denial'); native = enabled; return status();
    }, show: async () => {}, quit: async () => {} };
    const storage = { getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => { if (deniedStorage) throw Error('Storage denied'); values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
    return { controller: new DesktopLifecycleController(api, () => storage, true), api, values, calls,
        native: () => native, reject: () => { reject = true; }, denyStorage: () => { deniedStorage = true; } };
}
test('existing preference initializes once concurrently and an acknowledged toggle persists', async () => {
    const value = fixture();
    await Promise.all([value.controller.initialize(), value.controller.initialize()]);
    assert.deepEqual(value.calls, [true]); assert.equal(value.native(), true);
    await value.controller.setEnabled(false);
    assert.equal(value.values.get(BACKGROUND_PREFERENCE), 'false'); assert.equal(value.native(), false);
    assert.equal(value.controller.getSnapshot().enabled, false);
});
test('native failure restores the exact old preference and retains effective policy', async () => {
    const value = fixture('false'); await value.controller.initialize(); value.reject();
    await assert.rejects(value.controller.setEnabled(true), /native denial/);
    assert.equal(value.values.get(BACKGROUND_PREFERENCE), 'false'); assert.equal(value.controller.getSnapshot().enabled, false);
    assert.match(value.controller.getSnapshot().error, /native denial/);
});
test('storage failure prevents native toggle rather than reporting saved', async () => {
    const value = fixture('false'); await value.controller.initialize(); value.denyStorage();
    await assert.rejects(value.controller.setEnabled(true), /Storage denied/);
    assert.deepEqual(value.calls, [false]); assert.equal(value.native(), false);
});
test('browser mode does not invoke native or mutate preferences', async () => {
    const value = fixture('true');
    const browser = new DesktopLifecycleController(value.api, () => { throw Error('Must not read desktop preference'); }, false);
    await browser.initialize(); await assert.rejects(browser.setEnabled(true), /desktop App/);
    assert.equal(browser.getSnapshot().available, false); assert.deepEqual(value.calls, []);
});
test('unavailable native status leaves the setting unavailable with an explicit error', async () => {
    const value = fixture(); value.api.status = async () => { throw Error('Native lifetime unavailable'); };
    await assert.rejects(value.controller.initialize(), /unavailable/);
    assert.equal(value.controller.getSnapshot().available, false); assert.equal(value.controller.getSnapshot().busy, false);
    assert.equal(value.controller.getSnapshot().enabled, false); assert.deepEqual(value.calls, []);
});

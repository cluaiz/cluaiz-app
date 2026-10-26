import test from 'node:test';
import assert from 'node:assert/strict';
import { ExtensionActivitiesStore, MAX_EXTENSION_ACTIVITIES } from '../src/extensions/activities';

test('activity owner validates identity, deduplicates, bounds and stops only the selected activity', () => {
    const manager = new ExtensionActivitiesStore();
    assert.throws(() => manager.open({ extensionId: '../bad', viewId: 'main' }), /Invalid/);
    const ids = Array.from({ length: MAX_EXTENSION_ACTIVITIES }, (_, index) => manager.open({ extensionId: `fixture.app-${index}`, viewId: 'main' }));
    assert.throws(() => manager.open({ extensionId: 'fixture.app-0', viewId: 'main' }), /already/);
    assert.throws(() => manager.open({ extensionId: 'fixture.another', viewId: 'main' }), /Close/);
    const snapshot = manager.getSnapshot();
    manager.stop(ids[1]);
    assert.equal(manager.getSnapshot().length, MAX_EXTENSION_ACTIVITIES - 1);
    assert.equal(snapshot.length, MAX_EXTENSION_ACTIVITIES);
    assert.ok(manager.getSnapshot().every(entry => entry.id !== ids[1]));
    assert.ok(Object.isFrozen(snapshot) && snapshot.every(Object.isFrozen));
});
test('closed activities ignore late failure and subscriptions do not leak', () => {
    const manager = new ExtensionActivitiesStore(); let events = 0;
    const unsubscribe = manager.subscribe(() => events++);
    const id = manager.open({ extensionId: 'fixture.app', viewId: 'main' });
    manager.fail(id, 'Actual provider error');
    assert.equal(manager.getSnapshot()[0].status, 'failed');
    assert.equal(manager.getSnapshot()[0].error, 'Actual provider error');
    manager.stop(id); manager.fail(id, 'Late failure'); manager.stop(id);
    assert.equal(events, 3);
    const reopened = manager.open({ extensionId: 'fixture.app', viewId: 'main' });
    assert.notEqual(reopened, id);
    unsubscribe(); manager.stop(reopened);
    assert.equal(events, 4);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
    useNotificationStore,
    TRANSMISSION_SOUNDS,
    COMPLETION_SOUNDS,
    ALERT_SOUNDS,
    AVAILABLE_SOUNDS,
    sanitizeSoundSelection,
} from '../src/store/ui/useNotificationStore';
import { soundManager } from '../src/services/sound/soundManager';

test('notification store: categorized sound collections and zero cross-overlap', () => {
    assert.ok(TRANSMISSION_SOUNDS.length >= 2, 'Must have at least 2 transmission sounds');
    assert.ok(COMPLETION_SOUNDS.length >= 2, 'Must have at least 2 completion sounds');
    assert.ok(ALERT_SOUNDS.length >= 2, 'Must have at least 2 alert sounds');

    // Verify transmission sounds do not overlap with alert sounds
    const transmissionIds = new Set(TRANSMISSION_SOUNDS.map(s => s.id));
    const alertIds = new Set(ALERT_SOUNDS.map(s => s.id));
    for (const id of alertIds) {
        assert.strictEqual(transmissionIds.has(id), false, `Sound ${id} must not be in both Transmission and Alert`);
    }

    // Verify all sounds have non-empty labels and valid IDs
    for (const s of AVAILABLE_SOUNDS) {
        assert.ok(s.id.length > 0);
        assert.ok(s.label.length > 0);
        assert.ok(s.filename.length > 0);
    }
});

test('notification store: auto-sanitization heals legacy mismatched sound IDs', () => {
    // If a click sound was previously stored in Error alerts, it must sanitize to default alert
    const sanitizedError = sanitizeSoundSelection(
        'justsomesounds-click.mp3',
        ALERT_SOUNDS,
        'sms-vibration-notification-.mp3'
    );
    assert.strictEqual(sanitizedError, 'sms-vibration-notification-.mp3');

    // Valid alert ID remains unchanged
    const validAlert = sanitizeSoundSelection(
        'sms-vibration-notification-.mp3',
        ALERT_SOUNDS,
        'sms-vibration-notification-.mp3'
    );
    assert.strictEqual(validAlert, 'sms-vibration-notification-.mp3');

    // Synthesized tone alert is valid in alert sounds
    const validSynth = sanitizeSoundSelection(
        'synth:warning-pulse',
        ALERT_SOUNDS,
        'sms-vibration-notification-.mp3'
    );
    assert.strictEqual(validSynth, 'synth:warning-pulse');
});

test('notification store: mutations, clamping, and category-safe setters', () => {
    const store = useNotificationStore.getState();

    // Toggle master sound
    store.setSoundEnabled(false);
    assert.strictEqual(useNotificationStore.getState().soundEnabled, false);
    store.setSoundEnabled(true);
    assert.strictEqual(useNotificationStore.getState().soundEnabled, true);

    // Change volume
    store.setVolume(0.5);
    assert.strictEqual(useNotificationStore.getState().volume, 0.5);

    // Set valid transmission sound
    store.setSelectedSendSound('vadim_makes_sound-soft-app-button-tap-sound.mp3');
    assert.strictEqual(
        useNotificationStore.getState().selectedSendSound,
        'vadim_makes_sound-soft-app-button-tap-sound.mp3'
    );

    // Attempting to set an alert sound into transmission slot should auto-sanitize to default
    store.setSelectedSendSound('sms-vibration-notification-.mp3');
    assert.strictEqual(
        useNotificationStore.getState().selectedSendSound,
        'send-sms.mp3'
    );

    // Restore default
    store.setSelectedSendSound('send-sms.mp3');
    store.setSelectedCompleteSound('new-notification.mp3');
    store.setSelectedErrorSound('sms-vibration-notification-.mp3');
    store.setVolume(0.75);
});

test('soundManager: graceful handling in non-browser environment including synth tones', async () => {
    // Calling sound triggers and synth tones in headless/node environment should not throw
    assert.doesNotThrow(() => {
        soundManager.playSend();
        soundManager.playComplete();
        soundManager.playError();
        soundManager.playPreview('new-notification.mp3');
        soundManager.playPreview('synth:crystal-bell');
        soundManager.playPreview('synth:warning-pulse');
    });

    // Permission check in headless should safely return 'unsupported'
    const status = soundManager.getPermissionStatus();
    assert.strictEqual(status, 'unsupported');

    const req = await soundManager.requestPermission();
    assert.strictEqual(req, 'unsupported');

    // notifyBackground should not throw when window/document are absent
    assert.doesNotThrow(() => {
        soundManager.notifyBackground('Test', { body: 'Test notification' });
    });
});

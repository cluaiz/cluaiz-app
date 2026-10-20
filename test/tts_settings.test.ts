import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getStoredTtsSettings, saveStoredTtsSettings, settingsForTtsModel, subscribeTtsSettings, speechPreferenceKey, TTS_SETTINGS_KEY } from '../src/services/audio/ttsSettings';
import { audioApi } from '../src/api/engine/audio/audio.api';

const values = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
}, configurable: true });

test('legacy settings migrate and switching models restores independent voice and language', () => {
    values.clear();
    values.set(TTS_SETTINGS_KEY, JSON.stringify({ selectedModel: 'a', selectedVoice: 'one', playbackSpeed: 1.25 }));
    assert.equal(settingsForTtsModel('a').selectedVoice, 'one');
    saveStoredTtsSettings({ ...settingsForTtsModel('a'), selectedLanguage: 'hi' });
    assert.equal(settingsForTtsModel('b').selectedVoice, 'default');
    assert.equal(settingsForTtsModel('b').selectedLanguage, 'auto');
    saveStoredTtsSettings({ ...settingsForTtsModel('b'), selectedVoice: 'two', selectedLanguage: 'en', coherentInput: true });
    assert.equal(settingsForTtsModel('a').selectedVoice, 'one');
    assert.equal(settingsForTtsModel('a').selectedLanguage, 'hi');
    assert.equal(settingsForTtsModel('a').playbackSpeed, 1.25);
    assert.equal(settingsForTtsModel('b').coherentInput, true);
});

test('corrupt or invalid storage does not leak invalid speech settings', () => {
    values.set(TTS_SETTINGS_KEY, 'null');
    assert.equal(getStoredTtsSettings().playbackSpeed, 1);
    values.set(TTS_SETTINGS_KEY, JSON.stringify({ playbackSpeed: -4, selectedLanguage: {}, selectedVoice: 42 }));
    assert.equal(getStoredTtsSettings().playbackSpeed, 1);
    assert.equal(getStoredTtsSettings().selectedVoice, 'default');
    assert.equal(getStoredTtsSettings().selectedLanguage, 'auto');
});

test('default-only model capabilities retain independent supported languages', async t => {
    const capabilities = { languages: ['en', 'es'], language_control: 'explicit', voice_mode: 'reference_source', coherent_input: true };
    t.mock.method(globalThis, 'fetch', async () => Response.json({ model: 'test', data: [{ id: 'default', language: null, default: true }], capabilities }));
    const catalog = await audioApi.voiceCatalog('test');
    assert.deepEqual(catalog.capabilities, capabilities);
    assert.equal(catalog.data.length, 1);
});

test('old engine voice responses stay compatible without invented languages', async t => {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ data: [{ id: 'one', language: 'hi', default: false }] }));
    assert.deepEqual((await audioApi.voiceCatalog()).capabilities.languages, ['hi']);
    assert.equal((await audioApi.voices()).length, 1);
});

test('successful same-document saves notify playback; unsubscribe and failed saves do not', t => {
    values.clear();
    const seen: string[] = [];
    const stop = subscribeTtsSettings(settings => seen.push(settings.selectedModel || ''));
    const settings = { playbackSpeed: 1, selectedModel: 'a', selectedVoice: 'one' };
    assert.equal(saveStoredTtsSettings(settings), true);
    assert.deepEqual(seen, ['a']);
    assert.equal(speechPreferenceKey(settings), speechPreferenceKey({ ...settings, playbackSpeed: 1.5 }));
    assert.notEqual(speechPreferenceKey(settings), speechPreferenceKey({ ...settings, selectedVoice: 'two' }));
    stop(); saveStoredTtsSettings({ ...settings, selectedModel: 'b' });
    assert.deepEqual(seen, ['a']);
    t.mock.method(localStorage, 'setItem', () => { throw new Error('Blocked storage'); });
    assert.equal(saveStoredTtsSettings(settings), false);
});

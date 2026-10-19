import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSpeakerLanguages, saveSpeakerLanguages, languageLabel, MAX_SPEAKER_LANGUAGES } from '../src/services/audio/speakerLanguages.ts';

const store = new Map<string, string>();
(globalThis as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
};

test('no choice means every language (an empty list is not sent)', () => {
    store.clear();
    assert.deepEqual(getSpeakerLanguages(), []);
});

test('the chosen languages are kept, at most the engine limit', () => {
    saveSpeakerLanguages(['hi', 'en']);
    assert.deepEqual(getSpeakerLanguages(), ['hi', 'en']);
    saveSpeakerLanguages(Array.from({ length: 15 }, (_, i) => `l${i}`));
    assert.equal(getSpeakerLanguages().length, MAX_SPEAKER_LANGUAGES);
    store.set('cluaiz_speaker_languages', 'not json');
    assert.deepEqual(getSpeakerLanguages(), []);
});

test('languages are shown by name, with their own name when it differs', () => {
    assert.equal(languageLabel('hi'), 'Hindi · हिन्दी');
    assert.equal(languageLabel('en'), 'English');
});

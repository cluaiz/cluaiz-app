import test from 'node:test';
import assert from 'node:assert/strict';
import { useSpeechHighlightStore } from '../src/store/chat/useSpeechHighlightStore';

function tokenizeSentenceWords(sentence: string): { words: string[]; wordWeights: number[]; totalWeight: number } {
    const rawTokens = sentence.trim().split(/\s+/).filter(Boolean);
    const words: string[] = [];
    const wordWeights: number[] = [];
    let total = 0;

    for (const t of rawTokens) {
        words.push(t);
        let w = Math.max(2, t.length);
        if (/[.,!?;:।]/.test(t)) {
            w += 2;
        }
        wordWeights.push(w);
        total += w;
    }

    return { words, wordWeights, totalWeight: Math.max(1, total) };
}

function calculateActiveWordIndex(
    progress: number,
    wordWeights: number[],
    totalWeight: number,
    wordCount: number
): number {
    if (wordCount <= 0) return 0;
    if (progress <= 0) return 0;
    if (progress >= 1) return wordCount - 1;

    const target = progress * totalWeight;
    let accumulated = 0;
    for (let i = 0; i < wordCount; i++) {
        accumulated += wordWeights[i];
        if (accumulated >= target) {
            return i;
        }
    }
    return wordCount - 1;
}

test('initializes with idle state', () => {
    useSpeechHighlightStore.getState().clear();
    const state = useSpeechHighlightStore.getState();
    assert.equal(state.activeMessageId, null);
    assert.equal(state.sentenceText, null);
    assert.equal(state.activeWordIndex, -1);
    assert.equal(state.isPlaying, false);
});

test('sets active sentence and marks playing', () => {
    useSpeechHighlightStore.getState().clear();
    useSpeechHighlightStore.getState().setActiveSentence({
        messageId: 'msg-123',
        sentenceText: 'एक दिन, एक छोटी जगह में एक साथी था।',
        sentenceIndex: 0,
    });

    const state = useSpeechHighlightStore.getState();
    assert.equal(state.activeMessageId, 'msg-123');
    assert.equal(state.sentenceText, 'एक दिन, एक छोटी जगह में एक साथी था।');
    assert.equal(state.sentenceIndex, 0);
    assert.equal(state.activeWordIndex, 0);
    assert.equal(state.isPlaying, true);
});

test('updates word progress deterministically', () => {
    useSpeechHighlightStore.getState().clear();
    useSpeechHighlightStore.getState().setActiveSentence({
        messageId: 'msg-123',
        sentenceText: 'Hello world',
        sentenceIndex: 0,
    });

    useSpeechHighlightStore.getState().updateWordProgress(1, 'world');
    const state = useSpeechHighlightStore.getState();
    assert.equal(state.activeWordIndex, 1);
    assert.equal(state.activeWord, 'world');
});

test('clears state accurately on stop or message switch', () => {
    useSpeechHighlightStore.getState().clear();
    useSpeechHighlightStore.getState().setActiveSentence({
        messageId: 'msg-123',
        sentenceText: 'Testing clear',
        sentenceIndex: 0,
    });

    useSpeechHighlightStore.getState().clear('msg-different');
    assert.equal(useSpeechHighlightStore.getState().activeMessageId, 'msg-123');

    useSpeechHighlightStore.getState().clear('msg-123');
    assert.equal(useSpeechHighlightStore.getState().activeMessageId, null);
    assert.equal(useSpeechHighlightStore.getState().isPlaying, false);
});

test('calculates weighted word progression across sentence duration', () => {
    const sentence = 'एक दिन, एक छोटी जगह में एक अद्वितीय साथी था।';
    const { words, wordWeights, totalWeight } = tokenizeSentenceWords(sentence);

    assert.equal(words.length, 10);
    assert.ok(totalWeight > 0);

    // At 0% progress -> First word
    assert.equal(calculateActiveWordIndex(0.0, wordWeights, totalWeight, words.length), 0);

    // At 50% progress -> Middle word
    const midWordIdx = calculateActiveWordIndex(0.5, wordWeights, totalWeight, words.length);
    assert.ok(midWordIdx > 1);
    assert.ok(midWordIdx < words.length - 1);

    // At 100% progress -> Last word
    assert.equal(calculateActiveWordIndex(1.0, wordWeights, totalWeight, words.length), words.length - 1);
});

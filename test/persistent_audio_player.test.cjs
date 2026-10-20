const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHarness } = require('./helpers/audio_deck_harness.cjs');
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const audio = () => new Blob(['audio']);

test('completed message synthesizes both sentences, plays, pauses and replays cached parts', async () => {
    const h = createHarness(), deck = h.mount({ autoStart: true });
    await deck.flush();
    assert.deepEqual(h.calls.map(c => c.payload.input), ['First sentence.', 'Second sentence.']);
    assert.equal(h.audios.length, 1);
    h.probes.forEach(probe => probe.metadata(2));
    h.audios[0].metadata(2);
    assert.match(deck.text, /00:00 \/ 00:04/);
    deck.click('Pause'); assert.equal(h.audios[0].paused, true);
    deck.click(); assert.equal(h.audios[0].paused, false);
    h.audios[0].end(); assert.equal(h.audios.length, 2);
    h.audios[1].end(); assert.equal(h.turns.isIdle(), true);
    deck.click(); assert.equal(h.audios.length, 3);
    assert.equal(h.calls.length, 2, 'replay must use cached audio');
    deck.unmount(); assert.equal(h.revoked.length, 2);
});

test('live answer flushes its final sentence exactly once', async () => {
    const h = createHarness(), deck = h.mount({ text: 'First sentence. Unfinished', isStreamingAi: true, autoStart: true });
    await deck.flush(); assert.equal(h.calls.length, 1);
    deck.render({ text: 'First sentence. Unfinished sentence', isStreamingAi: false });
    await deck.flush();
    assert.deepEqual(h.calls.map(c => c.payload.input), ['First sentence.', 'Unfinished sentence']);
    h.audios[0].end(); h.audios[1].end();
    assert.equal(h.turns.isIdle(), true); deck.unmount();
});

test('stop aborts fetch, a late result and old finalizer cannot corrupt a new run', async () => {
    const old = deferred(), fresh = deferred();
    let n = 0;
    const h = createHarness(() => ++n === 1 ? old.promise : n === 2 ? fresh.promise : Promise.resolve(audio()));
    const deck = h.mount({ autoStart: true });
    await deck.flush();
    const signal = h.calls[0].signal;
    deck.click('Close audio player'); assert.equal(signal.aborted, true);
    deck.click(); await deck.flush();
    assert.notEqual(h.calls[1].signal, signal);
    old.resolve(audio()); await deck.flush();
    assert.equal(h.audios.length, 0, 'stopped response must not start audio');
    fresh.resolve(audio()); await deck.flush();
    assert.equal(h.calls.length, 3, 'old queued sentence must not run');
    h.audios[0].end(); h.audios[1].end();
    assert.equal(h.turns.isIdle(), true, 'stale finalizer must not decrement the new pending count');
    deck.unmount();
});

test('unmount cancels synthesis and ignores a late rejection', async () => {
    const request = deferred(), h = createHarness(() => request.promise);
    const deck = h.mount({ autoStart: true }); await deck.flush();
    deck.unmount(); assert.equal(h.calls[0].signal.aborted, true);
    request.reject(new Error('late network failure')); await deck.flush();
    assert.equal(h.audios.length, 0); assert.deepEqual(h.errors, []);
});

test('engine rejection is visible and Play can retry the same message', async () => {
    let fail = true;
    const h = createHarness(async () => { if (fail) throw new Error('Model unavailable'); return audio(); });
    const deck = h.mount({ autoStart: true }); await deck.flush();
    assert.match(deck.alert, /Model unavailable/);
    assert.equal(h.turns.isIdle(), true);
    fail = false; deck.click(); await deck.flush();
    assert.equal(deck.alert, ''); assert.equal(h.audios.length, 1);
    deck.unmount();
});

test('decode errors are visible; stale media callbacks cannot advance retry playback', async () => {
    const h = createHarness(), deck = h.mount({ autoStart: true }); await deck.flush();
    const old = h.audios[0]; old.error = { message: 'Unsupported audio data' }; old.onerror();
    assert.match(deck.alert, /Unsupported audio data/);
    assert.equal(h.turns.isIdle(), true);
    deck.click(); await deck.flush();
    const count = h.audios.length;
    old.onended(); old.metadata(99); old.onerror();
    assert.equal(h.audios.length, count); assert.equal(deck.alert, '');
    h.probes.slice(-2).forEach(probe => probe.metadata(1.5));
    assert.match(deck.text, /00:03/);
    deck.unmount();
});

test('play rejection is shown, while pause-induced rejection is ignored', async () => {
    const h = createHarness(), deck = h.mount({ autoStart: true }); await deck.flush();
    deck.click('Pause');
    h.audios[0].play = () => Promise.reject(new Error('Browser blocked playback'));
    deck.click(); await deck.flush();
    assert.match(deck.alert, /Browser blocked playback/);
    deck.click(); await deck.flush();
    deck.click('Pause');
    h.audios.at(-1).play = () => Promise.reject(new Error('interrupted by pause'));
    deck.click(); deck.click('Pause'); await deck.flush();
    assert.equal(deck.alert, ''); deck.unmount();
});

test('another message takes the speaking turn without old audio resuming', async () => {
    const h = createHarness(), first = h.mount({ messageId: 'a', autoStart: true }); await first.flush();
    const second = h.mount({ messageId: 'b', autoStart: true }); await second.flush();
    assert.equal(h.audios[0].paused, true); assert.equal(h.turns.isSpeaking('b'), true);
    h.audios[0].end(); assert.equal(h.audios.length, 2);
    first.unmount(); assert.equal(h.turns.isSpeaking('b'), true); second.unmount();
});

test('coherent capability buffers the complete live answer in one referenced synthesis', async () => {
    const pending = deferred();
    const h = createHarness(() => pending.promise, {
        settings: { selectedModel: 'reference-model', selectedLanguage: 'en', referenceSource: 'speaker.wav', playbackSpeed: 1.25 },
        capabilities: { coherent_input: true, voice_mode: 'reference_source' },
    });
    const deck = h.mount({ autoStart: true, text: 'First sentence.', isStreamingAi: true });
    await deck.flush(); assert.equal(h.calls.length, 0);
    deck.render({ text: 'First sentence. Second sentence.', isStreamingAi: false });
    await deck.flush();
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].payload.input, 'First sentence. Second sentence.');
    assert.equal(h.calls[0].payload.voice, 'speaker.wav');
    assert.equal(h.calls[0].payload.speed, undefined, 'browser rate owns speed once');
    assert.equal(h.audios.length, 0, 'do not play incomplete native output');
    pending.resolve(audio()); await deck.flush();
    assert.equal(h.audios.length, 1); assert.equal(h.audios[0].playbackRate, 1.25);
    h.audios[0].end(); deck.click(); await deck.flush();
    assert.equal(h.calls.length, 1, 'complete coherent WAV is replayed from cache');
    deck.unmount();
});

test('changing model cancels old synthesis and does not reuse its cached voice', async () => {
    const old = deferred();
    let count = 0;
    const h = createHarness(() => ++count === 1 ? old.promise : Promise.resolve(audio()), {
        settings: { selectedModel: 'old-model' }, capabilities: { coherent_input: true },
    });
    const deck = h.mount({ autoStart: true }); await deck.flush();
    h.settings({ selectedModel: 'new-model', selectedVoice: 'new-voice' });
    assert.equal(h.calls[0].signal.aborted, true);
    old.resolve(audio()); await deck.flush(); assert.equal(h.audios.length, 0);
    deck.click(); await deck.flush();
    assert.equal(h.calls[1].payload.model, 'new-model');
    assert.equal(h.calls[1].payload.voice, 'new-voice');
    assert.equal(h.audios.length, 1);
    deck.unmount();
});

test('cancelled capability lookup cannot start a stale synthesis', async () => {
    const catalog = deferred(), h = createHarness(undefined, { catalog: () => catalog.promise });
    const deck = h.mount({ autoStart: true }); await deck.flush();
    deck.click('Close audio player'); assert.equal(h.catalogs[0].signal.aborted, true);
    catalog.resolve({ capabilities: { coherent_input: true } }); await deck.flush();
    assert.equal(h.calls.length, 0); deck.unmount();
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { audioApi } from '../src/api/engine/audio/audio.api';
import { speechTurns } from '../src/services/audio/speechTurns';

// A PCM16 mono WAV container with one sample, for transport tests, not model quality.
const wav = Buffer.alloc(46);
wav.write('RIFF'); wav.writeUInt32LE(38, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(24000, 24); wav.writeUInt32LE(48000, 28);
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
wav.write('data', 36); wav.writeUInt32LE(2, 40); wav.writeInt16LE(100, 44);
const uri = `data:audio/wav;base64,${wav.toString('base64')}`;

test('streamed speech hands each sentence over as it arrives, even when an event is split across reads', async t => {
    const events = [
        { status: 'chunk', type: 'speech.audio.delta', index: 0, format: 'wav', audio: uri },
        { status: 'chunk', type: 'speech.audio.delta', index: 1, format: 'wav', audio: uri },
        { status: 'done', result: { output: { audio_data: uri } } },
    ].map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
    // Split in the middle of events, like a large SSE event over several network reads
    const pieces = [events.slice(0, 37), events.slice(37, 140), events.slice(140)];
    t.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
        assert.equal(JSON.parse(String(init.body)).stream, true);
        return new Response(new ReadableStream({
            start(controller) {
                for (const p of pieces) controller.enqueue(new TextEncoder().encode(p));
                controller.close();
            },
        }), { headers: { 'Content-Type': 'text/event-stream' } });
    });
    const parts: Blob[] = [];
    const whole = await audioApi.speechStream({ input: 'One. Two.' }, (p) => parts.push(p));
    assert.equal(parts.length, 2);
    assert.deepEqual(Buffer.from(await parts[1].arrayBuffer()), wav);
    assert.deepEqual(Buffer.from(await whole.arrayBuffer()), wav);
});

test('streamed speech surfaces the engine error', async t => {
    t.mock.method(globalThis, 'fetch', async () => Response.json(
        { error: { message: 'speed must be between 0.25 and 4' } }, { status: 400 }));
    await assert.rejects(audioApi.speechStream({ input: 'x', speed: 9 }, () => {}), /speed must be between/);
});

test('one message speaks at a time: a new one cuts off the old, listeners hear when it is quiet', () => {
    const log: string[] = [];
    const turn = (id: string) => ({ id, start: () => log.push(`start ${id}`), stop: () => log.push(`stop ${id}`) });
    let changes = 0;
    const unsubscribe = speechTurns.subscribe(() => changes++);
    speechTurns.request(turn('a'));
    speechTurns.request(turn('b')); // the newer answer takes over
    assert.equal(speechTurns.isSpeaking('b'), true);
    speechTurns.release('a'); // a stale release does nothing
    assert.equal(speechTurns.isSpeaking('b'), true);
    speechTurns.stopAll(); // the user spoke over it
    assert.equal(speechTurns.isIdle(), true);
    assert.deepEqual(log, ['start a', 'stop a', 'start b', 'stop b']);
    assert.equal(changes, 3);
    unsubscribe();
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { audioApi } from '../src/api/engine/audio/audio.api';
import { base64ToBlob, sniffMimeType } from '../src/utils/mimeSniffer';
import { useApiStore } from '../src/store/api/useApiStore';

// A PCM16 mono WAV container with one sample, for transport tests, not model quality.
const wav = Buffer.alloc(46);
wav.write('RIFF'); wav.writeUInt32LE(38, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(24000, 24); wav.writeUInt32LE(48000, 28);
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
wav.write('data', 36); wav.writeUInt32LE(2, 40); wav.writeInt16LE(100, 44);
const base64 = wav.toString('base64');

test('shared decoder accepts engine WAV data URI and raw base64 without treating RIFF as WebP', async () => {
    for (const audio of [base64, `data:audio/wav;base64,${base64}`]) {
        assert.equal(sniffMimeType(audio, 'wav'), 'audio/wav');
        const blob = base64ToBlob(audio, sniffMimeType(audio, 'wav'));
        assert.equal(blob.type, 'audio/wav');
        assert.deepEqual(Buffer.from(await blob.arrayBuffer()), wav);
    }
    assert.equal(sniffMimeType(Buffer.from('RIFFxxxxWEBP').toString('base64')), 'image/webp');
});

test('speech client returns decoded WAV bytes from the engine JSON envelope', async t => {
    t.mock.method(globalThis, 'fetch', async () => Response.json({
        model: 'selected-package', output: { audio_data: `data:audio/wav;base64,${base64}` }
    }));
    const blob = await audioApi.speech({ model: 'selected-package', input: 'hello' });
    assert.equal(blob.type, 'audio/wav');
    assert.deepEqual(Buffer.from(await blob.arrayBuffer()), wav);
});

test('speech client preserves binary responses and exposes actual engine errors', async t => {
    const mock = t.mock.method(globalThis, 'fetch', async () => new Response(wav, {
        headers: { 'Content-Type': 'audio/wav' }
    }));
    assert.deepEqual(Buffer.from(await (await audioApi.speech({ input: 'hello' })).arrayBuffer()), wav);
    mock.mock.mockImplementation(async () => Response.json({ error: { message: 'Required tokenizer missing' } }, { status: 500 }));
    await assert.rejects(audioApi.speech({ input: 'hello' }), /Required tokenizer missing/);
    mock.mock.mockImplementation(async () => Response.json({ status: 'success', output: {} }));
    await assert.rejects(audioApi.speech({ input: 'hello' }), /did not contain audio data/);
});

test('speech voice dropdown uses top-level voice and omits the default sentinel', () => {
    useApiStore.setState({ activeEndpoint: { path: '/v1/audio/speech' } as any,
        reqBody: JSON.stringify({ model: 'selected-package', input: 'hello', parameters: { voice_id: 'default' } }) });
    useApiStore.getState().setSelectedVoice('speaker');
    assert.deepEqual(JSON.parse(useApiStore.getState().reqBody), {
        model: 'selected-package', input: 'hello', voice: 'speaker'
    });
    useApiStore.getState().setSelectedVoice('default');
    assert.deepEqual(JSON.parse(useApiStore.getState().reqBody), { model: 'selected-package', input: 'hello' });
    useApiStore.setState({ activeEndpoint: { path: '/v1/audio/execute' } as any,
        reqBody: JSON.stringify({ parameters: { language: 'en' } }) });
    useApiStore.getState().setSelectedVoice('default');
    assert.deepEqual(JSON.parse(useApiStore.getState().reqBody), { parameters: { language: 'en' } });
});

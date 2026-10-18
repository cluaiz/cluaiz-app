import { test } from 'node:test';
import assert from 'node:assert/strict';
import { audioApi } from '../src/api/engine/audio/audio.api';

test('transcriptions client extracts text from Cluaiz Engine output envelope', async (t) => {
    t.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
        const body = JSON.parse(init.body as string);
        assert.equal(body.stream, false);
        return Response.json({
            status: 'success',
            task: 'speech_to_text',
            model: 'whisper-large-v3-turbo-INT8',
            info: null,
            output: {
                text: 'the stale smell of old beer lingers it takes heat to bring out',
                audio_data: null,
                segments: null,
            },
        });
    });

    const res = await audioApi.transcriptions({ file: 'data:audio/webm;base64,GkXfo59ChoEBQveBAULygQ8=' });
    assert.equal(res.text, 'the stale smell of old beer lingers it takes heat to bring out');
    assert.equal((res as any).model, 'whisper-large-v3-turbo-INT8');
});

test('transcriptions client accepts standard OpenAI STT format with top-level text', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => Response.json({
        text: 'hello world from whisper',
    }));

    const res = await audioApi.transcriptions({ file: 'data:audio/webm;base64,GkXfo59ChoEBQveBAULygQ8=' });
    assert.equal(res.text, 'hello world from whisper');
});

test('streamTranscriptions consumes SSE stream chunks and emits tokens in real time', async (t) => {
    const sseBody = [
        'data: {"status":"chunk","token":"Hello"}',
        'data: {"status":"chunk","token":" world"}',
        'data: {"status":"chunk","token":" from"}',
        'data: {"status":"chunk","token":" Whisper"}',
        'data: {"status":"done","result":{"status":"success","task":"speech_to_text","model":"whisper-large-v3-turbo-INT8","output":{"text":"Hello world from Whisper"}}}',
        'data: [DONE]',
    ].join('\n\n') + '\n\n';

    t.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
        const body = JSON.parse(init.body as string);
        assert.equal(body.stream, true);
        return new Response(sseBody, {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
        });
    });

    const receivedTokens: string[] = [];
    let completedText = '';

    const finalResult = await audioApi.streamTranscriptions(
        { file: 'data:audio/webm;base64,GkXfo59ChoEBQveBAULygQ8=' },
        {
            onToken: (tok) => receivedTokens.push(tok),
            onDone: (full) => { completedText = full; },
        }
    );

    assert.deepEqual(receivedTokens, ['Hello', ' world', ' from', ' Whisper']);
    assert.equal(completedText, 'Hello world from Whisper');
    assert.equal(finalResult, 'Hello world from Whisper');
});

test('transcriptions client throws formatted error when backend fails', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => new Response(
        JSON.stringify({ error: { message: 'Declared MIME audio/webm contradicts detected video/webm' } }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
    ));

    await assert.rejects(
        () => audioApi.transcriptions({ file: 'data:audio/webm;base64,GkXfo59ChoEBQveBAULygQ8=' }),
        /Audio transcription failed: 400/
    );
});

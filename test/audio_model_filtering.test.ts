import test from 'node:test';
import assert from 'node:assert/strict';
import {
    isTtsModel,
    isSttModel,
    isChatModel,
    getFilteredModelsForEndpoint
} from '../src/features/api/utils/modelFilter';
import { InstalledModel } from '../src/features/api/types';

const SAMPLE_MODELS: InstalledModel[] = [
    {
        id: 'llama_3.2_instruct-3b-gguf-q4_k_m',
        category: 'chat',
        supported_tasks: ['chat', 'text_generation']
    },
    {
        id: 'bonsai1-8b',
        category: 'chat',
        supported_tasks: ['chat', 'text_generation']
    },
    {
        id: 'gemma-4-e4b-it-gguf-Q4_K_M',
        category: 'chat',
        supported_tasks: ['chat']
    },
    {
        id: 'piper-en-us-ryan-medium',
        category: 'audio',
        supported_tasks: ['text_to_speech']
    },
    {
        id: 'Audio8-TTS-Preview-0.6B-ONNX-INT4-INT4',
        category: 'audio',
        supported_tasks: ['text_to_speech']
    },
    {
        id: 'whisper-large-v3-turbo-INT8',
        category: 'audio',
        supported_tasks: ['speech_to_text']
    },
    {
        id: 'bge-large-en-v1.5',
        category: 'embedding',
        supported_tasks: ['embedding']
    }
];

test('isTtsModel classifies TTS models and rejects STT and LLM models', () => {
    const piper = SAMPLE_MODELS.find(m => m.id === 'piper-en-us-ryan-medium')!;
    const audio8 = SAMPLE_MODELS.find(m => m.id === 'Audio8-TTS-Preview-0.6B-ONNX-INT4-INT4')!;
    const whisper = SAMPLE_MODELS.find(m => m.id === 'whisper-large-v3-turbo-INT8')!;
    const llama = SAMPLE_MODELS.find(m => m.id === 'llama_3.2_instruct-3b-gguf-q4_k_m')!;

    assert.equal(isTtsModel(piper), true);
    assert.equal(isTtsModel(audio8), true);
    assert.equal(isTtsModel(whisper), false);
    assert.equal(isTtsModel(llama), false);
});

test('isSttModel classifies STT models and rejects TTS and LLM models', () => {
    const piper = SAMPLE_MODELS.find(m => m.id === 'piper-en-us-ryan-medium')!;
    const whisper = SAMPLE_MODELS.find(m => m.id === 'whisper-large-v3-turbo-INT8')!;
    const llama = SAMPLE_MODELS.find(m => m.id === 'llama_3.2_instruct-3b-gguf-q4_k_m')!;

    assert.equal(isSttModel(whisper), true);
    assert.equal(isSttModel(piper), false);
    assert.equal(isSttModel(llama), false);
});

test('isChatModel rejects audio and embedding models', () => {
    const llama = SAMPLE_MODELS.find(m => m.id === 'llama_3.2_instruct-3b-gguf-q4_k_m')!;
    const piper = SAMPLE_MODELS.find(m => m.id === 'piper-en-us-ryan-medium')!;
    const whisper = SAMPLE_MODELS.find(m => m.id === 'whisper-large-v3-turbo-INT8')!;
    const bge = SAMPLE_MODELS.find(m => m.id === 'bge-large-en-v1.5')!;

    assert.equal(isChatModel(llama), true);
    assert.equal(isChatModel(piper), false);
    assert.equal(isChatModel(whisper), false);
    assert.equal(isChatModel(bge), false);
});

test('getFilteredModelsForEndpoint partitions models correctly', () => {
    // 1. Audio Speech (TTS - strictly TTS models only)
    const ttsFiltered = getFilteredModelsForEndpoint('/v1/audio/speech', SAMPLE_MODELS);
    assert.deepEqual(
        ttsFiltered.map(m => m.id),
        ['piper-en-us-ryan-medium', 'Audio8-TTS-Preview-0.6B-ONNX-INT4-INT4']
    );

    // 2. Audio Transcriptions (STT - strictly STT models only)
    const sttFiltered = getFilteredModelsForEndpoint('/v1/audio/transcriptions', SAMPLE_MODELS);
    assert.deepEqual(
        sttFiltered.map(m => m.id),
        ['whisper-large-v3-turbo-INT8']
    );

    // 3. Chat Completions (LLMs only, ZERO audio models)
    const chatFiltered = getFilteredModelsForEndpoint('/v1/chat/completions', SAMPLE_MODELS);
    assert.deepEqual(
        chatFiltered.map(m => m.id),
        [
            'llama_3.2_instruct-3b-gguf-q4_k_m',
            'bonsai1-8b',
            'gemma-4-e4b-it-gguf-Q4_K_M'
        ]
    );
});

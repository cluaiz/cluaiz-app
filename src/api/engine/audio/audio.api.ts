import { client } from '../../client';
import { AUDIO_ENDPOINTS } from './audio.endpoints';
import type {
  SpeechRequest,
  AudioExecuteRequest,
  AudioExecuteResponse,
  TranscriptionResponse,
} from './audio.types';

export const audioApi = {
  /**
   * Generates spoken audio from text using OpenAI-compatible TTS.
   */
  speech: async (payload: SpeechRequest): Promise<Blob> => {
    const baseUrl = client.getBaseUrl();
    const url = `${baseUrl}${AUDIO_ENDPOINTS.SPEECH}`;
    const token = client.getToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`TTS generation failed: ${res.status} ${res.statusText}`);
    }

    return res.blob();
  },

  /**
   * Transcribes audio into text using OpenAI-compatible STT.
   */
  transcriptions: async (formData: FormData): Promise<TranscriptionResponse> => {
    const baseUrl = client.getBaseUrl();
    const url = `${baseUrl}${AUDIO_ENDPOINTS.TRANSCRIPTIONS}`;
    const token = client.getToken();

    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!res.ok) {
      throw new Error(`Audio transcription failed: ${res.status} ${res.statusText}`);
    }

    return res.json();
  },

  /**
   * Audio execution engine (auto-orchestrates STT, TTS, translation, voice-cloning).
   */
  execute: async (payload: AudioExecuteRequest): Promise<AudioExecuteResponse> => {
    return client.post<AudioExecuteResponse>(AUDIO_ENDPOINTS.EXECUTE, payload);
  },
};

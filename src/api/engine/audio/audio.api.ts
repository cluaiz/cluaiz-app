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
   * Supports both pure JSON with Base64 Data URI and multipart FormData.
   */
  transcriptions: async (payload: { file: string; model?: string; language?: string } | FormData): Promise<TranscriptionResponse> => {
    const baseUrl = client.getBaseUrl();
    const url = `${baseUrl}${AUDIO_ENDPOINTS.TRANSCRIPTIONS}`;
    const token = client.getToken();

    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    }

    let body: BodyInit;
    if (payload instanceof FormData) {
      body = payload;
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(payload);
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Audio transcription failed: ${res.status} ${errText || res.statusText}`);
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

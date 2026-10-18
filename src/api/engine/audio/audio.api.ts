import { client } from '../../client';
import { AUDIO_ENDPOINTS } from './audio.endpoints';
import { base64ToBlob, sniffMimeType } from '../../../utils/mimeSniffer';
import type {
  SpeechRequest,
  TranscriptionResponse,
  TtsVoice,
} from './audio.types';

const authHeaders = (json: boolean): Record<string, string> => {
  const headers: Record<string, string> = json ? { 'Content-Type': 'application/json' } : {};
  const token = client.getToken();
  if (token) {
    headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  }
  return headers;
};

const dataUriToBlob = (audio: string): Blob => base64ToBlob(audio, sniffMimeType(audio, 'wav'));

export const audioApi = {
  /** Voices of a TTS model (the TTS slot's model when omitted); "default" first. */
  voices: async (model?: string): Promise<TtsVoice[]> => {
    const query = model ? `?model=${encodeURIComponent(model)}` : '';
    const res = await fetch(`${client.getBaseUrl()}${AUDIO_ENDPOINTS.VOICES}${query}`, { headers: authHeaders(false) });
    if (!res.ok) throw new Error(`Voice list failed: ${res.status} ${res.statusText}`);
    const body = await res.json();
    return Array.isArray(body?.data) ? body.data : [];
  },

  /**
   * Speech with stream: true. Each finished sentence reaches `onPart` as a playable WAV while the
   * rest is synthesized; resolves with the whole text's WAV.
   */
  speechStream: async (
    payload: SpeechRequest,
    onPart: (part: Blob) => void,
    signal?: AbortSignal
  ): Promise<Blob> => {
    const res = await fetch(`${client.getBaseUrl()}${AUDIO_ENDPOINTS.SPEECH}`, {
      method: 'POST',
      headers: { ...authHeaders(true), Accept: 'text/event-stream' },
      body: JSON.stringify({ ...payload, stream: true }),
      signal,
    });
    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => '');
      let message = errText || res.statusText;
      try { message = JSON.parse(errText)?.error?.message || message; } catch {}
      throw new Error(`TTS generation failed: ${res.status} ${message}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        let event: any;
        try { event = JSON.parse(trimmed.slice(5).trim()); } catch { continue; }
        if (event.type === 'speech.audio.delta' && typeof event.audio === 'string') {
          onPart(dataUriToBlob(event.audio));
        } else if (event.status === 'done') {
          const audio = event.result?.output?.audio_data;
          if (typeof audio === 'string' && audio) return dataUriToBlob(audio);
        } else if (event.status === 'error') {
          throw new Error(event.error?.message || 'TTS stream failed');
        }
      }
    }
    throw new Error('TTS stream ended without audio output');
  },

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

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text/event-stream')) {
      const text = await res.text();
      let audioBase64 = '';
      for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data:')) {
          try {
            const parsed = JSON.parse(trimmed.slice(5).trim());
            const audio = parsed.output?.audio_data || parsed.result?.output?.audio_data || parsed.audio_data;
            if (audio) audioBase64 = audio;
          } catch {}
        }
      }
      if (audioBase64) {
        return base64ToBlob(audioBase64, sniffMimeType(audioBase64, 'wav'));
      }
      throw new Error('TTS stream ended without audio output');
    }

    const isJson = contentType.includes('application/json');
    if (isJson) {
      const body = await res.json();
      if (!res.ok || body.error) {
        throw new Error(body.error?.message || `TTS generation failed: ${res.status} ${res.statusText}`);
      }
      const audio = body.output?.audio_data;
      if (typeof audio !== 'string' || !audio) {
        throw new Error('TTS response did not contain audio data');
      }
      return base64ToBlob(audio, sniffMimeType(audio, 'wav'));
    }
    if (!res.ok) {
      throw new Error(`TTS generation failed: ${res.status} ${res.statusText}`);
    }

    return res.blob();
  },

  /**
   * Transcribes audio into text using OpenAI-compatible STT.
   * Supports both pure JSON with Base64 Data URI and multipart FormData.
   */
  transcriptions: async (payload: { file: string; model?: string; language?: string; stream?: boolean } | FormData): Promise<TranscriptionResponse> => {
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
      body = JSON.stringify({ stream: false, ...payload });
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

    const raw = await res.json();
    const text = typeof raw?.text === 'string'
      ? raw.text
      : typeof raw?.output?.text === 'string'
        ? raw.output.text
        : '';

    return {
      text,
      segments: raw?.output?.segments || raw?.segments,
      ...raw,
    };
  },

  /**
   * Real-time SSE Streaming transcription via Cluaiz Engine (/v1/audio/transcriptions with stream: true).
   * Emits tokens as they are decoded in real-time by Whisper engine.
   */
  streamTranscriptions: async (
    payload: { file: string; model?: string; language?: string },
    callbacks: {
      onToken: (token: string) => void;
      onDone?: (fullText: string) => void;
      onError?: (err: Error) => void;
    },
    signal?: AbortSignal
  ): Promise<string> => {
    const baseUrl = client.getBaseUrl();
    const url = `${baseUrl}${AUDIO_ENDPOINTS.TRANSCRIPTIONS}`;
    const token = client.getToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    };
    if (token) {
      headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ stream: true, ...payload }),
      signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      const err = new Error(`Audio stream failed: ${res.status} ${errText || res.statusText}`);
      callbacks.onError?.(err);
      throw err;
    }

    if (!res.body) {
      const err = new Error('Transcription response body is null');
      callbacks.onError?.(err);
      throw err;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let accumulatedText = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;

          const dataStr = trimmed.slice(5).trim();
          if (dataStr === '[DONE]') {
            callbacks.onDone?.(accumulatedText);
            return accumulatedText;
          }

          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.status === 'chunk' && typeof parsed.token === 'string') {
              accumulatedText += parsed.token;
              callbacks.onToken(parsed.token);
            } else if (parsed.status === 'done') {
              const finalText = parsed.result?.output?.text || parsed.result?.text || accumulatedText;
              callbacks.onDone?.(finalText);
              return finalText;
            } else if (parsed.status === 'error') {
              const errMsg = parsed.error?.message || 'Engine audio streaming error';
              const err = new Error(errMsg);
              callbacks.onError?.(err);
              throw err;
            }
          } catch {
            if (dataStr && !dataStr.startsWith('{')) {
              accumulatedText += dataStr;
              callbacks.onToken(dataStr);
            }
          }
        }
      }
    } catch (readErr: any) {
      if (readErr?.name === 'AbortError') {
        callbacks.onDone?.(accumulatedText);
        return accumulatedText;
      }
      callbacks.onError?.(readErr);
      throw readErr;
    } finally {
      reader.releaseLock();
    }

    callbacks.onDone?.(accumulatedText);
    return accumulatedText;
  },
};

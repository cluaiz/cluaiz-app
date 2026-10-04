import { create } from 'zustand';
import { type Status, errorMessage } from '../../client';
import { audioApi } from './audio.api';
import type {
  SpeechRequest,
  AudioExecuteRequest,
  AudioOutput,
  TranscriptionResponse,
} from './audio.types';

export interface AudioState {
  isProcessing: boolean;
  lastAudioBlob: Blob | null;
  lastTranscription: TranscriptionResponse | null;
  lastOutput: AudioOutput | null;
  status: Status;
  error: string | null;

  // Actions
  generateSpeech: (req: SpeechRequest) => Promise<Blob | null>;
  transcribeAudio: (file: Blob | File, model?: string) => Promise<TranscriptionResponse | null>;
  executeAudio: (req: AudioExecuteRequest) => Promise<AudioOutput | null>;
  reset: () => void;
}

export const useAudioStore = create<AudioState>((set) => ({
  isProcessing: false,
  lastAudioBlob: null,
  lastTranscription: null,
  lastOutput: null,
  status: 'idle',
  error: null,

  generateSpeech: async (req) => {
    set({ isProcessing: true, status: 'pending', error: null });
    try {
      const blob = await audioApi.speech(req);
      set({ isProcessing: false, lastAudioBlob: blob, status: 'success', error: null });
      return blob;
    } catch (err) {
      const msg = errorMessage(err);
      set({ isProcessing: false, status: 'error', error: msg });
      return null;
    }
  },

  transcribeAudio: async (file, model) => {
    set({ isProcessing: true, status: 'pending', error: null });
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (model) formData.append('model', model);

      const res = await audioApi.transcriptions(formData);
      set({ isProcessing: false, lastTranscription: res, status: 'success', error: null });
      return res;
    } catch (err) {
      const msg = errorMessage(err);
      set({ isProcessing: false, status: 'error', error: msg });
      return null;
    }
  },

  executeAudio: async (req) => {
    set({ isProcessing: true, status: 'pending', error: null });
    try {
      const res = await audioApi.execute(req);
      set({ isProcessing: false, lastOutput: res.output, status: 'success', error: null });
      return res.output;
    } catch (err) {
      const msg = errorMessage(err);
      set({ isProcessing: false, status: 'error', error: msg });
      return null;
    }
  },

  reset: () => {
    set({
      isProcessing: false,
      lastAudioBlob: null,
      lastTranscription: null,
      lastOutput: null,
      status: 'idle',
      error: null,
    });
  },
}));

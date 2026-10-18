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
  transcribeAudio: (file: Blob | File | string, model?: string) => Promise<TranscriptionResponse | null>;
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
      let fileData: string;
      if (typeof file === 'string') {
        fileData = file;
      } else {
        fileData = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      const res = await audioApi.transcriptions({ file: fileData, model });
      set({ isProcessing: false, lastTranscription: res, status: 'success', error: null });
      return res;
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

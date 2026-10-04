export interface InputSource {
  type: 'url' | 'base64' | 'text' | string;
  data: string;
}

export interface AudioParameters {
  temperature?: number;
  language?: string;
  speed?: number;
  voice_id?: string;
  translate_to?: string;
  timestamps?: boolean;
  beam_size?: number;
  vad_filter?: boolean;
  speaker_labels?: boolean;
}

export interface AudioExecuteRequest {
  model?: string;
  task?: 'auto' | 'speech_to_text' | 'text_to_speech' | string;
  instruction?: string;
  input_source: InputSource;
  parameters?: AudioParameters;
  stream?: boolean;
  keep_alive?: number;
}

export interface AudioSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

export interface AudioOutput {
  text?: string;
  audio_data?: string; // Base64 encoded audio
  segments?: AudioSegment[];
}

export interface AudioExecuteResponse {
  task: string;
  model: string;
  output: AudioOutput;
  metrics?: Record<string, any>;
}

export interface SpeechRequest {
  model?: string;
  input: string;
  voice?: string;
  response_format?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';
  speed?: number;
}

export interface TranscriptionRequest {
  file: Blob | File;
  model?: string;
  language?: string;
  prompt?: string;
  response_format?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
  temperature?: number;
}

export interface TranscriptionResponse {
  text: string;
  language?: string;
  duration?: number;
  segments?: AudioSegment[];
}

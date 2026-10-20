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

/** One voice of a TTS model (GET /v1/audio/voices); "default" lets the engine pick by language */
export interface TtsVoice {
  id: string;
  language: string | null;
  default: boolean;
}

export interface TtsCapabilities {
  languages: string[];
  language_control: 'explicit' | 'auto';
  voice_mode: 'preset' | 'embedded' | 'reference_source' | 'reference_profile';
  coherent_input: boolean;
}

export interface TtsVoiceCatalog {
  model?: string;
  data: TtsVoice[];
  capabilities: TtsCapabilities;
}

export interface SpeechRequest {
  model?: string;
  input: string;
  voice?: string;
  language?: string;
  response_format?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';
  speed?: number;
  stream?: boolean;
  keep_alive?: number;
}

export interface TranscriptionRequest {
  file: Blob | File;
  model?: string;
  language?: string;
  /** The speaker's languages: speech is identified among only these */
  languages?: string[];
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

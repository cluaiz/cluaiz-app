/** The Engine's numeric sampling fields a chat may set (read in the Engine's `api/src/handlers/chat/types.rs`) */
export const SAMPLING_KEYS = ['temperature', 'top_p', 'top_k', 'min_p', 'repetition_penalty', 'presence_penalty',
    'frequency_penalty', 'max_tokens', 'seed'] as const;
export type SamplingKey = typeof SAMPLING_KEYS[number];

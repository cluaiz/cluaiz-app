/** Engine setting `chat_memory`: each chat's KV cache saved to disk so it resumes without reprocessing. */
export interface ChatMemorySettings {
  enabled: boolean;
  /** Disk the saved chats may use; least recently used ones are deleted first */
  max_disk_gb: number;
  /** Saved chats unused for this many days are deleted (0 = only the disk limit) */
  max_age_days: number;
}

/** One chat saved by the engine. */
export interface ChatMemoryRecord {
  chat_id: string;
  model: string;
  key: string;
  tokens: number;
  positions: number;
  bytes: number;
  /** Unix seconds */
  saved_at: number;
  last_used: number;
}

export interface ChatMemoryStatus {
  settings: ChatMemorySettings;
  directory: string;
  bytes: number;
  chats: ChatMemoryRecord[];
}

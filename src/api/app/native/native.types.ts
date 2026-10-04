export interface NativeEngineSettings {
  host?: string;
  port?: number;
  [key: string]: any;
}

export interface NativeSessionInfo {
  token: string | null;
  isValid: boolean;
}

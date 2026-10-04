export type ConnectionProtocol = 'ffi' | 'http';

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  params?: Record<string, string | number | boolean | undefined>;
  timeoutMs?: number;
  skipAuth?: boolean;
}

export type AuthTokenSyncHandler = () => Promise<string | null>;

export interface IApiClient {
  get<T = unknown>(path: string, options?: RequestOptions): Promise<T>;
  post<T = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  put<T = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  del<T = unknown>(path: string, options?: RequestOptions): Promise<T>;
  delete<T = unknown>(path: string, options?: RequestOptions & { body?: unknown }): Promise<T>;
  request<T = unknown>(path: string, options?: RequestOptions & { method?: string; body?: unknown }): Promise<T>;
  getToken(): string | null;
  setToken(token: string | null): void;
  getBaseUrl(): string;
  getHeaders(customHeaders?: Record<string, string>): Record<string, string>;
  setAuthTokenSyncHandler(handler: AuthTokenSyncHandler | null): void;
  getProtocol(): ConnectionProtocol;
}

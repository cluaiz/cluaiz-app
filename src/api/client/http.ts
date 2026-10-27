import { ApiError } from './errors';
import { engineFetch } from './transport';
import { useConnectionStore } from '../../store/engine/useConnectionStore';
import type { RequestOptions, AuthTokenSyncHandler } from './types';
export type { RequestOptions, AuthTokenSyncHandler };
type StopCause = 'connection' | 'cancelled' | 'timeout';
interface AuthSynchronization { connection: number; credential: number; handler: number; task: Promise<string | null>; }

/**
 * HTTP Transport Client
 * 
 * Strict Architecture Laws:
 * 1. ZERO hardcoded URLs or endpoint strings.
 * 2. Dynamic BaseURL resolution from connection settings.
 * 3. Dynamic Bearer token injection.
 * 4. Pluggable 401 token sync handler (injected by Auth/Permission domain).
 */
class HttpClient {
  private cachedToken: string | null = null;
  private authTokenSyncHandler: AuthTokenSyncHandler | null = null;
  private connectionVersion = 0;
  private credentialVersion = 0;
  private handlerVersion = 0;
  private authSynchronization: AuthSynchronization | null = null;
  private readonly observations = new Set<(cause: StopCause) => void>();
  private readonly defaultTimeoutMs = 10000;

  constructor() {
    useConnectionStore.subscribe((current, previous) => {
      if (current.protocol !== previous.protocol || current.host !== previous.host || current.port !== previous.port) {
        ++this.connectionVersion;
        for (const stop of this.observations) stop('connection');
      }
    });
  }

  /**
   * Registers a domain-level token synchronization callback for 401 retries
   */
  public setAuthTokenSyncHandler(handler: AuthTokenSyncHandler | null): void {
    ++this.handlerVersion;
    this.authTokenSyncHandler = handler;
  }

  private synchronizeAuth(handler: AuthTokenSyncHandler): Promise<string | null> {
    const current = this.authSynchronization;
    if (current && current.connection === this.connectionVersion && current.credential === this.credentialVersion
      && current.handler === this.handlerVersion) return current.task;
    const synchronization = { connection: this.connectionVersion, credential: this.credentialVersion,
      handler: this.handlerVersion, task: Promise.resolve().then(() => handler()) };
    this.authSynchronization = synchronization;
    const finish = () => { if (this.authSynchronization === synchronization) this.authSynchronization = null; };
    void synchronization.task.then(finish, finish);
    return synchronization.task;
  }

  /**
   * Retrieves the stored or in-memory Bearer token
   */
  public getToken(): string | null {
    if (this.cachedToken) return this.cachedToken;
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('cluaiz_api_token');
        if (stored && stored.trim()) {
          this.cachedToken = stored.trim();
          return this.cachedToken;
        }
      } catch {
        // Safe fallback in restricted environments
      }
    }
    return null;
  }

  /**
   * Sets or clears the active token in memory & storage
   */
  public setToken(token: string | null): void {
    ++this.credentialVersion;
    this.cachedToken = token ? token.trim() : null;
    if (typeof window !== 'undefined') {
      try {
        if (this.cachedToken) {
          localStorage.setItem('cluaiz_api_token', this.cachedToken);
        } else {
          localStorage.removeItem('cluaiz_api_token');
        }
      } catch {
        // Ignore storage errors
      }
    }
  }

  /**
   * Resolves the active base URL dynamically from connection configuration
   */
  public getBaseUrl(): string {
    return useConnectionStore.getState().getBaseUrl();
  }

  /**
   * Builds standardized request headers with Content-Type and Authorization Bearer token
   */
  public getHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...customHeaders,
    };
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    }
    return headers;
  }

  /**
   * Core request dispatcher with timeout, token injection, and pluggable 401 retry
   */
  public async request<T = unknown>(
    path: string,
    options: RequestOptions & { method?: string; body?: unknown } = {}
  ): Promise<T> {
    const version = this.connectionVersion;
    const baseUrl = this.getBaseUrl();
    let url = /^https?:\/\//.test(path) ? path : baseUrl + (path.startsWith('/') ? path : '/' + path);
    if (options.params) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(options.params)) if (value !== undefined) params.append(key, String(value));
      if (params.size) url += (url.includes('?') ? '&' : '?') + params.toString();
    }
    // Capture the payload/headers once. A 401 retry must not reserialize a mutated caller object.
    const { body: payload, params: _params, timeoutMs: _timeout, skipAuth, signal: caller, ...requestOptions } = options;
    const body = payload === undefined ? undefined : JSON.stringify(payload);
    const headers = { 'Content-Type': 'application/json', ...((options.headers as Record<string, string>) || {}) };
    const timeout = options.timeoutMs ?? this.defaultTimeoutMs;
    if (!Number.isFinite(timeout) || timeout < 0) throw new ApiError('Use a nonnegative request timeout', 400, 'INVALID_TIMEOUT', url);
    const controller = new AbortController();
    let cause: StopCause | undefined;
    let openResponse: Response | undefined;
    let rejectStopped: (error: ApiError) => void = () => {};
    const stopped = new Promise<never>((_, reject) => { rejectStopped = reject; });
    void stopped.catch(() => {});
    const failure = () => cause === 'connection'
      ? new ApiError('Engine connection changed; request observation ended', 409, 'STALE_CONNECTION', url)
      : cause === 'timeout'
        ? new ApiError('Request timed out after ' + timeout + 'ms: ' + url, 0, 'TIMEOUT', url)
        : new ApiError('Engine request cancelled', 0, 'CANCELLED', url);
    const stop = (reason: StopCause) => {
      if (cause) return;
      cause = reason;
      controller.abort();
      rejectStopped(failure());
    };
    const guard = () => {
      if (version !== this.connectionVersion && !cause) stop('connection');
      if (cause) throw failure();
    };
    const wait = async <R,>(task: Promise<R>): Promise<R> => {
      try { const value = await Promise.race([task, stopped]); guard(); return value; }
      catch (error) { guard(); throw error; }
    };
    const discard = (value: Response | undefined) => {
      if (value?.body && !value.bodyUsed) void value.body.cancel().catch(() => {});
    };
    const onAbort = () => stop('cancelled');
    this.observations.add(stop);
    caller?.addEventListener('abort', onAbort, { once: true });
    if (caller?.aborted) stop('cancelled');
    const timer = timeout > 0 ? setTimeout(() => stop('timeout'), timeout) : undefined;
    try {
      // Only one retry, and only after an actual 401. No replay on network/5xx/unknown outcomes.
      for (let attempt = 0; attempt < 2; ++attempt) {
        guard();
        const credential = this.credentialVersion;
        const attemptHeaders: Record<string, string> = { ...headers };
        const token = skipAuth ? null : this.getToken();
        if (token) attemptHeaders.Authorization = token.startsWith('Bearer ') ? token : 'Bearer ' + token;
        let response: Response;
        try {
          response = await wait(engineFetch(url, { ...requestOptions, headers: attemptHeaders,
            signal: controller.signal, body }).then(value => {
              if (cause || version !== this.connectionVersion) { discard(value); guard(); }
              return value;
            }));
          openResponse = response;
        } catch (error) {
          guard();
          throw new ApiError('Engine connection failed (' + url + '): ' + ((error as Error)?.message || String(error)),
            0, (error as Error)?.name === 'AbortError' ? 'CANCELLED' : 'OFFLINE', url);
        }

        if (!response.ok) {
          let message = 'HTTP Error ' + response.status + ': ' + response.statusText;
          let details: unknown;
          try {
            details = await wait(response.json());
            const data = details as { message?: string; error?: unknown } | null;
            if (data?.message) message = data.message;
            else if (data?.error) message = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
          } catch { guard(); /* Empty/non-JSON errors retain their actual HTTP status. */ }
          const denied = new ApiError(message, response.status, response.statusText, url, details);
          if (response.status === 401 && attempt === 0 && !skipAuth) {
            // A manually replaced key wins over a delayed refresh for this same connection.
            if (credential !== this.credentialVersion) {
              if (this.getToken()) continue;
            } else if (this.authTokenSyncHandler) {
              const handler = this.handlerVersion;
              const refreshed = await wait(this.synchronizeAuth(this.authTokenSyncHandler));
              guard();
              if (handler === this.handlerVersion && credential === this.credentialVersion && refreshed?.trim()) {
                this.setToken(refreshed);
              }
              if ((credential !== this.credentialVersion || (handler === this.handlerVersion && refreshed?.trim())) && this.getToken()) continue;
            }
          }
          throw denied;
        }
        if (response.status === 204) return undefined as T;
        const contentType = response.headers.get('content-type') || '';
        return await wait(contentType.includes('application/json') ? response.json() as Promise<T> : response.text() as Promise<T>);
      }
      throw new ApiError('Engine authentication retry ended', 401, 'UNAUTHORIZED', url);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      caller?.removeEventListener('abort', onAbort);
      this.observations.delete(stop);
      discard(openResponse);
    }
  }

  public get<T = unknown>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  public post<T = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'POST', body });
  }

  public put<T = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'PUT', body });
  }

  public del<T = unknown>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }

  public delete<T = unknown>(path: string, options?: RequestOptions & { body?: unknown }): Promise<T> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }
}

export const http = new HttpClient();

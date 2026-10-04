import { ApiError } from './errors';
import { useConnectionStore } from '../../store/engine/useConnectionStore';
import type { RequestOptions, AuthTokenSyncHandler } from './types';
export type { RequestOptions, AuthTokenSyncHandler };

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
  private isSyncingToken = false;
  private readonly defaultTimeoutMs = 10000;

  /**
   * Registers a domain-level token synchronization callback for 401 retries
   */
  public setAuthTokenSyncHandler(handler: AuthTokenSyncHandler | null): void {
    this.authTokenSyncHandler = handler;
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
    options: RequestOptions & { method?: string; body?: unknown } = {},
    retryCount = 0
  ): Promise<T> {
    const baseUrl = this.getBaseUrl();
    let url = path.startsWith('http://') || path.startsWith('https://')
      ? path
      : `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

    // Append query parameters if provided
    if (options.params) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      }
      const qs = searchParams.toString();
      if (qs) {
        url += (url.includes('?') ? '&' : '?') + qs;
      }
    }

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (!options.skipAuth) {
      const token = this.getToken();
      if (token) {
        headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
      }
    }

    // Abort timeout setup
    const timeout = options.timeoutMs ?? this.defaultTimeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
        signal: options.signal || controller.signal,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });
    } catch (netErr: unknown) {
      clearTimeout(timer);
      const isAbort = (netErr as Error)?.name === 'AbortError';
      const msg = isAbort
        ? `Request timed out after ${timeout}ms: ${url}`
        : `Engine connection failed (${url}): ${(netErr as Error)?.message || String(netErr)}`;
      throw new ApiError(msg, 0, isAbort ? 'TIMEOUT' : 'OFFLINE', url);
    } finally {
      clearTimeout(timer);
    }

    // Handle 401 via pluggable domain handler (ZERO hardcoded endpoints)
    if (
      response.status === 401 &&
      retryCount === 0 &&
      !options.skipAuth &&
      this.authTokenSyncHandler &&
      !this.isSyncingToken
    ) {
      this.isSyncingToken = true;
      try {
        const refreshedToken = await this.authTokenSyncHandler();
        if (refreshedToken) {
          this.setToken(refreshedToken);
          return this.request<T>(path, options, retryCount + 1);
        }
      } finally {
        this.isSyncingToken = false;
      }
    }

    // Handle non-2xx responses
    if (!response.ok) {
      let errorMsg = `HTTP Error ${response.status}: ${response.statusText}`;
      let errorDetails: unknown = undefined;
      try {
        const errorJson = await response.json();
        errorDetails = errorJson;
        if (errorJson?.message) errorMsg = errorJson.message;
        else if (errorJson?.error) {
          errorMsg = typeof errorJson.error === 'string' ? errorJson.error : JSON.stringify(errorJson.error);
        }
      } catch {
        // Fallback to statusText if not JSON
      }
      throw new ApiError(errorMsg, response.status, response.statusText, url, errorDetails);
    }

    // Handle empty 204 No Content
    if (response.status === 204) {
      return undefined as unknown as T;
    }

    // Parse JSON or raw text
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return (await response.json()) as T;
    }
    return (await response.text()) as unknown as T;
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

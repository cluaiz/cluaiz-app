import { http } from './http';
import { useConnectionStore, ConnectionProtocol } from '../../store/engine/useConnectionStore';
import type { IApiClient, RequestOptions, AuthTokenSyncHandler } from './types';

 
export class ApiClient implements IApiClient {
  public getProtocol(): ConnectionProtocol {
    return useConnectionStore.getState().protocol;
  }

  public getToken(): string | null {
    return http.getToken();
  }

  public setToken(token: string | null): void {
    http.setToken(token);
  }

  public getBaseUrl(): string {
    return http.getBaseUrl();
  }

  public getHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
    return http.getHeaders(customHeaders);
  }

  public setAuthTokenSyncHandler(handler: AuthTokenSyncHandler | null): void {
    http.setAuthTokenSyncHandler(handler);
  }

  /**
   * Request dispatcher. Pure generic transport with zero hardcoded URLs.
   */
  public async request<T = unknown>(
    path: string,
    options: RequestOptions & { method?: string; body?: unknown } = {}
  ): Promise<T> {
    return http.request<T>(path, options);
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

export const client = new ApiClient();

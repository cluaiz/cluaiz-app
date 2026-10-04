import { ApiError } from './errors';
import { http } from './http';

export interface SseOptions {
  onToken?: (token: string) => void;
  onReasoning?: (reasoning: string) => void;
  onEvent?: (rawEvent: unknown) => void;
  onDone?: () => void;
  onError?: (error: ApiError) => void;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export interface SseChunkDelta {
  content?: string;
  reasoning_content?: string;
  role?: string;
}

export interface SseChoice {
  index: number;
  delta: SseChunkDelta;
  finish_reason: string | null;
}

export interface SseCompletionChunk {
  id?: string;
  choices?: SseChoice[];
  created?: number;
  model?: string;
  [key: string]: unknown;
}

/**
 * Robust SSE Stream Reader for Cluaiz Engine completions
 */
export async function streamSse(
  path: string,
  body: unknown,
  options: SseOptions = {}
): Promise<void> {
  const baseUrl = http.getBaseUrl();
  const url = path.startsWith('http://') || path.startsWith('https://')
    ? path
    : `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream',
    ...(options.headers || {}),
  };

  const token = http.getToken();
  if (token) {
    headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: options.signal,
    });
  } catch (err: unknown) {
    const isAbort = (err as Error)?.name === 'AbortError';
    const apiErr = new ApiError(
      isAbort ? 'Chat stream cancelled by user' : `Failed to connect to stream: ${(err as Error)?.message || String(err)}`,
      0,
      isAbort ? 'CANCELLED' : 'OFFLINE',
      url
    );
    options.onError?.(apiErr);
    throw apiErr;
  }

  if (!response.ok) {
    let errorMsg = `Stream failed with status ${response.status}: ${response.statusText}`;
    try {
      const errJson = await response.json();
      if (errJson?.message) errorMsg = errJson.message;
      else if (errJson?.error) errorMsg = typeof errJson.error === 'string' ? errJson.error : JSON.stringify(errJson.error);
    } catch {
      // Non-JSON response
    }
    const apiErr = new ApiError(errorMsg, response.status, response.statusText, url);
    options.onError?.(apiErr);
    throw apiErr;
  }

  if (!response.body) {
    const apiErr = new ApiError('Response body is null', response.status, 'EMPTY_BODY', url);
    options.onError?.(apiErr);
    throw apiErr;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete trailing fragment in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;

        const dataStr = trimmed.slice(5).trim();
        if (dataStr === '[DONE]') {
          options.onDone?.();
          return;
        }

        try {
          const parsed = JSON.parse(dataStr) as SseCompletionChunk;
          options.onEvent?.(parsed);

          const delta = parsed.choices?.[0]?.delta;
          if (delta) {
            if (delta.reasoning_content && options.onReasoning) {
              options.onReasoning(delta.reasoning_content);
            }
            if (delta.content && options.onToken) {
              options.onToken(delta.content);
            }
          }
        } catch {
          // If raw text chunk rather than JSON
          if (options.onToken) {
            options.onToken(dataStr);
          }
        }
      }
    }
  } catch (readErr: unknown) {
    if ((readErr as Error)?.name === 'AbortError') {
      options.onDone?.();
      return;
    }
    const apiErr = new ApiError(
      `Stream read error: ${(readErr as Error)?.message || String(readErr)}`,
      0,
      'STREAM_ERROR',
      url
    );
    options.onError?.(apiErr);
    throw apiErr;
  } finally {
    reader.releaseLock();
    options.onDone?.();
  }
}

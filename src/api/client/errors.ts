/**
 * Standardized API Error for Cluaiz Engine & App Network Layers
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly statusText: string;
  public readonly endpoint: string;
  public readonly details?: unknown;

  constructor(
    message: string,
    status: number = 0,
    statusText: string = 'UNKNOWN_ERROR',
    endpoint: string = '',
    details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.endpoint = endpoint;
    this.details = details;

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  public isOffline(): boolean {
    return this.status === 0 || this.statusText === 'OFFLINE' || this.message.includes('offline');
  }

  public isUnauthorized(): boolean {
    return this.status === 401;
  }

  public isNotFound(): boolean {
    return this.status === 404;
  }
}

/**
 * Extracts a human-friendly error string from any thrown exception.
 */
export function errorMessage(error: unknown): string {
  if (!error) return 'An unknown error occurred';
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

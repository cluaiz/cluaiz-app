/** Retry only admission refusals, before a speech response has emitted any audio. */
const MAX_BUSY_RETRIES = 4;

function waitForAdmission(milliseconds: number, signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted();
    return new Promise((resolve, reject) => {
        const aborted = () => {
            clearTimeout(timer);
            signal?.removeEventListener('abort', aborted);
            reject(signal?.reason);
        };
        const timer = setTimeout(() => {
            signal?.removeEventListener('abort', aborted);
            resolve();
        }, milliseconds);
        signal?.addEventListener('abort', aborted, { once: true });
    });
}

export async function requestSpeech(url: string, options: RequestInit): Promise<Response> {
    const signal = options.signal || undefined;
    for (let attempt = 0; ; attempt++) {
        signal?.throwIfAborted();
        const response = await fetch(url, options);
        if (response.status !== 429 || attempt === MAX_BUSY_RETRIES) return response;
        const error = await response.clone().json().catch(() => null);
        if (error?.error?.type !== 'speech_busy') return response;
        const seconds = Number(response.headers.get('Retry-After') ?? NaN);
        const delay = Number.isFinite(seconds) && seconds >= 0
            ? Math.min(seconds * 1000, 5000) : 250 * 2 ** attempt;
        await response.body?.cancel();
        await waitForAdmission(delay, signal);
    }
}

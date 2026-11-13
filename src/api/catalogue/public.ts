/** Public metadata is never sent through the authenticated Engine client. */
const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_REFRESH_MS = 60 * 1000;
const MAX_BYTES = 16 * 1024 * 1024;
const SOURCES = ['cluaiz.com', 'raw.githubusercontent.com', 'models.dev'];
declare const __CLUAIZ_MODEL_REGISTRY_ORIGIN__: string;
/** Vite supplies a loopback override only during explicitly configured local development. */
export const MODEL_REGISTRY_ORIGIN = typeof __CLUAIZ_MODEL_REGISTRY_ORIGIN__ === 'string'
  ? __CLUAIZ_MODEL_REGISTRY_ORIGIN__ : 'https://cluaiz.com';
const MODELS_PATH = '/api/v1/registry/models';
/** The only source read with a query (family and model) */
const README_SOURCE = `${MODEL_REGISTRY_ORIGIN}${MODELS_PATH}/readme`;
const TIMEOUT_MS = 15000;
const PREFIX = 'cluaiz_public_catalogue_v1:';
const MAX_CACHE_CHARS = 8 * 1024 * 1024;
const MAX_ENTRIES = 64;
interface Entry { data?: unknown; saved: number; retryAt: number; }
export interface CatalogueReply<T> { data: T; saved: number; warning?: string; }
const entries = new Map<string, Entry>();
const weights = new Map<string, number>();
const pending = new Map<string, Promise<Entry>>();

function storage(key: string): Entry {
  if (entries.has(key)) return entries.get(key)!;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw && raw.length <= MAX_BYTES) {
      const value = JSON.parse(raw);
      if (value && Number.isFinite(value.saved) && value.saved <= Date.now()
        && Number.isFinite(value.retryAt) && value.retryAt <= Date.now() + DAY_MS) {
        remember(key, value, raw.length); return value;
      }
    }
  } catch { /* Restricted storage still allows in-memory caching. */ }
  return { saved: 0, retryAt: 0 };
}
function remember(key: string, value: Entry, size: number) {
  entries.delete(key); weights.delete(key);
  while (entries.size && (entries.size >= MAX_ENTRIES || [...weights.values()].reduce((sum, n) => sum + n, 0) + size > MAX_CACHE_CHARS)) {
    const oldest = entries.keys().next().value!;
    entries.delete(oldest); weights.delete(oldest);
  }
  entries.set(key, value);
  weights.set(key, size);
}
function save(key: string, value: Entry) {
  const encoded = JSON.stringify(value);
  remember(key, value, encoded.length);
  try { localStorage.setItem(PREFIX + key, encoded); } catch { /* Quota does not hide a real response. */ }
}
async function readJson(response: Response) {
  const size = response.headers.get('content-length');
  if (size && Number(size) > MAX_BYTES) throw new Error('Catalogue response is too large');
  if (!response.body) throw new Error('Catalogue response has no body');
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let bytes = 0, text = '';
  try {
    for (;;) {
      const part = await reader.read(); if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > MAX_BYTES) throw new Error('Catalogue response is too large');
      text += decoder.decode(part.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode()) as unknown;
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

/**
 * One shared, bounded read; search/filter/render never initiate their own requests.
 * `keep` reduces a large response to the part the App uses before it is saved.
 */
export async function readPublicCatalogue<T>(url: string, parse: (value: unknown) => T, refresh = false,
  keep: (value: unknown) => unknown = value => value): Promise<CatalogueReply<T>> {
  const target = new URL(url);
  const modelSource = target.origin === MODEL_REGISTRY_ORIGIN && [MODELS_PATH, `${MODELS_PATH}/readme`].includes(target.pathname);
  const localModelSource = modelSource && ['http:', 'https:'].includes(target.protocol) && ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname);
  const officialSource = target.protocol === 'https:' && SOURCES.includes(target.hostname) && !target.port;
  if ((!officialSource && !localModelSource) || target.username || target.password || target.hash
    || (target.search && target.href.split('?')[0] !== README_SOURCE)) throw new Error('Unsupported catalogue source');
  const key = target.href, previous = storage(key), now = Date.now();
  let cached: T | undefined;
  try { if (previous.data !== undefined) cached = parse(previous.data); }
  catch { delete previous.data; previous.saved = 0; save(key, previous); }
  if (!refresh && cached !== undefined && now - previous.saved < (modelSource ? MIN_REFRESH_MS : DAY_MS)) return { data: cached, saved: previous.saved };
  if (now < previous.retryAt && !pending.has(key)) {
    const data = cached;
    if (data !== undefined) return { data, saved: previous.saved, warning: 'Using saved catalogue; refresh is temporarily limited.' };
    throw new Error('Catalogue refresh is temporarily limited. Try again later.');
  }
  let task = pending.get(key);
  if (!task) {
    save(key, { ...previous, retryAt: now + MIN_REFRESH_MS });
    task = (async () => {
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const response = await fetch(key, { credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', signal: controller.signal });
        if (!response.ok) {
          if (response.status === 429) {
            const raw = response.headers.get('retry-after') || '';
            const seconds = Number(raw), date = Date.parse(raw);
            const wait = /^\d+$/.test(raw) ? seconds * 1000 : Number.isFinite(date) ? date - Date.now() : MIN_REFRESH_MS;
            save(key, { ...previous, retryAt: Date.now() + Math.min(DAY_MS, Math.max(MIN_REFRESH_MS, wait)) });
          }
          await response.body?.cancel();
          throw new Error(`Catalogue unavailable (HTTP ${response.status}).`);
        }
        const data = keep(await readJson(response)); parse(data);
        const value = { data, saved: Date.now(), retryAt: Date.now() + MIN_REFRESH_MS };
        save(key, value); return value;
      } finally { clearTimeout(timer); }
    })();
    pending.set(key, task);
    void task.then(() => pending.delete(key), () => pending.delete(key));
  }
  try { const result = await task; return { data: parse(result.data), saved: result.saved }; }
  catch (error) {
    const data = cached; if (data === undefined) throw error;
    return { data, saved: previous.saved, warning: `${String(error)} Showing the last saved catalogue.` };
  }
}

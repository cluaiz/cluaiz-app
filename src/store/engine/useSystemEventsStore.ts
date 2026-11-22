import { create } from 'zustand';
import { CepError } from '../../api/client/cep';
import { readSystemEvents, type SystemEventRecord } from '../../api/engine/system/events';

export interface ActiveEngineLoad {
  model: string;
  status: 'loading' | 'loaded' | 'failed';
  message: string;
  percent?: number;
  attempt?: number;
  placement?: string;
  ms?: number;
}

interface SystemEventsState {
  activeLoad: ActiveEngineLoad | null;
  lastSeq: number;
  running: boolean;
  dismissLoad: () => void;
  applyEvents: (events: SystemEventRecord[]) => void;
  startWatching: () => () => void;
}

/** Events read on the first look for a load already running (a load sends about 110) */
const RECENT_EVENTS = 50;

const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v : undefined);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

export function reduceLoadEvent(prev: ActiveEngineLoad | null, event: SystemEventRecord): ActiveEngineLoad | null {
  const d = event.data;
  const model = text(d.model);
  if (!model) return prev;
  const message = text(d.message) ?? event.name;
  const attempt = num(d.attempt);
  const placement = text(d.placement);

  switch (event.name) {
    case 'model.load_started':
      return { model, status: 'loading', message, attempt: attempt ?? 1, placement };
    case 'model.load_step': {
      const percent = d.step === 'weights' ? num(d.percent) : undefined;
      return {
        model,
        status: 'loading',
        message,
        percent: percent ?? (d.step === 'weights' ? prev?.percent : undefined),
        attempt: attempt ?? prev?.attempt,
        placement: placement ?? prev?.placement,
      };
    }
    case 'model.load_retry':
      return { model, status: 'loading', message, attempt, placement };
    case 'model.loaded':
      return {
        model,
        status: 'loaded',
        message,
        percent: 100,
        attempt: attempt ?? prev?.attempt,
        placement: placement ?? prev?.placement,
        ms: num(d.ms),
      };
    case 'model.load_failed':
    case 'model.load_refused':
      return { model, status: 'failed', message, attempt: attempt ?? prev?.attempt, placement: placement ?? prev?.placement, ms: num(d.ms) };
    case 'model.unloaded':
      return prev?.model === model ? null : prev;
    default:
      return prev;
  }
}

export const useSystemEventsStore = create<SystemEventsState>((set, get) => {
  let activeController: AbortController | null = null;
  let clearTimer: ReturnType<typeof setTimeout> | null = null;

  const scheduleClear = () => {
    if (clearTimer) clearTimeout(clearTimer);
    clearTimer = setTimeout(() => {
      clearTimer = null;
      set(state => (state.activeLoad?.status === 'loaded' ? { activeLoad: null } : state));
    }, 4500);
  };

  return {
    activeLoad: null,
    lastSeq: 0,
    running: false,

    dismissLoad: () => {
      if (clearTimer) { clearTimeout(clearTimer); clearTimer = null; }
      set({ activeLoad: null });
    },

    applyEvents: (events: SystemEventRecord[]) => {
      if (!events.length) return;
      let nextLoad = get().activeLoad;
      let nextSeq = get().lastSeq;
      for (const event of events) {
        if (event.seq > nextSeq) nextSeq = event.seq;
        if (event.name.startsWith('model.load') || event.name === 'model.loaded' || event.name === 'model.unloaded') {
          nextLoad = reduceLoadEvent(nextLoad, event);
        }
      }
      if (nextLoad?.status === 'loading' && clearTimer) {
        clearTimeout(clearTimer);
        clearTimer = null;
      } else if (nextLoad?.status === 'loaded') {
        scheduleClear();
      }
      set({ activeLoad: nextLoad, lastSeq: nextSeq });
    },

    startWatching: () => {
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;
      set({ running: true });

      void (async () => {
        let cursor = 0;
        let initialized = false;
        let backoffMs = 1000;
        while (!controller.signal.aborted) {
          try {
            // Pages come oldest first: the first look reads the newest events, not the oldest ones held
            const newest = initialized ? 0 : (await readSystemEvents({ limit: 1 }, controller.signal)).latest_seq;
            const page = await readSystemEvents(
              initialized
                ? { after: cursor, limit: RECENT_EVENTS, wait_ms: 15_000 }
                : { after: Math.max(0, newest - RECENT_EVENTS), limit: RECENT_EVENTS },
              controller.signal,
            );
            if (controller.signal.aborted) break;
            backoffMs = 1000;
            // An Engine that restarted counts its events from 1 again: look again from the start
            if (initialized && page.latest_seq < cursor) {
              initialized = false;
              continue;
            }
            if (!initialized) {
              initialized = true;
              cursor = page.latest_seq;
              // Only surface a load that is currently in-flight from recent history
              let inflight: ActiveEngineLoad | null = null;
              for (const event of page.events) {
                if (event.name.startsWith('model.load') || event.name === 'model.loaded' || event.name === 'model.unloaded') {
                  inflight = reduceLoadEvent(inflight, event);
                }
              }
              set({ activeLoad: inflight?.status === 'loading' ? inflight : null, lastSeq: page.latest_seq });
            } else if (page.events.length > 0) {
              cursor = page.next;
              get().applyEvents(page.events);
            } else {
              cursor = Math.max(cursor, page.latest_seq);
            }
          } catch (error) {
            if (controller.signal.aborted) break;
            if (error instanceof CepError && error.code === -32601) break;
            await new Promise(resolve => setTimeout(resolve, backoffMs));
            backoffMs = Math.min(10_000, backoffMs * 2);
          }
        }
        if (activeController === controller) {
          activeController = null;
          set({ running: false });
        }
      })();

      return () => {
        if (activeController === controller) {
          activeController = null;
          set({ running: false });
        }
        controller.abort();
        if (clearTimer) { clearTimeout(clearTimer); clearTimer = null; }
      };
    },
  };
});

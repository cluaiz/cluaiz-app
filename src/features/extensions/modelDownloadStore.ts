import { create } from 'zustand';
import type { TaskView } from '../../api/client/cepTask';

/** The model download the Engine is running (its `<owner>/<repo>:<quant>` reference) and how far it is. */
export interface ModelDownload { target: string; percent?: number }

/** Paused downloads of one Engine: reference → percent when paused (null when the Engine gave no total) */
export type PausedDownloads = Record<string, number | null>;
const PAUSED_KEY = 'cluaiz_paused_downloads:';

function readPaused(scope: string): PausedDownloads {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(PAUSED_KEY + scope) ?? '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([, percent]) => percent === null || Number.isFinite(percent))) as PausedDownloads;
  } catch { return {}; }
}

interface DownloadState {
  download: ModelDownload | null;
  /**
   * Downloads paused on the connected Engine (`scope`): their `.part` stays on its disk, and downloading the
   * same reference again continues from it. Kept in this browser, per Engine.
   */
  paused: PausedDownloads;
  pausedScope: string;
  /** Reads the paused downloads of the Engine at `scope` */
  loadPaused(scope: string): void;
  /** Marks `target` paused at `percent`, or (with `undefined`) no longer paused */
  setPaused(target: string, percent: number | null | undefined): void;
  /** Bumped when the installed models change (a download finished, a model was removed) so lists read them again */
  revision: number;
  setDownload(download: ModelDownload | null): void;
  installedChanged(): void;
}

export const useModelDownloadStore = create<DownloadState>((set, get) => ({
  download: null,
  paused: {},
  pausedScope: '',
  loadPaused: scope => set({ paused: readPaused(scope), pausedScope: scope }),
  setPaused: (target, percent) => {
    const { pausedScope, paused } = get();
    const next = { ...paused };
    if (percent === undefined) delete next[target]; else next[target] = percent;
    try { localStorage.setItem(PAUSED_KEY + pausedScope, JSON.stringify(next)); } catch { /* still paused for this session */ }
    set({ paused: next });
  },
  revision: 0,
  setDownload: download => set({ download }),
  installedChanged: () => set(state => ({ revision: state.revision + 1 })),
}));

/** Percent of the current transfer, when the Engine reports a total */
export const downloadPercent = (task?: TaskView) => {
  const progress = task?.progress;
  return progress?.total ? Math.min(100, Math.round(progress.done / progress.total * 100)) : undefined;
};

/** The Hugging Face repository a download reference names */
export const downloadRepo = (target: string) => {
  const quant = target.lastIndexOf(':');
  return quant < 0 ? target : target.slice(0, quant);
};

/** The running download of a catalogue model (matched by its repository), if any */
export const useRepoDownload = (repo: string) =>
  useModelDownloadStore(state => state.download && downloadRepo(state.download.target) === repo ? state.download : null);

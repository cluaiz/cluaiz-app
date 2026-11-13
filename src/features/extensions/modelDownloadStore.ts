import { create } from 'zustand';
import type { TaskView } from '../../api/client/cepTask';

/** The model download the Engine is running (its `<owner>/<repo>:<quant>` reference) and how far it is. */
export interface ModelDownload { target: string; percent?: number }

interface DownloadState {
  download: ModelDownload | null;
  /** Bumped when the installed models change (a download finished, a model was removed) so lists read them again */
  revision: number;
  setDownload(download: ModelDownload | null): void;
  installedChanged(): void;
}

export const useModelDownloadStore = create<DownloadState>(set => ({
  download: null,
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

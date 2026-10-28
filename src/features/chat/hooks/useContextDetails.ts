import { useCallback, useEffect, useRef, useState } from 'react';
import {
  contextApi,
  type ChatCompletionRequest,
  type ContextJobsResponse,
  type ContextPreviewResponse,
  type ContextReportRecord,
} from '../../../api/engine/chat';
import { errorMessage } from '../../../api/client/errors';
import { useConnectionStore } from '../../../store/engine/useConnectionStore';

interface Options {
  open: boolean;
  chatId?: string | null;
  privateChat?: boolean;
}

interface State {
  key: string;
  reportIds: string[];
  selectedReportId: string | null;
  report: ContextReportRecord | null;
  preview: ContextPreviewResponse | null;
  jobs: ContextJobsResponse | null;
  loading: boolean;
  reportLoading: boolean;
  previewLoading: boolean;
  error: string | null;
  previewError: string | null;
}

const empty = (key: string): State => ({
  key,
  reportIds: [],
  selectedReportId: null,
  report: null,
  preview: null,
  jobs: null,
  loading: false,
  reportLoading: false,
  previewLoading: false,
  error: null,
  previewError: null,
});

/** Scoped context inspection (`context.reports`, `context.report`, `context.preview`, `context.jobs`). */
export function useContextDetails({ open, chatId, privateChat = false }: Options) {
  const connection = useConnectionStore(state => `${state.protocol}:${state.getBaseUrl()}`);
  const key = JSON.stringify([connection, chatId || null, privateChat]);
  const live = useRef({ key, open });
  live.current = { key, open };
  const readCtrl = useRef<AbortController | null>(null);
  const previewCtrl = useRef<AbortController | null>(null);
  const revision = useRef(0);
  const [state, setState] = useState<State>(() => empty(key));
  const current = state.key === key && open ? state : empty(key);
  const currentRef = useRef(current);
  currentRef.current = current;

  const refresh = useCallback(async (): Promise<void> => {
    if (!open) return;
    readCtrl.current?.abort();
    const controller = new AbortController();
    const version = ++revision.current;
    readCtrl.current = controller;
    const valid = () =>
      !controller.signal.aborted &&
      live.current.open &&
      live.current.key === key &&
      revision.current === version;

    setState(prev => ({
      ...(prev.key === key ? prev : empty(key)),
      loading: true,
      error: null,
    }));

    try {
      const canReadChat = Boolean(chatId) && !privateChat;
      const [jobs, reportsRes] = await Promise.all([
        contextApi.getJobs(controller.signal),
        canReadChat && chatId
          ? contextApi.listReports(chatId, controller.signal)
          : Promise.resolve({ chat_id: chatId || '', reports: [] as string[] }),
      ]);
      if (!valid()) return;

      const ids = reportsRes.reports;
      const previousSelected = currentRef.current.selectedReportId;
      const targetId =
        previousSelected && ids.includes(previousSelected)
          ? previousSelected
          : ids.length > 0
            ? ids[ids.length - 1]
            : null;

      let report: ContextReportRecord | null = null;
      if (canReadChat && chatId && targetId) {
        const fetched = await contextApi.getReport(chatId, targetId, controller.signal);
        if (!valid()) return;
        report = fetched.context_report;
      }

      setState(prev => ({
        ...(prev.key === key ? prev : empty(key)),
        jobs,
        reportIds: ids,
        selectedReportId: targetId,
        report,
        loading: false,
        reportLoading: false,
        error: null,
      }));
    } catch (failure) {
      if (valid()) {
        setState(prev => ({
          ...prev,
          loading: false,
          reportLoading: false,
          error: errorMessage(failure),
        }));
      }
    }
  }, [open, chatId, privateChat, key]);

  useEffect(() => {
    if (open) void refresh();
    else setState(empty(key));
    return () => {
      revision.current++;
      readCtrl.current?.abort();
      previewCtrl.current?.abort();
    };
  }, [refresh, open, key]);

  const selectReport = useCallback(async (requestId: string): Promise<void> => {
    if (!open || !chatId || privateChat || !requestId) return;
    readCtrl.current?.abort();
    const controller = new AbortController();
    const version = ++revision.current;
    readCtrl.current = controller;
    const valid = () =>
      !controller.signal.aborted &&
      live.current.open &&
      live.current.key === key &&
      revision.current === version;

    setState(prev => ({ ...prev, selectedReportId: requestId, reportLoading: true, error: null }));
    try {
      const fetched = await contextApi.getReport(chatId, requestId, controller.signal);
      if (valid()) {
        setState(prev => ({
          ...prev,
          selectedReportId: requestId,
          report: fetched.context_report,
          reportLoading: false,
        }));
      }
    } catch (failure) {
      if (valid()) {
        setState(prev => ({
          ...prev,
          report: null,
          reportLoading: false,
          error: errorMessage(failure),
        }));
      }
    }
  }, [open, chatId, privateChat, key]);

  const runPreview = useCallback(async (request: ChatCompletionRequest): Promise<void> => {
    if (!open || !chatId || privateChat) return;
    previewCtrl.current?.abort();
    const controller = new AbortController();
    previewCtrl.current = controller;
    const valid = () => !controller.signal.aborted && live.current.open && live.current.key === key;
    setState(prev => ({ ...prev, previewLoading: true, previewError: null }));
    try {
      const preview = await contextApi.preview({ chat_id: chatId, request }, controller.signal);
      if (valid()) setState(prev => ({ ...prev, preview, previewLoading: false, previewError: null }));
    } catch (failure) {
      if (valid()) {
        setState(prev => ({
          ...prev,
          preview: null,
          previewLoading: false,
          previewError: errorMessage(failure),
        }));
      }
    }
  }, [open, chatId, privateChat, key]);

  return {
    ...current,
    connection,
    refresh,
    selectReport,
    runPreview,
  };
}

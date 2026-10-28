import { callCep } from '../../client/cep';
import { ApiError } from '../../client/errors';
import type {
  ContextJobCounts,
  ContextJobQueueItem,
  ContextJobRecentItem,
  ContextJobsResponse,
  ContextPlanReport,
  ContextPreviewParams,
  ContextPreviewResponse,
  ContextReportRecord,
  ContextReportResponse,
  ContextReportsResponse,
  ContextToolsReport,
} from './context.types';

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const count = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const invalid = (method: string) =>
  new ApiError('Engine returned an invalid context inspection response', 200, 'INVALID_CONTEXT_RESPONSE', method);
const inputError = (message: string, code = 'INVALID_CONTEXT_INPUT') => new ApiError(message, 400, code);

function chatIdOf(value: string): string {
  if (!text(value)) throw inputError('A chat id is required', 'INVALID_CHAT_ID');
  return value;
}

function planRecord(value: unknown, method: string): ContextPlanReport {
  if (!object(value)) throw invalid(method);
  const numericFields = [
    'n_ctx',
    'prompt_tokens',
    'protected_tokens',
    'available_tokens',
    'used_tokens',
    'messages_over_budget',
  ] as const;
  for (const key of numericFields) {
    if (value[key] !== undefined && !count(value[key])) throw invalid(method);
  }
  if (value.needs_compaction !== undefined && typeof value.needs_compaction !== 'boolean') throw invalid(method);
  if (value.error !== undefined && !text(value.error)) throw invalid(method);
  if (value.reserve !== undefined) {
    if (!object(value.reserve) || !count(value.reserve.answer) || !count(value.reserve.thinking) || !count(value.reserve.margin)) {
      throw invalid(method);
    }
  }
  if (value.notes !== undefined && value.notes !== null) {
    if (!object(value.notes)
      || (value.notes.system !== undefined && (!Array.isArray(value.notes.system) || !value.notes.system.every(s => typeof s === 'string')))
      || (value.notes.with_message !== undefined && (!Array.isArray(value.notes.with_message) || !value.notes.with_message.every(s => typeof s === 'string')))) {
      throw invalid(method);
    }
  }
  const hasKnownShape = count(value.n_ctx) || count(value.prompt_tokens) || text(value.error) || text(value.history_mode);
  if (!hasKnownShape) throw invalid(method);
  return value as ContextPlanReport;
}

function toolsRecord(value: unknown, method: string): ContextToolsReport {
  if (!object(value)) throw invalid(method);
  const numericFields = ['hint_tokens', 'system_tools_tokens', 'template_tools_tokens', 'conversation_tokens'] as const;
  for (const key of numericFields) {
    if (value[key] !== undefined && !count(value[key])) throw invalid(method);
  }
  if (value.load_room_tokens !== undefined && value.load_room_tokens !== null && !count(value.load_room_tokens)) {
    throw invalid(method);
  }
  const stringArrayFields = ['loaded_in_chat', 'bound'] as const;
  for (const key of stringArrayFields) {
    if (value[key] !== undefined && (!Array.isArray(value[key]) || !value[key].every(item => typeof item === 'string'))) {
      throw invalid(method);
    }
  }
  return value as ContextToolsReport;
}

function timingRecord(value: unknown, method: string): Record<string, number> {
  if (!object(value)) throw invalid(method);
  const out: Record<string, number> = {};
  for (const [key, ms] of Object.entries(value)) {
    if (!text(key) || !count(ms)) throw invalid(method);
    out[key] = ms;
  }
  return out;
}

function reportRecord(value: unknown, method: string): ContextReportRecord {
  if (!object(value)) throw invalid(method);
  const plan = value.plan !== undefined ? planRecord(value.plan, method) : undefined;
  const tools = value.tools !== undefined ? toolsRecord(value.tools, method) : undefined;
  const timing = value.timing !== undefined ? timingRecord(value.timing, method) : undefined;
  if (!plan && !tools && !timing) throw invalid(method);
  return { ...(plan && { plan }), ...(tools && { tools }), ...(timing && { timing }) };
}

function queueItem(value: unknown): ContextJobQueueItem {
  if (!object(value) || !text(value.chat_id) || !count(value.answer_pos) || !text(value.kind)) {
    throw invalid('context.jobs');
  }
  return { chat_id: value.chat_id, answer_pos: value.answer_pos, kind: value.kind };
}

function jobCounts(value: unknown): ContextJobCounts {
  if (!object(value) || !count(value.done) || !count(value.failed) || !count(value.stopped) || !count(value.skipped)) {
    throw invalid('context.jobs');
  }
  return { done: value.done, failed: value.failed, stopped: value.stopped, skipped: value.skipped };
}

function recentItem(value: unknown): ContextJobRecentItem {
  if (!object(value) || !text(value.chat) || !count(value.answer_pos) || typeof value.cold !== 'boolean'
    || !text(value.outcome) || !count(value.ms)) {
    throw invalid('context.jobs');
  }
  return { chat: value.chat, answer_pos: value.answer_pos, cold: value.cold, outcome: value.outcome, ms: value.ms };
}

/** Engine context inspection (`context.preview`, `context.reports`, `context.report`, `context.jobs`). */
export const contextApi = {
  preview: async (params: ContextPreviewParams, signal?: AbortSignal): Promise<ContextPreviewResponse> => {
    const chatId = chatIdOf(params.chat_id);
    if (!object(params.request) || !Array.isArray(params.request.messages) || params.request.messages.length === 0) {
      throw inputError('context.preview requires a request with at least one message');
    }
    const result = await callCep<unknown>('context.preview', {
      chat_id: chatId,
      request: params.request,
    }, { signal });
    if (!object(result)) throw invalid('context.preview');
    return {
      plan: planRecord(result.plan, 'context.preview'),
      tools: toolsRecord(result.tools, 'context.preview'),
    };
  },

  listReports: async (chatId: string, signal?: AbortSignal): Promise<ContextReportsResponse> => {
    chatIdOf(chatId);
    const result = await callCep<unknown>('context.reports', { chat_id: chatId }, { signal });
    if (!object(result) || result.chat_id !== chatId || !Array.isArray(result.reports)
      || !result.reports.every(text)) {
      throw invalid('context.reports');
    }
    return { chat_id: chatId, reports: result.reports };
  },

  getReport: async (chatId: string, requestId: string, signal?: AbortSignal): Promise<ContextReportResponse> => {
    chatIdOf(chatId);
    if (!text(requestId)) throw inputError('A request_id is required', 'INVALID_REQUEST_ID');
    const result = await callCep<unknown>('context.report', {
      chat_id: chatId,
      request_id: requestId,
    }, { signal });
    if (!object(result) || result.chat_id !== chatId || result.request_id !== requestId) {
      throw invalid('context.report');
    }
    return {
      chat_id: chatId,
      request_id: requestId,
      context_report: reportRecord(result.context_report, 'context.report'),
    };
  },

  getJobs: async (signal?: AbortSignal): Promise<ContextJobsResponse> => {
    const result = await callCep<unknown>('context.jobs', {}, { signal });
    if (!object(result) || !text(result.indexer) || !count(result.requests_in_flight)
      || typeof result.running !== 'boolean' || !Array.isArray(result.queue) || !Array.isArray(result.recent)) {
      throw invalid('context.jobs');
    }
    return {
      indexer: result.indexer,
      requests_in_flight: result.requests_in_flight,
      running: result.running,
      queue: result.queue.map(queueItem),
      counts: jobCounts(result.counts),
      recent: result.recent.map(recentItem),
    };
  },
};

import React, { useEffect, useId, useRef, useState } from 'react';
import { Activity, Cpu, Play, RefreshCw, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/Dialog';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { AlertBanner } from '../../../components/ui/AlertBanner';
import { CustomDropdown, FLOATING_MENU_ATTR } from '../../../components/ui/dropdown/CustomDropdown';
import type { ChatMessage as ApiChatMessage, ContextPlanReport, ContextToolsReport } from '../../../api/engine/chat';
import type { ChatMessage } from '../../../store/chat/useChatStore';
import { buildChatHistory, chatHistoryOptions } from '../utils/chatRequest';
import type { SendChatOptions } from '../../../core/engine';
import { useContextDetails } from '../hooks/useContextDetails';

interface Props {
  open: boolean;
  onClose: () => void;
  chatId?: string | null;
  privateChat?: boolean;
  messages?: ChatMessage[];
  draftText?: string;
  modelId?: string;
  getRequestOptions?: () => SendChatOptions | undefined;
}

type SectionTab = 'reports' | 'preview' | 'jobs';

function PlanAndToolsSummary({
  plan,
  tools,
  timing,
  testIdPrefix,
}: {
  plan?: ContextPlanReport;
  tools?: ContextToolsReport;
  timing?: Record<string, number>;
  testIdPrefix: string;
}) {
  return (
    <div className="space-y-3" data-testid={testIdPrefix}>
      {plan && (
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] p-3 space-y-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">Context Plan</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {plan.history_mode && <Badge variant="secondary">mode: {String(plan.history_mode)}</Badge>}
              {plan.needs_compaction !== undefined && (
                <Badge variant={plan.needs_compaction ? 'destructive' : 'outline'}>
                  {plan.needs_compaction ? 'Compaction needed' : 'Within budget'}
                </Badge>
              )}
            </div>
          </div>
          {plan.error ? (
            <AlertBanner variant="error" message={plan.error} />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
              {plan.n_ctx !== undefined && (
                <div><span className="text-[var(--text-muted)]">Context window:</span> <b>{plan.n_ctx.toLocaleString()}</b></div>
              )}
              {plan.used_tokens !== undefined && (
                <div><span className="text-[var(--text-muted)]">Used tokens:</span> <b>{plan.used_tokens.toLocaleString()}</b></div>
              )}
              {plan.available_tokens !== undefined && (
                <div><span className="text-[var(--text-muted)]">Available:</span> <b>{plan.available_tokens.toLocaleString()}</b></div>
              )}
              {plan.protected_tokens !== undefined && (
                <div><span className="text-[var(--text-muted)]">Protected:</span> <b>{plan.protected_tokens.toLocaleString()}</b></div>
              )}
              {plan.prompt_tokens !== undefined && (
                <div><span className="text-[var(--text-muted)]">Prompt tokens:</span> <b>{plan.prompt_tokens.toLocaleString()}</b></div>
              )}
              {plan.messages_over_budget !== undefined && (
                <div><span className="text-[var(--text-muted)]">Over budget msgs:</span> <b>{plan.messages_over_budget}</b></div>
              )}
            </div>
          )}
          {plan.reserve && (
            <p className="text-[11px] text-[var(--text-muted)]">
              Reserved tokens: answer {plan.reserve.answer.toLocaleString()} · thinking {plan.reserve.thinking.toLocaleString()} · safety margin {plan.reserve.margin.toLocaleString()}
            </p>
          )}
          {plan.notes && ((plan.notes.system?.length ?? 0) > 0 || (plan.notes.with_message?.length ?? 0) > 0) && (
            <div className="text-[11px] text-[var(--text-secondary)]">
              Injected notes: {plan.notes.system?.length ?? 0} system, {plan.notes.with_message?.length ?? 0} with message
            </div>
          )}
        </div>
      )}

      {tools && (
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] p-3 space-y-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">Tool & Token Accounting</span>
            <div className="flex flex-wrap gap-1.5">
              {tools.format && <Badge variant="outline">format: {tools.format}</Badge>}
              {tools.token_counts && <Badge variant="secondary">{tools.token_counts}</Badge>}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
            {tools.conversation_tokens !== undefined && (
              <div><span className="text-[var(--text-muted)]">Conversation:</span> <b>{tools.conversation_tokens.toLocaleString()}</b></div>
            )}
            {tools.system_tools_tokens !== undefined && (
              <div><span className="text-[var(--text-muted)]">System + tools:</span> <b>{tools.system_tools_tokens.toLocaleString()}</b></div>
            )}
            {tools.template_tools_tokens !== undefined && (
              <div><span className="text-[var(--text-muted)]">Tool definitions:</span> <b>{tools.template_tools_tokens.toLocaleString()}</b></div>
            )}
            {tools.hint_tokens !== undefined && (
              <div><span className="text-[var(--text-muted)]">Tool hints:</span> <b>{tools.hint_tokens.toLocaleString()}</b></div>
            )}
            {tools.load_room_tokens !== undefined && tools.load_room_tokens !== null && (
              <div><span className="text-[var(--text-muted)]">Tool load room:</span> <b>{tools.load_room_tokens.toLocaleString()}</b></div>
            )}
          </div>
          {tools.bound && tools.bound.length > 0 && (
            <p className="text-[11px] text-[var(--text-secondary)] break-words">
              Bound tools ({tools.bound.length}): <code>{tools.bound.join(', ')}</code>
            </p>
          )}
          {tools.loaded_in_chat && tools.loaded_in_chat.length > 0 && (
            <p className="text-[11px] text-[var(--text-muted)] break-words">
              Loaded in chat: <code>{tools.loaded_in_chat.join(', ')}</code>
            </p>
          )}
        </div>
      )}

      {timing && Object.keys(timing).length > 0 && (
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] p-3 space-y-1.5 text-xs">
          <span className="font-semibold">Preflight Timing (ms)</span>
          <div className="flex flex-wrap gap-2 text-[11px] text-[var(--text-secondary)]">
            {Object.entries(timing).map(([stage, ms]) => (
              <span key={stage} className="rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-0.5">
                {stage}: <b>{ms} ms</b>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Inspects Engine context reports (`context.reports`, `context.report`), dry-run preview (`context.preview`), and idle indexer (`context.jobs`). */
export function ContextDetailsPanel({
  open,
  onClose,
  chatId,
  privateChat = false,
  messages = [],
  draftText = '',
  modelId,
  getRequestOptions,
}: Props) {
  const ctx = useContextDetails({ open, chatId, privateChat });
  const [tab, setTab] = useState<SectionTab>('reports');
  const [previewPrompt, setPreviewPrompt] = useState('');
  const surface = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    setTab('reports');
    setPreviewPrompt(draftText || '');
  }, [open, chatId, privateChat, ctx.connection, draftText]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    surface.current?.querySelector<HTMLButtonElement>('[aria-label="Close context details"]')?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, [open]);

  const busy = ctx.loading || ctx.reportLoading || ctx.previewLoading;

  const keyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const trigger = surface.current?.querySelector<HTMLButtonElement>('[aria-haspopup="listbox"][aria-expanded="true"]');
    if (event.key === 'Escape') {
      if (trigger) return;
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const menu = (event.target as Element).closest('[' + FLOATING_MENU_ATTR + ']');
    const focusScope = menu || surface.current!;
    const elements = [
      ...focusScope.querySelectorAll<HTMLElement>(
        'button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),summary,[href]'
      ),
    ].filter(el => el.getClientRects().length);
    const first = elements[0];
    const last = elements[elements.length - 1];
    if (menu) {
      if ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault();
        trigger?.focus();
        trigger?.click();
      }
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  const previewHistory = buildChatHistory(messages) as ApiChatMessage[];
  const handleRunPreview = () => {
    if (!chatId || privateChat) return;
    const trimmedPrompt = previewPrompt.trim();
    const previewMessages: ApiChatMessage[] = [
      ...previewHistory,
      ...(trimmedPrompt ? [{ role: 'user' as const, content: trimmedPrompt }] : []),
    ];
    if (previewMessages.length === 0) return;
    const options = getRequestOptions?.();
    void ctx.runPreview({
      ...(modelId ? { model: modelId } : {}),
      ...options,
      ...chatHistoryOptions(options, false),
      messages: previewMessages,
    });
  };

  return (
    <Dialog open={open} onOpenChange={value => { if (!value) onClose(); }}>
      <div ref={surface} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={keyDown}>
        <DialogContent className="flex max-h-[85dvh] w-full max-w-2xl flex-col overflow-hidden border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)]">
          <DialogHeader className="!mb-0 !flex-row shrink-0 items-center justify-between gap-2 border-b border-[var(--border-color)] !px-4 !py-3 !text-left">
            <DialogTitle>
              <span id={titleId} className="flex items-center gap-2">
                <Cpu size={18} /> Context & Indexer Diagnostics
              </span>
            </DialogTitle>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Refresh context diagnostics"
                title="Refresh context reports and indexer status"
                disabled={busy}
                onClick={() => void ctx.refresh()}
              >
                <RefreshCw size={15} />
              </Button>
              <Button type="button" variant="ghost" size="icon" aria-label="Close context details" onClick={onClose}>
                <X size={16} />
              </Button>
            </div>
          </DialogHeader>

          <div className="min-h-0 space-y-4 overflow-y-auto p-4 text-sm">
            {ctx.error && (
              <div role="alert">
                <AlertBanner variant="error" message={ctx.error} />
              </div>
            )}

            <div className="flex flex-wrap gap-1.5 border-b border-[var(--border-color)] pb-2" role="tablist" aria-label="Context diagnostic sections">
              {([
                ['reports', `Retained Reports (${ctx.reportIds.length})`],
                ['preview', 'Dry-Run Preview'],
                ['jobs', 'Background Indexer'],
              ] as const).map(([key, label]) => (
                <Button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  size="sm"
                  variant={tab === key ? 'secondary' : 'ghost'}
                  onClick={() => setTab(key)}
                >
                  {label}
                </Button>
              ))}
            </div>

            {tab === 'reports' && (
              <div className="space-y-3" data-testid="ctx-tab-reports">
                <p className="text-xs text-[var(--text-secondary)]">
                  The Engine keeps up to the newest 20 preflight context reports per chat in RAM until the Engine restarts (<code>context.reports</code> / <code>context.report</code>).
                </p>
                {privateChat ? (
                  <AlertBanner
                    variant="info"
                    title="Private chat"
                    message="Per-chat retained context reports are unavailable in private chats. Switch to Background Indexer to view global queue status."
                  />
                ) : !chatId ? (
                  <AlertBanner
                    variant="info"
                    title="No active saved chat"
                    message="Send a message in a saved chat to record and inspect preflight context reports."
                  />
                ) : ctx.loading ? (
                  <p role="status">Reading retained context reports…</p>
                ) : ctx.reportIds.length === 0 ? (
                  <p role="status" className="text-xs text-[var(--text-secondary)]">
                    No retained context reports in Engine RAM for chat <code>{chatId}</code> yet.
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold">Select request report</span>
                      <div role="group" aria-label="Retained request report">
                        <CustomDropdown
                          floating
                          value={ctx.selectedReportId || ctx.reportIds[ctx.reportIds.length - 1]}
                          onChange={id => void ctx.selectReport(id)}
                          options={ctx.reportIds.map((id, idx) => ({
                            value: id,
                            label: idx === ctx.reportIds.length - 1 ? `${id} (latest)` : id,
                          }))}
                        />
                      </div>
                    </div>
                    {ctx.reportLoading ? (
                      <p role="status" className="text-xs">Loading report {ctx.selectedReportId}…</p>
                    ) : ctx.report ? (
                      <PlanAndToolsSummary
                        plan={ctx.report.plan}
                        tools={ctx.report.tools}
                        timing={ctx.report.timing}
                        testIdPrefix="ctx-retained-report"
                      />
                    ) : null}
                  </>
                )}
              </div>
            )}

            {tab === 'preview' && (
              <div className="space-y-3" data-testid="ctx-tab-preview">
                <AlertBanner
                  variant="info"
                  title="Deliberate preflight dry-run (context.preview)"
                  message="This text preview uses current composer model, thinking and tool settings with saved chat history. Unsent attachments are not included. It generates no answer or saved events. The Engine may load the model to count tokens."
                />
                {privateChat || !chatId ? (
                  <p className="text-xs text-[var(--text-secondary)]">
                    Open a saved chat session to run a dry-run context preview against its history.
                  </p>
                ) : (
                  <div className="space-y-3 rounded-lg border border-[var(--border-color)] p-3">
                    <label className="block text-xs font-semibold" htmlFor={titleId + '-preview-input'}>
                      Optional next user message for preview ({messages.length} existing messages in chat)
                    </label>
                    <div className="flex gap-2">
                      <Input
                        id={titleId + '-preview-input'}
                        aria-label="Preview user prompt"
                        value={previewPrompt}
                        onChange={event => setPreviewPrompt(event.target.value)}
                        placeholder="Optional message to include in dry-run…"
                        sizeVariant="sm"
                      />
                      <Button
                        type="button"
                        size="sm"
                        data-testid="ctx-run-preview-btn"
                        disabled={ctx.previewLoading || (!previewPrompt.trim() && previewHistory.length === 0)}
                        onClick={handleRunPreview}
                      >
                        <Play size={14} className="mr-1" />
                        {ctx.previewLoading ? 'Running…' : 'Run Preview'}
                      </Button>
                    </div>
                    {ctx.previewError && (
                      <div role="alert">
                        <AlertBanner variant="error" message={ctx.previewError} />
                      </div>
                    )}
                    {ctx.preview && (
                      <PlanAndToolsSummary
                        plan={ctx.preview.plan}
                        tools={ctx.preview.tools}
                        testIdPrefix="ctx-preview-result"
                      />
                    )}
                  </div>
                )}
              </div>
            )}

            {tab === 'jobs' && (
              <div className="space-y-3" data-testid="ctx-tab-jobs">
                <p className="text-xs text-[var(--text-secondary)]">
                  Idle background enrichment jobs (<code>context.jobs</code>). Background indexing pauses automatically while chat generation is in flight.
                </p>
                {ctx.loading && !ctx.jobs ? (
                  <p role="status">Reading background indexer status…</p>
                ) : !ctx.jobs ? (
                  <p className="text-xs text-[var(--text-secondary)]">Background indexer status is unavailable.</p>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] p-3 space-y-2 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 font-semibold">
                          <Activity size={14} /> Indexer Policy: <code>{ctx.jobs.indexer}</code>
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Badge variant={ctx.jobs.running ? 'secondary' : 'outline'}>
                            {ctx.jobs.running ? 'Worker running' : 'Idle'}
                          </Badge>
                          <Badge variant="outline">
                            {ctx.jobs.requests_in_flight} chat req in flight
                          </Badge>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                        <div><span className="text-[var(--text-muted)]">Done:</span> <b>{ctx.jobs.counts.done}</b></div>
                        <div><span className="text-[var(--text-muted)]">Skipped:</span> <b>{ctx.jobs.counts.skipped}</b></div>
                        <div><span className="text-[var(--text-muted)]">Stopped:</span> <b>{ctx.jobs.counts.stopped}</b></div>
                        <div><span className="text-[var(--text-muted)]">Failed:</span> <b>{ctx.jobs.counts.failed}</b></div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                        Queued Jobs ({ctx.jobs.queue.length})
                      </h4>
                      {ctx.jobs.queue.length === 0 ? (
                        <p className="text-xs text-[var(--text-secondary)]">Queue is empty.</p>
                      ) : (
                        <ul className="space-y-1 text-xs">
                          {ctx.jobs.queue.map((item, idx) => (
                            <li key={`${item.chat_id}-${item.answer_pos}-${idx}`} className="rounded border border-[var(--border-color)] bg-[var(--bg-secondary)] px-2.5 py-1.5">
                              <code>{item.chat_id}</code> · pos m:{item.answer_pos} · <Badge variant="outline">{item.kind}</Badge>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                        Recent Job Outcomes ({ctx.jobs.recent.length})
                      </h4>
                      {ctx.jobs.recent.length === 0 ? (
                        <p className="text-xs text-[var(--text-secondary)]">No recent background jobs recorded since Engine start.</p>
                      ) : (
                        <ul className="space-y-1 text-xs max-h-48 overflow-y-auto pr-1">
                          {ctx.jobs.recent.map((item, idx) => (
                            <li key={`${item.chat}-${item.answer_pos}-${idx}`} className="flex items-center justify-between gap-2 rounded border border-[var(--border-color)] bg-[var(--bg-secondary)] px-2.5 py-1.5">
                              <div>
                                <code>{item.chat}</code> · m:{item.answer_pos} · <Badge variant="secondary">{item.outcome}</Badge>
                                {item.cold && <span className="ml-1.5 text-[11px] text-[var(--text-muted)]">(cold)</span>}
                              </div>
                              <span className="text-[11px] text-[var(--text-muted)]">{item.ms} ms</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </div>
    </Dialog>
  );
}

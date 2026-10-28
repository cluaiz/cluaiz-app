import React, { useEffect, useId, useRef, useState } from 'react';
import { Download, History, RefreshCw, Search, ShieldAlert, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/Dialog';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { AlertBanner } from '../../../components/ui/AlertBanner';
import { CustomDropdown, FLOATING_MENU_ATTR } from '../../../components/ui/dropdown/CustomDropdown';
import type { ConversationSearchScope } from '../../../api/engine/chat';
import { useConversationMemory } from '../hooks/useConversationMemory';

interface Props {
  open: boolean;
  onClose: () => void;
  chatId?: string | null;
  privateChat?: boolean;
}

type TabKey = 'search' | 'map' | 'events' | 'grants';

/** Inspects Engine conversation memory (`memory.*`): search, source item, chat map, event log, tool grants, and export. */
export function ConversationMemoryPanel({ open, onClose, chatId, privateChat = false }: Props) {
  const conv = useConversationMemory({ open, chatId, privateChat });
  const [tab, setTab] = useState<TabKey>('search');
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<ConversationSearchScope>('chat');
  const [withinHours, setWithinHours] = useState('0');
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false);
  const surface = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    setTab('search');
    setQuery('');
    setScope('chat');
    setWithinHours('0');
    setConfirmRevokeAll(false);
  }, [open, chatId, privateChat, conv.connection]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    surface.current?.querySelector<HTMLButtonElement>('[aria-label="Close conversation memory"]')?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, [open]);

  const busy = conv.loading || conv.pending || conv.searching || conv.itemLoading;

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

  const handleExport = async () => {
    const exported = await conv.exportConversation();
    if (!exported || typeof URL.createObjectURL !== 'function') return;
    try {
      const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cluaiz-chat-${exported.chat_id}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Browser environment without download support still renders conv.lastExport summary in-panel.
    }
  };

  return (
    <Dialog open={open} onOpenChange={value => { if (!value) onClose(); }}>
      <div ref={surface} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={keyDown}>
        <DialogContent className="flex max-h-[85dvh] w-full max-w-2xl flex-col overflow-hidden border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)]">
          <DialogHeader className="!mb-0 !flex-row shrink-0 items-center justify-between gap-2 border-b border-[var(--border-color)] !px-4 !py-3 !text-left">
            <DialogTitle>
              <span id={titleId} className="flex items-center gap-2">
                <History size={18} /> Conversation Memory
              </span>
            </DialogTitle>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Refresh conversation memory"
                title="Refresh conversation memory"
                disabled={busy || privateChat || !chatId}
                onClick={() => void conv.refresh()}
              >
                <RefreshCw size={15} />
              </Button>
              <Button type="button" variant="ghost" size="icon" aria-label="Close conversation memory" onClick={onClose}>
                <X size={16} />
              </Button>
            </div>
          </DialogHeader>

          <div className="min-h-0 space-y-4 overflow-y-auto p-4 text-sm">
            {privateChat ? (
              <AlertBanner
                variant="info"
                title="Private chat"
                message="Engine conversation memory, event logs, and exports are disabled in private chats."
              />
            ) : !chatId ? (
              <AlertBanner
                variant="info"
                title="No active saved chat"
                message="Send a message in a saved chat to inspect its Engine conversation map, search history, tool permissions, or export."
              />
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
                  <span>Chat ID: <code className="font-mono text-[var(--text-primary)]">{chatId}</code></span>
                  <span>
                    {conv.index
                      ? `${conv.index.cards.length} cards · ${conv.index.episodes.length} episodes · ${conv.index.tasks.length} tasks · ${conv.eventsTotal} events`
                      : 'Loading summary…'}
                  </span>
                </div>

                {conv.error && (
                  <div role="alert">
                    <AlertBanner variant="error" message={conv.error} />
                  </div>
                )}
                {conv.message && (
                  <p role="status" className="text-xs text-[var(--accent-color)]">
                    {conv.message}
                  </p>
                )}

                <div className="flex flex-wrap gap-1.5 border-b border-[var(--border-color)] pb-2" role="tablist" aria-label="Conversation memory sections">
                  {([
                    ['search', 'Search & Source'],
                    ['map', 'Chat Map'],
                    ['events', `Event Log (${conv.eventsTotal})`],
                    ['grants', `Permissions & Export (${conv.grants.length})`],
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

                {tab === 'search' && (
                  <div className="space-y-3" data-testid="conv-tab-search">
                    <form
                      className="space-y-2 rounded-lg border border-[var(--border-color)] p-3"
                      onSubmit={event => {
                        event.preventDefault();
                        if (!query.trim()) return;
                        const hours = Number(withinHours);
                        void conv.runSearch({
                          query,
                          scope,
                          ...(hours > 0 ? { within_hours: hours } : {}),
                        });
                      }}
                    >
                      <label className="block text-xs font-semibold" htmlFor={titleId + '-search'}>
                        Search Engine conversation recall
                      </label>
                      <div className="flex gap-2">
                        <Input
                          id={titleId + '-search'}
                          aria-label="Conversation search query"
                          value={query}
                          onChange={event => setQuery(event.target.value)}
                          placeholder="Keywords, files, tools, or decisions…"
                          sizeVariant="sm"
                        />
                        <Button type="submit" size="sm" disabled={conv.searching || !query.trim()}>
                          <Search size={14} className="mr-1" />
                          {conv.searching ? 'Searching…' : 'Search'}
                        </Button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <div role="group" aria-label="Conversation search scope">
                          <CustomDropdown
                            floating
                            value={scope}
                            onChange={val => setScope(val as ConversationSearchScope)}
                            options={[
                              { value: 'chat', label: 'This chat (cards + BM25)' },
                              { value: 'workspace', label: 'This workspace (cross-chat)' },
                              { value: 'all', label: 'All chats (cross-chat)' },
                            ]}
                          />
                        </div>
                        <div role="group" aria-label="Conversation search time window">
                          <CustomDropdown
                            floating
                            value={withinHours}
                            onChange={setWithinHours}
                            options={[
                              { value: '0', label: 'Any time' },
                              { value: '24', label: 'Last 24 hours' },
                              { value: '168', label: 'Last 7 days' },
                              { value: '720', label: 'Last 30 days' },
                            ]}
                          />
                        </div>
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        References like <code>m:0</code> are Engine message positions in this chat, not local UI message IDs. Scores are raw BM25 relevance scores, not percentages.
                      </p>
                    </form>

                    {conv.searchError && (
                      <div role="alert">
                        <AlertBanner variant="error" message={conv.searchError} />
                      </div>
                    )}

                    {conv.activeItem && (
                      <div className="space-y-2 rounded-lg border border-[var(--accent-color)]/50 bg-[var(--bg-secondary)] p-3" data-testid="conv-active-item">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <Badge variant="secondary">{conv.activeItem.ref}</Badge>
                            <Badge variant="outline">{conv.activeItem.card.role}</Badge>
                            {conv.activeItem.card.tokens !== undefined && (
                              <span className="text-xs text-[var(--text-muted)]">{conv.activeItem.card.tokens} tokens</span>
                            )}
                          </div>
                          <Button type="button" size="sm" variant="ghost" onClick={conv.clearActiveItem}>
                            Close source
                          </Button>
                        </div>
                        <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded border border-[var(--border-color)] bg-[var(--bg-primary)] p-2.5 text-xs">
                          {conv.activeItem.text}
                        </pre>
                      </div>
                    )}

                    {conv.searchResult && (
                      <div className="space-y-2" data-testid="conv-search-results">
                        {conv.searchResult.scope !== 'chat' ? (
                          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] p-3">
                            <p className="mb-1 text-xs font-semibold">
                              Cross-chat recall ({conv.searchResult.scope})
                            </p>
                            <pre className="whitespace-pre-wrap break-words text-xs text-[var(--text-secondary)]">
                              {conv.searchResult.text || 'No matching messages found across chats.'}
                            </pre>
                          </div>
                        ) : conv.searchResult.results.length === 0 ? (
                          <p role="status" className="text-xs text-[var(--text-secondary)]">
                            No messages in this chat matched "{conv.searchResult.query}".
                          </p>
                        ) : (
                          <ul className="space-y-2" aria-label="Conversation search hits">
                            {conv.searchResult.results.map(hit => (
                              <li
                                key={hit.ref}
                                data-testid={`conv-search-hit-${hit.ref}`}
                                className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] p-3 space-y-1.5"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <Badge variant="secondary">{hit.ref}</Badge>
                                    <Badge variant="outline">{hit.card.role}</Badge>
                                    <span className="text-xs text-[var(--text-muted)]">
                                      BM25 score: {hit.score.toFixed(2)}
                                    </span>
                                  </div>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={conv.itemLoading}
                                    onClick={() => void conv.inspectItem(hit.ref)}
                                  >
                                    View message ({hit.ref})
                                  </Button>
                                </div>
                                {hit.card.enrichment?.title && (
                                  <p className="text-xs font-semibold">{hit.card.enrichment.title}</p>
                                )}
                                {hit.card.enrichment?.summary && (
                                  <p className="text-xs text-[var(--text-secondary)]">{hit.card.enrichment.summary}</p>
                                )}
                                {hit.why.length > 0 && (
                                  <p className="text-[11px] text-[var(--text-muted)]">
                                    Matched: {hit.why.join(', ')}
                                  </p>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {tab === 'map' && (
                  <div className="space-y-4" data-testid="conv-tab-map">
                    {conv.loading ? (
                      <p role="status">Reading conversation index…</p>
                    ) : !conv.index ? (
                      <p className="text-xs text-[var(--text-secondary)]">Conversation index is unavailable.</p>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                            Tasks ({conv.index.tasks.length})
                          </h4>
                          {conv.index.tasks.length === 0 ? (
                            <p className="text-xs text-[var(--text-secondary)]">No indexed tasks yet.</p>
                          ) : (
                            <ul className="space-y-2">
                              {conv.index.tasks.map(task => (
                                <li key={task.id} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] p-2.5 text-xs space-y-1">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <Badge variant="secondary">{task.stage}</Badge>
                                    <Badge variant="outline">m:{task.from_pos}–m:{task.to_pos}</Badge>
                                    <span className="font-semibold">{task.title}</span>
                                  </div>
                                  {task.checkpoint && <p className="text-[var(--text-secondary)]">Checkpoint: {task.checkpoint}</p>}
                                  <p className="text-[11px] text-[var(--text-muted)]">
                                    Source: {task.source}
                                    {task.files.length ? ` · Files: ${task.files.join(', ')}` : ''}
                                    {task.tools.length ? ` · Tools: ${task.tools.join(', ')}` : ''}
                                  </p>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <div className="space-y-2">
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                            Episodes ({conv.index.episodes.length})
                          </h4>
                          {conv.index.episodes.length === 0 ? (
                            <p className="text-xs text-[var(--text-secondary)]">No episodes grouped yet.</p>
                          ) : (
                            <ul className="space-y-2">
                              {conv.index.episodes.map(ep => (
                                <li key={ep.id} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] p-2.5 text-xs space-y-1">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <Badge variant="secondary">{ep.id}</Badge>
                                    <Badge variant="outline">m:{ep.first_pos}–m:{ep.last_pos} ({ep.messages} msgs)</Badge>
                                    <span className="font-semibold">{ep.summary?.title || ep.title}</span>
                                  </div>
                                  {ep.summary?.summary && <p className="text-[var(--text-secondary)]">{ep.summary.summary}</p>}
                                  {ep.keywords.length > 0 && (
                                    <p className="text-[11px] text-[var(--text-muted)]">Keywords: {ep.keywords.join(', ')}</p>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <div className="space-y-2">
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                            Message Cards ({conv.index.cards.length}) · Graph ({conv.index.graph.nodes?.length ?? 0} nodes, {conv.index.graph.edges?.length ?? 0} edges)
                          </h4>
                          {conv.index.cards.length === 0 ? (
                            <p className="text-xs text-[var(--text-secondary)]">No message cards indexed yet.</p>
                          ) : (
                            <ul className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                              {conv.index.cards.map(card => {
                                const ref = `m:${card.pos}`;
                                return (
                                  <li key={ref} className="flex items-center justify-between gap-2 rounded border border-[var(--border-color)] bg-[var(--bg-secondary)] px-2.5 py-1.5 text-xs">
                                    <div className="min-w-0 flex-1 truncate">
                                      <span className="font-mono font-semibold">{ref}</span> · <span className="capitalize">{card.role}</span>
                                      {card.tokens !== undefined ? ` · ${card.tokens} tok` : ''}
                                      {card.enrichment?.title ? ` · ${card.enrichment.title}` : ''}
                                      {card.keywords?.length ? ` (${card.keywords.slice(0, 4).join(', ')})` : ''}
                                    </div>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setTab('search');
                                        void conv.inspectItem(ref);
                                      }}
                                    >
                                      Inspect
                                    </Button>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {tab === 'events' && (
                  <div className="space-y-3" data-testid="conv-tab-events">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
                      <span>
                        Showing {conv.events.length} of {conv.eventsTotal} events
                        {conv.skippedLines > 0 ? ` (${conv.skippedLines} corrupted lines skipped)` : ''}
                      </span>
                      {conv.nextFromSeq !== null && (
                        <Button type="button" size="sm" variant="outline" disabled={conv.loading} onClick={() => void conv.loadMoreEvents()}>
                          Load more (from #{conv.nextFromSeq})
                        </Button>
                      )}
                    </div>
                    {conv.events.length === 0 ? (
                      <p className="text-xs text-[var(--text-secondary)]">No events recorded in the Engine log for this chat.</p>
                    ) : (
                      <ul className="space-y-1.5 max-h-72 overflow-y-auto pr-1" aria-label="Conversation event log">
                        {conv.events.map(ev => (
                          <li
                            key={ev.seq}
                            data-testid={`conv-event-${ev.seq}`}
                            className="rounded border border-[var(--border-color)] bg-[var(--bg-secondary)] px-2.5 py-1.5 text-xs"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <Badge variant="outline">#{ev.seq}</Badge>
                                <Badge variant="secondary">{ev.kind}</Badge>
                                {typeof ev.role === 'string' && <span className="text-[var(--text-secondary)]">{ev.role}</span>}
                                {typeof ev.tool === 'string' && <code className="font-mono text-[11px]">{ev.tool}</code>}
                              </div>
                              {ev.ts && <span className="text-[11px] text-[var(--text-muted)]">{new Date(ev.ts).toLocaleTimeString()}</span>}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {tab === 'grants' && (
                  <div className="space-y-4" data-testid="conv-tab-grants">
                    <div className="space-y-2 rounded-lg border border-[var(--border-color)] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="flex items-center gap-1.5 text-xs font-semibold">
                          <ShieldAlert size={14} /> Remembered Tool Approvals ({conv.grants.length})
                        </h4>
                        {conv.grants.length > 0 && !confirmRevokeAll && (
                          <Button type="button" size="sm" variant="outline" disabled={conv.pending} onClick={() => setConfirmRevokeAll(true)}>
                            Revoke all
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Tools granted temporary "remember in this chat" approval (`memory.grants`). Revoking forces the Engine to ask again before running the tool.
                      </p>
                      {confirmRevokeAll && (
                        <div className="flex items-center justify-between gap-2 rounded border border-[var(--border-color)] bg-[var(--bg-secondary)] p-2 text-xs">
                          <span>Revoke all remembered tool approvals for this chat?</span>
                          <div className="flex gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              disabled={conv.pending}
                              onClick={async () => {
                                if (await conv.revokeGrant()) setConfirmRevokeAll(false);
                              }}
                            >
                              Confirm revoke all
                            </Button>
                            <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmRevokeAll(false)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                      {conv.grants.length === 0 ? (
                        <p className="text-xs text-[var(--text-muted)] italic">No active remembered tool approvals for this chat.</p>
                      ) : (
                        <ul className="space-y-1.5" aria-label="Remembered tool approvals">
                          {conv.grants.map(grant => (
                            <li
                              key={grant.tool}
                              data-testid={`conv-grant-${grant.tool}`}
                              className="flex items-center justify-between gap-2 rounded border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2 text-xs"
                            >
                              <div>
                                <code className="font-mono font-semibold">{grant.tool}</code>
                                <span className="ml-2 text-[var(--text-muted)]">{grant.minutes_left} min remaining</span>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={conv.pending}
                                onClick={() => void conv.revokeGrant(grant.tool)}
                              >
                                Revoke
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="space-y-2 rounded-lg border border-[var(--border-color)] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="flex items-center gap-1.5 text-xs font-semibold">
                          <Download size={14} /> Export Engine Conversation Log
                        </h4>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          data-testid="conv-export-btn"
                          disabled={conv.pending}
                          onClick={() => void handleExport()}
                        >
                          {conv.pending ? 'Exporting…' : 'Export JSON'}
                        </Button>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Exports the Engine's verified <code>cluaiz-chat-export</code> (v1) event log and indexed cards for this chat. External attachment blobs, model weights, saved disk KV caches, and global notes are not included.
                      </p>
                      {conv.lastExport && (
                        <div className="rounded border border-[var(--border-color)] bg-[var(--bg-secondary)] p-2 text-xs" data-testid="conv-export-summary">
                          Exported <code>{conv.lastExport.format}</code> v{conv.lastExport.version} for <code>{conv.lastExport.chat_id}</code>: {conv.lastExport.events.length} events and {conv.lastExport.cards.length} cards.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </div>
    </Dialog>
  );
}

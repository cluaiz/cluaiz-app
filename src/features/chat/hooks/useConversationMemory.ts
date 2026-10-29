import { useCallback, useEffect, useRef, useState } from 'react';
import {
  chatHistoryApi,
  type ConversationCard,
  type ConversationEvent,
  type ConversationExportResponse,
  type ConversationIndexResponse,
  type ConversationItemResponse,
  type ConversationSearchHit,
  type ConversationSearchResponse,
  type ConversationSearchScope,
  type ConversationToolGrant,
} from '../../../api/engine/chat';
import { errorMessage } from '../../../api/client/errors';
import { useConnectionStore } from '../../../store/engine/useConnectionStore';

interface Options {
  open: boolean;
  chatId?: string | null;
  privateChat?: boolean;
}

export interface SearchFilters {
  query: string;
  scope?: ConversationSearchScope;
  within_hours?: number;
  from?: string;
  to?: string;
}

type SearchHit = ConversationSearchHit & { scoreKind?: 'keyword' };
type SearchResult = Omit<ConversationSearchResponse, 'results'> & { results: SearchHit[] };

interface State {
  key: string;
  index: ConversationIndexResponse | null;
  events: ConversationEvent[];
  eventsTotal: number;
  skippedLines: number;
  nextFromSeq: number | null;
  grants: ConversationToolGrant[];
  searchResult: SearchResult | null;
  activeItem: ConversationItemResponse | null;
  lastExport: ConversationExportResponse | null;
  loading: boolean;
  searching: boolean;
  itemLoading: boolean;
  pending: boolean;
  error: string | null;
  searchError: string | null;
  message: string | null;
}

const empty = (key: string): State => ({
  key,
  index: null,
  events: [],
  eventsTotal: 0,
  skippedLines: 0,
  nextFromSeq: null,
  grants: [],
  searchResult: null,
  activeItem: null,
  lastExport: null,
  loading: false,
  searching: false,
  itemLoading: false,
  pending: false,
  error: null,
  searchError: null,
  message: null,
});

/** Supplements Engine `memory.search` with card keyword/entity matches so single-word queries (e.g. "aryan") resolve in-chat. */
export function matchCardsForQuery(
  cards: ConversationCard[],
  query: string,
  existingHits: ConversationSearchHit[],
  withinHours?: number
): SearchHit[] {
  const terms = Array.from(new Set(query.toLowerCase().split(/[^\p{L}\p{N}_.-]+/u).filter(Boolean)));
  if (terms.length === 0 || cards.length === 0) return existingHits;
  const seen = new Set(existingHits.map(hit => hit.ref));
  const cutoffMs = withinHours && withinHours > 0 ? Date.now() - withinHours * 3600 * 1000 : null;
  const extras: SearchHit[] = [];

  for (const card of cards) {
    const ref = `m:${card.pos}`;
    if (seen.has(ref) || card.trivial) continue;
    if (cutoffMs !== null && card.ts) {
      const tsMs = Date.parse(card.ts);
      if (Number.isFinite(tsMs) && tsMs < cutoffMs) continue;
    }
    const ownTokens = [
      ...(card.keywords ?? []),
      ...(card.files ?? []),
      ...(card.tools ?? []),
      ...(card.entities?.files ?? []),
      ...(card.entities?.numbers ?? []),
      ...(card.entities?.quoted ?? []),
      ...(card.entities?.urls ?? []),
    ].map(item => String(item).toLowerCase());

    const enrichText = [
      ...(card.enrichment?.keywords ?? []),
      card.enrichment?.title ?? '',
      card.enrichment?.summary ?? '',
      card.enrichment?.motive ?? '',
    ]
      .join(' ')
      .toLowerCase();

    const ownMatched: string[] = [];
    const enrichMatched: string[] = [];
    for (const term of terms) {
      if (ownTokens.some(tok => tok === term || tok.includes(term))) {
        ownMatched.push(term);
      } else if (enrichText.includes(term)) {
        enrichMatched.push(term);
      }
    }
    const why = [...ownMatched, ...enrichMatched];
    if (why.length === 0) continue;
    const score = Number(
      (ownMatched.length * 1.5 + enrichMatched.length * 0.8 + (card.importance ?? 0.2)).toFixed(2)
    );
    extras.push({ ref, score, why, card, scoreKind: 'keyword' });
  }

  extras.sort((a, b) => b.score - a.score || b.card.pos - a.card.pos);
  return [...existingHits, ...extras];
}

/** Scoped conversation memory (`memory.*`) for the active saved chat; switching chat or Engine aborts stale requests. */
export function useConversationMemory({ open, chatId, privateChat = false }: Options) {
  const connection = useConnectionStore(state => `${state.protocol}:${state.getBaseUrl()}`);
  const key = JSON.stringify([connection, chatId || null, privateChat]);
  const enabled = open && Boolean(chatId) && !privateChat;
  const live = useRef({ key, enabled });
  live.current = { key, enabled };
  const readCtrl = useRef<AbortController | null>(null);
  const searchCtrl = useRef<AbortController | null>(null);
  const actionCtrl = useRef<AbortController | null>(null);
  const revision = useRef(0);
  const [state, setState] = useState<State>(() => empty(key));
  const current = state.key === key && enabled ? state : empty(key);
  const currentRef = useRef(current);
  currentRef.current = current;

  const refresh = useCallback(async (): Promise<void> => {
    if (!enabled || !chatId || actionCtrl.current) return;
    readCtrl.current?.abort();
    const controller = new AbortController();
    const version = ++revision.current;
    readCtrl.current = controller;
    const valid = () =>
      !controller.signal.aborted &&
      live.current.enabled &&
      live.current.key === key &&
      revision.current === version;
    setState(prev => ({
      ...(prev.key === key ? prev : empty(key)),
      loading: true,
      error: null,
      message: null,
    }));
    try {
      const [index, eventsPage, grantsRes] = await Promise.all([
        chatHistoryApi.getIndex(chatId, controller.signal),
        chatHistoryApi.getEvents({ chat_id: chatId, from_seq: 1, limit: 200 }, controller.signal),
        chatHistoryApi.getGrants(chatId, controller.signal),
      ]);
      if (!valid()) return;
      setState(prev => ({
        ...(prev.key === key ? prev : empty(key)),
        index,
        events: eventsPage.events,
        eventsTotal: eventsPage.total,
        skippedLines: eventsPage.skipped_lines,
        nextFromSeq: eventsPage.next_from_seq,
        grants: grantsRes.grants,
        loading: false,
        error: null,
      }));
    } catch (failure) {
      if (valid()) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: errorMessage(failure),
        }));
      }
    }
  }, [enabled, chatId, key]);

  useEffect(() => {
    if (enabled) void refresh();
    else setState(empty(key));
    return () => {
      revision.current++;
      readCtrl.current?.abort();
      searchCtrl.current?.abort();
      actionCtrl.current?.abort();
      actionCtrl.current = null;
    };
  }, [refresh, enabled, key]);

  const loadMoreEvents = useCallback(async (): Promise<void> => {
    const snapshot = currentRef.current;
    if (!enabled || !chatId || snapshot.loading || snapshot.pending || snapshot.nextFromSeq === null) return;
    readCtrl.current?.abort();
    const controller = new AbortController();
    const version = ++revision.current;
    readCtrl.current = controller;
    const valid = () =>
      !controller.signal.aborted &&
      live.current.enabled &&
      live.current.key === key &&
      revision.current === version;
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const page = await chatHistoryApi.getEvents(
        { chat_id: chatId, from_seq: snapshot.nextFromSeq, limit: 200 },
        controller.signal
      );
      if (!valid()) return;
      setState(prev => ({
        ...prev,
        events: [...prev.events, ...page.events],
        eventsTotal: page.total,
        skippedLines: page.skipped_lines,
        nextFromSeq: page.next_from_seq,
        loading: false,
      }));
    } catch (failure) {
      if (valid()) setState(prev => ({ ...prev, loading: false, error: errorMessage(failure) }));
    }
  }, [enabled, chatId, key]);

  const runSearch = useCallback(async (filters: SearchFilters): Promise<void> => {
    if (!enabled || !chatId) return;
    const trimmed = filters.query.trim();
    if (!trimmed) return;
    searchCtrl.current?.abort();
    const controller = new AbortController();
    searchCtrl.current = controller;
    const valid = () => !controller.signal.aborted && live.current.enabled && live.current.key === key;
    setState(prev => ({ ...prev, searching: true, itemLoading: false, searchError: null, activeItem: null }));
    try {
      const scope = filters.scope ?? 'chat';
      const result = await chatHistoryApi.search(
        {
          chat_id: chatId,
          query: trimmed,
          scope,
          ...(filters.within_hours ? { within_hours: filters.within_hours } : {}),
          ...(filters.from ? { from: filters.from } : {}),
          ...(filters.to ? { to: filters.to } : {}),
        },
        controller.signal
      );
      if (!valid()) return;
      const cards = currentRef.current.index?.cards ?? [];
      const merged: SearchResult =
        result.scope === 'chat'
          ? {
              ...result,
              results: matchCardsForQuery(cards, trimmed, result.results, filters.within_hours),
            }
          : result;
      setState(prev => ({ ...prev, searchResult: merged, searching: false, searchError: null }));
    } catch (failure) {
      if (valid()) {
        setState(prev => ({
          ...prev,
          searchResult: null,
          searching: false,
          searchError: errorMessage(failure),
        }));
      }
    }
  }, [enabled, chatId, key]);

  const inspectItem = useCallback(async (ref: string): Promise<void> => {
    if (!enabled || !chatId) return;
    searchCtrl.current?.abort();
    const controller = new AbortController();
    searchCtrl.current = controller;
    const valid = () => !controller.signal.aborted && live.current.enabled && live.current.key === key;
    setState(prev => ({ ...prev, itemLoading: true, searching: false, searchError: null }));
    try {
      const item = await chatHistoryApi.getItem(chatId, ref, controller.signal);
      if (valid()) setState(prev => ({ ...prev, activeItem: item, itemLoading: false }));
    } catch (failure) {
      if (valid()) setState(prev => ({ ...prev, itemLoading: false, searchError: errorMessage(failure) }));
    }
  }, [enabled, chatId, key]);

  const revokeGrant = useCallback(async (tool?: string): Promise<boolean> => {
    if (!enabled || !chatId || actionCtrl.current) return false;
    const controller = new AbortController();
    actionCtrl.current = controller;
    const valid = () => !controller.signal.aborted && live.current.enabled && live.current.key === key;
    setState(prev => ({ ...prev, pending: true, error: null, message: null }));
    try {
      const revoked = await chatHistoryApi.revokeGrants(chatId, tool, controller.signal);
      if (!valid()) return false;
      const freshGrants = await chatHistoryApi.getGrants(chatId, controller.signal);
      if (!valid()) return false;
      setState(prev => ({
        ...prev,
        grants: freshGrants.grants,
        pending: false,
        message: tool
          ? `Revoked tool permission "${tool}" (${revoked.removed} removed).`
          : `Revoked remembered tool permissions (${revoked.removed} removed).`,
      }));
      return true;
    } catch (failure) {
      if (valid()) setState(prev => ({ ...prev, pending: false, error: errorMessage(failure) }));
      return false;
    } finally {
      if (actionCtrl.current === controller) actionCtrl.current = null;
    }
  }, [enabled, chatId, key]);

  const exportConversation = useCallback(async (): Promise<ConversationExportResponse | null> => {
    if (!enabled || !chatId || actionCtrl.current) return null;
    const controller = new AbortController();
    actionCtrl.current = controller;
    const valid = () => !controller.signal.aborted && live.current.enabled && live.current.key === key;
    setState(prev => ({ ...prev, pending: true, error: null, message: null }));
    try {
      const exported = await chatHistoryApi.exportChat(chatId, controller.signal);
      if (!valid()) return null;
      setState(prev => ({
        ...prev,
        lastExport: exported,
        pending: false,
        message: `Engine chat export ready (${exported.events.length} events, ${exported.cards.length} cards).`,
      }));
      return exported;
    } catch (failure) {
      if (valid()) setState(prev => ({ ...prev, pending: false, error: errorMessage(failure) }));
      return null;
    } finally {
      if (actionCtrl.current === controller) actionCtrl.current = null;
    }
  }, [enabled, chatId, key]);

  return {
    ...current,
    connection,
    refresh,
    loadMoreEvents,
    runSearch,
    inspectItem,
    clearActiveItem: () => setState(prev => ({ ...prev, activeItem: null })),
    revokeGrant,
    exportConversation,
  };
}

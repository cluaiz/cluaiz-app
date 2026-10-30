# Component: chat generation, controls and context

## Technical specification

- **Purpose:** one chat-domain adapter for existing App/extension consumers, sharing transport and SSE parser owners.
- **Generation:** POST /v1/chat/completions retains its dedicated JSON/SSE API; it is not moved into CEP.
- **Controls/context:** chat.cancel, chat.skip_reasoning and chat.telemetry use authenticated callCep. Features do not construct envelopes or retired URLs.
- **Saved Engine history & conversation memory:** `history.ts` and `history.types.ts` own `chatHistoryApi` over CEP `memory.*`: `getEvents` (`memory.events`), `getIndex` (`memory.index`), `search` (`memory.search`), `getItem` (`memory.item`), `exportChat` (`memory.export`), `importChat` (`memory.import`), `getGrants` (`memory.grants`), `revokeGrants` (`memory.revoke_grants`), and `deleteChat` (`memory.delete`). `memory.search` normalizes both per-chat card hits (`scope: 'chat'`) and cross-chat formatted text (`scope: 'workspace' | 'all'`), while `memory.item` checks that `m:<position>` matches `card.pos`. `memory.import` is an external-mode RAM replacement (`storage: 'external'`, max 50,000 events); default App chats use `storage: 'engine'` so the Engine persists event logs and `NoteStore` entries durably on disk. App files/fallback storage remain separate stages coordinated by the App store; `kv.delete` remains the cache-only control in `chatMemoryApi`.
- **Context inspection & idle jobs:** `context.api.ts` and `context.types.ts` own `contextApi` over CEP `context.*`: `preview` (`context.preview`), `listReports` (`context.reports`), `getReport` (`context.report`), and `getJobs` (`context.jobs`). `context.preview` is a deliberate dry-run preflight that can load the model for tokenization without generating a response; retained context reports (`context.reports` / `context.report`) live in Engine RAM (newest 20 per chat) until restart.
- **Transport:** explicit HTTP or desktop native IPC remains below this module. No speed, shared-memory or packaged-desktop claim follows from migration.

## Architectural flow

```mermaid
flowchart TD
    UI["Existing chat UI / store / extension service"] --> A["chatApi"]
    A --> G["Dedicated completions / existing SSE parser"]
    G --> ID["One domain stream-id decoder"]
    ID --> O["Request-owned controller and actual Engine id"]
    O --> C["Cancel / skip through chatApi"]
    C --> P["Shared callCep / transport"]
    A --> T["Context response validation"]
    T --> P
    P --> E["Engine controls / tool context query"]
    UI --> H["chatHistoryApi / memory.*"]
    H --> P
    UI --> X["contextApi / context.*"]
    X --> P
```

## API contract

| App call | Contract |
|---|---|
| createCompletion / streamCompletion | Existing messages/request; stream false/true on dedicated route |
| streamCompletion.onStreamId | Actual SSE id/stream_id; one decoder serves core and domain store |
| cancelStream | chat.cancel; validate matching id and cancelled acknowledgement |
| skipReasoning | chat.skip_reasoning; matching id/skip_requested, or real refusal |
| getContextTelemetry | chat.telemetry; App session_id maps once to chat_id; optional model/signal |
| chatHistoryApi.getEvents / getIndex / search / getItem / exportChat / getGrants / revokeGrants / deleteChat | memory.events, memory.index, memory.search, memory.item, memory.export, memory.grants, memory.revoke_grants, memory.delete |
| contextApi.preview / listReports / getReport / getJobs | context.preview, context.reports, context.report, context.jobs |

- **Identity:** no active Engine id until one arrives. Earlier cancellation only aborts its owned local request; no timestamp-generated id is sent.
- **Ownership:** superseded domain-store callbacks/finalizers cannot replace newer stream content/id/controller. Core uses the same decoder.
- **Cancellation:** local abort is immediate; Engine acknowledgement is separate. stream_not_found may mean completion raced the control. Other domain-store failures remain visible. Acknowledgement is not a native cancellation-latency benchmark.
- **Reasoning:** native reasoning control must be enabled/supported. Thinking-off/unsupported streams return reasoning_unavailable; no fake skipped success.

## Context and async boundaries

- **Shared types:** context/item/group DTOs live in chat.types.ts and are re-exported by the UI hook for existing imports, not duplicated in both layers.
- **Validation:** model/chat/session identity, nested telemetry, integer counts, percentages, groups/items and byte measurement are checked. Invalid data does not become plausible empty success. Wire item names supply the existing UI id.
- **Zero:** zero context/tokens remain zero; touched paths no longer invent4096/32 fallbacks or flatten results into retired max_context/current_usage fields.
- **Measurements:** chat.telemetry computes tool context without supplied prompt/history. Its message counts are not a measured transcript. Existing local text-length estimates remain estimates; explicit later SSE totals are retained over an older query.
- **Lifecycle:** new reads abort predecessors; session/model/connection and snapshot versions guard late replies. Unmount aborts its read. Catalog enrichment uses the shared components API.

## Files, failure and remaining work

- **chat.api.ts:** shared control validation, context projection and stream-id callback; original code/data errors propagate.
- **chat.endpoints.ts:** dedicated generation URL only; retired control/context URLs removed.
- **chat.store.ts:** domain stream/context state. Core/send hooks retain their existing session/message responsibilities; no new persistence system is introduced.
- **History failure boundary:** deletion is sequential across Engine and App stores. A failed reply can follow partial Engine cleanup; do not replay automatically or claim rollback. Shared Engine blobs stay by contract. The adapter validates the Engine acknowledgment, not physical erasure of every underlying ledger/report file. Real Engine deletion acceptance remains separate from controlled adapter tests.
- **Remaining:** packaged-native/other-OS acceptance and broader API acceptance. Pre-existing presentation heuristics/local estimates are not certified as exact tokenization. Not every App API is migrated by this change.

## Verification

```text
node --test test/chat_deletion.test.cjs test/cep_chat.test.cjs test/cep_tools.test.cjs
```

Actual adapters/store tests cover dedicated generation, real ids, control acknowledgement/refusal, malformed/zero context, abort and supersession. Existing chat/send/extension-stream/native-transport regressions run through the documented test bundling workflow. An isolated browser exercises the real React hook with controlled transport.

Live proof uses one bounded temporary request, no saved chat id/config writes, and controls only the id returned for its own stream. It verifies cancellation acknowledgement and unsupported-reasoning refusal, not all models, another OS, cancellation latency or packaged native UI acceptance.

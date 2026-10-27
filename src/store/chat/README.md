# Component: Chat state

## Technical specification

- **Purpose:** own the App's existing chat catalog, messages, selection and message mutations. Extension chats use this same owner.
- **Platform support:** shared TypeScript state. ChatStorageManager selects the existing desktop/browser driver; platform persistence acceptance is separate from module tests.
- **Reuse:** UI and trusted bundled extension adapters call the same actions. This directory creates no second database or Engine protocol.

## Architectural flow

```mermaid
flowchart TD
  UI["Existing chat UI"] --> S["useChatStore"]
  M["App-owned extension session adapter"] --> S
  S --> P["Existing ChatStorageManager"]
  S --> R["One deletion owner / in-flight deduplication"]
  R --> E["chatHistoryApi / acknowledged memory.delete"]
  E --> DQ["Await both storage deletions and catalog pruning"]
  DQ --> V["Remove entry / selected route only after acknowledgment"]
  P --> D["Existing primary / fallback drivers"]
  D --> C["Same catalog, metadata and messages"]
  C --> H["Catalog hydration / lazy message loading"]
  H --> S
```

## Interface and files

- **`types.ts`:** existing ChatMessage, ChatSession and ChatStore declarations, moved out of the oversized store without changing their import compatibility. `CreateChatSessionOptions` adds optional `activate` and package ownership.
- **`useChatStore.ts`:** actions, selection and existing save hooks. It re-exports ChatMessage/ChatSession so existing imports keep working. `createNewSession(title, options?)` retains default activation; `activate:false` keeps current selection and URL. Optional `extensionId` is copied into existing index/metadata and restored during hydration.
- **`loadMessages(id)`:** loads through the existing manager without selecting a chat. It refuses missing saved history when the index records messages. A delayed load cannot restore a deleted session or replace a newer in-memory message array. `switchSession` reuses this loader and still owns its loading indicator/route.
- **`deletion.ts`:** shared deletion coordinator for ordinary/extension-owned saved sessions. `deleteSession(id)` returns `Promise<boolean>`: true after Engine history acknowledgment and App primary/fallback cleanup; false on refusal/error, leaving the entry and reporting an existing toast. Duplicate clicks share one operation. It refuses an actively streaming chat and rechecks connection generation/session identity between stages. Bulk callers stop on a configured-connection change. It does not grant extensions new deletion capabilities.
- **Existing preference/voice/highlight stores:** keep their existing responsibilities; this session slice does not redesign them or add a new audio player.

## Ownership and lifecycle

The global `activeSessionId` is the user's current selection. Creating a extension
chat does not change it. The existing single `streamingSessionId` continues to
represent the App's one active chat answer; independent saved sessions do not imply
parallel inference. The extension adapter checks grants/handles/package ownership
before actions and binds tokens to its own chat.

Main App UI access remains the user's access. `extensionId` is App metadata, not an
Engine authentication token or a sandbox. Existing chats without this field remain
ordinary chats. Metadata fields are optional and require no new storage format.

## Persistence and failure behavior

The same catalog and JSONL message formats and runtime driver selection remain.
Normal user/assistant save actions are reused. Incognito chats are excluded from
persistence. Existing asynchronous/best-effort writes do not become a transaction
or new durability guarantee. Deletion flushes a pending message timer, awaits its
storage stages, and prevents stale queued saves from resurrecting a completed
deletion. Engine or storage errors may occur after earlier stages changed data:
the retained entry/error is a retry handle, not a promise of rollback or readable
history after partial failure. Incognito cleanup never writes App history to disk.
Seven isolated real-browser IndexedDB checks cover transactions/catalog/assets;
real Engine memory deletion, native filesystem and power-loss acceptance remain
separate. The Engine's `memory.delete` acknowledgment does not expose counts for
every internal store and is not a forensic erasure guarantee.

SDK cancellation can finish before underlying cleanup. Partial/error turns stay
visible; existing history selection omits failed turns. Closing the extension ends
its request lifetime, not its saved chat. Extension ownership/grants remain with
the existing SDK/session adapters; this repair does not expose a new guest API.

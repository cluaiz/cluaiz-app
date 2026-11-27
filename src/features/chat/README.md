# Component: chat workspace, AI Memory, Conversation Memory, and Context Diagnostics

## Technical specification

- **Purpose:** existing chat conversations, streaming and workspace split view;
  the AI Memory dialog manages durable Engine facts/preferences (`notes.*`),
  the Conversation Memory dialog inspects per-chat recall, event log, tool grants,
  and export (`memory.*`), and the Context Diagnostics dialog inspects retained
  preflight reports, dry-run context previews, and idle indexer jobs (`context.*`).
- **Entry:** the right-click context menu (`GlobalChatContextMenu` — `CHAT OPTIONS`
  with `AI Memory`, `Conversation Memory`, `Context Diagnostics`, `Archive` /
  `Unarchive`, `Close chat`, and `Delete Chat`) in `ChatWorkspace`, plus the
  `Context` button inside `ConversationMemoryPanel` and the
  `Inspect full context & tools report` button inside `ContextWindowPopover`.
  In the top-right corner of `ChatWorkspace`, only `PrivateModeToggleButton` is
  rendered on the empty New Chat screen (`messages.length === 0`), with no
  floating memory buttons. The unused `ChatHeader` is not a second entry or state owner.
- **Platform:** web and desktop use the same React UI and shared API client.
  Packaged desktop acceptance is separate from browser/adapter evidence.

## Architectural flow

```mermaid
flowchart LR
  W["ChatWorkspace: current chat, private flag, project root"] --> P["AiMemoryPanel: form, filters and explicit actions"]
  P --> H["useAiMemory: context lifetime, cancellation and acknowledged state"]
  H --> A["Shared notesApi"]
  A --> C["Existing authenticated CEP client"]
  C --> N["Engine NoteStore"]
  W --> CM["ConversationMemoryPanel: search, source item, map, events, grants, export"]
  CM --> CH["useConversationMemory"]
  CH --> HA["chatHistoryApi / memory.*"]
  HA --> C
  W --> CD["ContextDetailsPanel: retained reports, explicit preview, idle jobs"]
  CD --> CX["useContextDetails"]
  CX --> CA["contextApi / context.*"]
  CA --> C
```

## Owners and lifecycle

- **ChatWorkspace.tsx:** keeps existing chat/message/history owners. Supplies real
  session id and active project root to the dialog. Private mode blocks durable
  notes reads/writes. Extension-bound chat surfaces do not expose this owner UI.
- **components/AiMemoryPanel.tsx:** theme-aware existing Dialog, Button, Input,
  Badge, AlertBanner and dropdown primitives; no notebook state or parallel store.
  Add in chat/workspace/global scope; list/search/filter; proposed confirmation;
  pin/unpin; explicit inactive confirmation; status/origin/time/source details.
  Search/filter typing is local, not polling. Escape closes; keyboard focus wraps
  and returns to the opener. Full note content renders as escaped text.
- **hooks/useAiMemory.ts:** read once on open and on chat/Engine/workspace change;
  explicit Refresh otherwise. Abort and context identity prevent late results
  replacing another scope. Closing releases visible note state. A busy reference
  serializes mutations, including rapid repeated submits.
- **api/engine/notes:** request/record validation has one owner. It retains
  supersession history and checks returned ids/scopes/statuses. The UI uses actual
  acknowledgment before showing saved state.

- **components/ConversationMemoryPanel.tsx & hooks/useConversationMemory.ts:**
  scoped to connection, chat id, and private flag. Reads `memory.index`,
  `memory.events`, and `memory.grants` on open/refresh; runs `memory.search` only
  on deliberate form submit and supplements chat-scoped results with `matchCardsForQuery`
  over loaded `index.cards` so single-word queries (such as a user's name) resolve
  even when Engine recall requires 2+ shared terms; displays indexed messages with
  their primary `card.keywords` on the default tab; inspects `memory.item` by `m:<pos>`
  without equating Engine message positions with local UI message ids; revokes tool
  grants via `memory.revoke_grants`; exports `cluaiz-chat-export` v1 JSON via `memory.export`.
- **hooks/useChatSend.ts & core/engine.ts:** saved (non-private) chats pass
  `history_mode: 'adaptive'` on `/v1/chat/completions` so the Engine retains recent
  turns in the prompt, recalls older turns from its index, and offers memory tools
  (`recall`, `open_memory`, `remember`). The connected App shell long-polls `system.events`.
  While a local turn waits for its model, the existing processing label shows that model's
  load message and reported percentage. When loading ends or no matching event exists,
  the normal Chat label applies. Final `engine.load` placement reports still use `ModelLoadCard.tsx`.
  Run `node --test test/cep_model_load_ui.test.cjs` to check the label against Engine event sequences.
- **approvals.ts, components/ApprovalTabs.tsx, components/PermissionApprovalCard.tsx:**
  a waiting call is a card above the input (Approve, Allow in chat, Reject); the chat notes
  each call of an answer and its outcome in order (`messageApprovals`), and a call still
  waiting when its turn ends is marked expired.
- **components/ContextDetailsPanel.tsx & hooks/useContextDetails.ts:**
  reads `context.jobs` and (when a non-private chat id exists) `context.reports` /
  `context.report` on open/refresh. Explains that retained reports live in Engine
  RAM (newest 20 per chat) until restart. Runs `context.preview` only on explicit
  user click with disclosure that it may load the model for tokenization.

## Scope and failure behavior

- List applies only the current chat, actual returned Engine workspace and global
  records. An App project/Engine workspace mismatch disables writing; the panel
  never changes Engine workspace automatically. Without a chat id, chat notes are
  neither displayed nor offered as a creation scope.
- A pre-write read checks workspace and current record. Workspace creation is
  still owned by the Engine's current-workspace contract, not an atomic App scope
  transaction; there is no client-only guarantee against another client changing
  workspace between requests. Unexpected acknowledgments surface as errors.
- No optimistic Saved, auto retry or rollback promise. Failed/uncertain results
  require Refresh before another write. Closing stops observing; the Engine can
  still finish a submitted mutation. Only pre-execution auth retry belongs to the
  shared transport.
- A proposed note and a pinned note are distinct. Confirming can supersede a live
  note on the same subject. Mark inactive keeps history. Existing APIs expose no
  text-edit or physical-delete operation, so the UI does not invent them.

## Boundaries and evidence

Memory inspection cancels the previous search/source request when the user changes
operation, clearing the cancelled operation's loading flag. Local keyword matches
are labelled separately from Engine BM25 hits. Both use the original Engine
`m:<pos>` reference; no App message-id mapping is invented.

The explicit text preview reads current model, thinking effort and tool chips
from the mounted composer through `useChatPreviewOptions`. Send and Preview reuse
`chatComposerOptions` and `chatHistoryOptions`; saved chats use adaptive history.
Preview includes saved conversation media but excludes unsent attachments, as
disclosed in its UI. Reading composer options does not issue requests or persist
another settings copy. An empty preview sends no synthetic user prompt.

- Saved disk KV caches remain in `Settings -> Chats & History -> Model Memory (Engine)`
  via `chatMemoryApi`. External-mode memory import/events (`memory.import`) and
  model tool-use policy remain Phase D. Opening `AiMemoryPanel`,
  `ConversationMemoryPanel`, or `ContextDetailsPanel` loads no model automatically;
  only clicking `Run Preview` inside `ContextDetailsPanel` invokes `context.preview`.
- `test/cep_notes.test.cjs` and `test/cep_conversation_context.test.cjs` cover
  actual adapter contracts. Integration proof records controlled rendered-panel
  race/failure/private-mode checks and isolated release-Engine read/write journeys.

## Compaction

`utils/compactChat.ts`: the model summarizes the chat (a non-streaming completion with
`temporary_chat: "lite"`, thinking off, no tools) and a `compaction` card holding the summary is
added to the chat (`CompactionCard`, expandable). `buildChatHistory` then sends that summary plus
the messages after it; the earlier messages stay visible but are no longer sent. It runs from
"Compact now" in the context popover, or on its own when an answer leaves the context
`AUTO_COMPACT_PERCENT` (80%) full and at least 4 messages came after the last compaction
(`ChatWorkspace`). A failed compaction leaves the full conversation in use.

## Chat top bar, settings window, approvals and live system

The model picker sits in the chat's top bar (`ChatTopBar`, left): `ChatInput` renders the same picker into it
through a portal, so there is one picker and one state. Extension chats have no top bar and keep it in the
input.

`ChatSettingsDialog` opens from "Chat settings" at the bottom of the input's + menu, and from the settings
icon in the effort popover. It uses the shared `Dialog`, `Slider`, `ToggleSwitch` and `AccordionGroup`:
Instructions (sent as the first system message), Creativity (temperature) and Answer length (max_tokens),
the thinking budget (an exact number of tokens, and the text written when it runs out; both are the saved
Engine settings the effort button uses, so they apply to every chat), and under Advanced top_p, top_k,
min_p, the three penalties and "Same answer every time" (a fixed seed). An untouched slider shows "Auto" and
is not sent, so the Engine's default applies. The effort level stays as the button in the input; the old
Effort entry of the + menu, its custom-token and budget-message fields, are now this window. An earlier side
panel with number boxes was replaced: the owner found it crowded and hard for a new user.

The approval button in the input (`ChatApprovalPicker`) sets this chat's `approval_mode`: As in Settings
(not sent), Ask every time (`strict`), Auto (`sandboxed`), Full access (`full_access`). The Engine
(`chat_security_mode`, commit 8906e9d4) never lets a chat be looser than the mode in Settings, so two chats or
two users on one Engine do not share it.

Live system use sits under the input beside the context meter (`SystemStatusPopover`, opened by hover or
click like the context popover): RAM and VRAM in percent, each GPU, and the loaded model's plan, from
`system.live` and `system.ps` every 2 s (`useLiveSystem`) in three modes: Always, While open (default),
Off. The Engine reports no CPU or GPU use percent and not its own RAM, and the popover says so.

Checked on 2026-11-23 against the test Engine (port 8011) with Qwen3.5 0.8B: Creativity 0.5, an instruction
and "Ask every time" sent `{"approval_mode":"strict","temperature":0.5}` with the instruction as the first
system message; no console errors at 1440 px. Test: `node --test test/chat_controls.test.cjs`.

## Chat menu, search and export

The top bar's right side has the chat menu (`ChatTopBar`, three dots, only in a chat with messages):
Search, Select messages (the existing selection mode), Export as Markdown or JSON (`utils/chatExport.ts`,
downloaded with the workspace `downloadFile`), Archive or Unarchive, and Delete chat (asks first).

Search opens in the top bar (`ChatSearchBar`), styled like the sidebar's "Search chats" field, with the filter
button inside it. Typing marks every match in the shown messages at once with the CSS Custom Highlight API
(`::highlight(chat-search)`), so message rendering is not changed. The filter menu (shared `ActionDropdown`,
several at once) narrows to messages with images, documents, code (a ``` block), audio or video, starred
ones, chosen reactions, or a date range (shared `CalendarDropdown`). Messages that do not match are hidden in
place by one style rule on `data-message-index`; Escape or the close button clears it. An earlier version
put search in a popup; the owner wanted it in the header, opened from the menu, so it changed.

Moving a chat to a project is not in the menu yet: the projects store is another task's work that is not
committed.

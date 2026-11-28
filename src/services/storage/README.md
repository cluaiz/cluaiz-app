# Component: App chat storage

## Technical specification

- **Purpose:** preserve the existing saved-chat catalog, metadata, JSONL messages and binary attachments for ordinary and extension-owned chats.
- **Runtime selection:** Desktop and browser both use only EngineFsChatStorageDriver through the selected Engine connection. There is no local fallback (2026-11-28): the silent IndexedDB / desktop-folder copy hid failed Engine reads and writes, so the desktop sidebar showed 1 chat from `%APPDATA%\cluaiz\data` while the Engine workspace held 38. A failed Engine read is now shown in the sidebar with a Try again button. Not taken: keeping the fallback for offline use (two diverging histories are worse than an error).
- **Browser disk location:** workspace-relative data/chats, as in the previous Engine file handler. It is not a fixed user-home path. Workspace selection changes what relative paths refer to; this repair does not migrate/rebase old files or redesign a global storage root.
- **Existing desktop data:** older builds wrote to a separate platform data directory. The shared driver leaves that directory intact. Existing desktop-only records are not imported automatically. The same Engine workspace and authorization are required to see the same shared history in both clients.

## Architectural flow

```mermaid
flowchart TD
    C["Ordinary / extension-owned chat"] --> M["Existing ChatStorageManager"]
    M --> E["Engine filesystem driver (desktop and browser)"]
    E --> F["Shared fsApi / CEP / authenticated transport"]
    F --> D["Engine workspace / data / chats"]
    E --> A["Authenticated binary asset read"]
    A --> U["Existing MIME sniffer / data URI"]
```

## Stored contracts

| Relative file | Ownership and format |
|---|---|
| data/chats/sessions_index.json | Existing SessionsIndex catalog, including extension ownership metadata |
| data/chats/{sessionId}/meta.json | Existing SessionMetadata; id must match the requested session |
| data/chats/{sessionId}/messages.jsonl | One JSON ChatMessage per line, unchanged message serialization |
| data/chats/{sessionId}/assets/{assetId} | Existing binary attachment bytes and saved relative reference |

- **Session handles:** the extension SDK/store still owns session authorization. Driver path validation rejects separator/drive/traversal segments; it is not an extension identity or Engine permission system.
- **Read behavior:** an explicit CEP file_not_found error returns missing/empty data. Disconnection, permission failure, invalid response and invalid catalog/metadata propagate. A failed read cannot initiate EngineFs appendMessage's read/modify/write as if history were empty.
- **Interrupted JSONL:** a malformed trailing line after at least one valid message is skipped. Interior corruption, wholly invalid history and non-UTF-8 history are errors. This is bounded recovery of an interrupted write, not silent recovery of arbitrary corruption.
- **Write behavior:** existing JSON/JSONL encoding and locations remain. appendMessage updates an existing id or appends a new message after a successful read. It remains read/modify/write; concurrent independent clients are not an atomic append transaction.
- **Assets:** saveAsset retains the relative assets/ reference. resolveAssetUrl now reads bytes through fsApi/authentication and returns an existing MIME-sniffed data URI instead of a retired unauthenticated GET URL. No new blob URL cache or lifetime owner is introduced; base64/data URIs still consume memory and are not zero-copy streams.
- **Deletion:** each driver removes the session and prunes its catalog; missing is idempotent. Browser deletion pins absolute directory/catalog paths to the workspace returned at its start, rather than resolving later operations against a newly selected workspace. Scope guards stop later steps after connection invalidation. This cannot cancel a write already accepted or isolate independent clients changing the same catalog.

## File breakdown

- **ChatStorageManager.ts:** Engine-only routing with one in-process write queue. Each save settles before the next write/delete; Engine errors are returned, never replaced by a local copy. Queued operations from an obsolete configured connection are refused. Completed deletions are remembered for this connection lifetime: late catalog saves are filtered and late session writes rejected. This is not a persistent tombstone database or inter-client lock.
- **EngineFsChatStorageDriver.ts:** shared fsApi consumer; JSON/JSONL encoding, missing-file distinction and authenticated attachment resolution. No duplicate URL/auth/CEP implementation.
- **TauriFsChatStorageDriver.ts (no longer used by the manager; kept for its tests until removed):** existing App native commands; deletion strictly reads the catalog, removes the directory, then saves the surviving entries. Errors propagate. These are sequential operations, not one filesystem transaction.
- **IndexedDbChatStorageDriver.ts (no longer used for chat history; extension tests still use it):** deletion removes metadata, messages, matching session asset keys and the catalog entry in one IndexedDB transaction. It resolves on transaction completion and rejects abort/errors. Memory fallback is updated only after that completion; environments without IndexedDB prune memory directly. The database name/schema is unchanged.
- **types.ts:** shared driver and catalog/metadata interfaces. Method comments describe intended caller semantics; current Engine writes do not provide atomic file replacement or inter-client transactions.
- **chatRetention.ts / chatRetentionRunner.ts:** existing policies; the runner awaits actual deletion results, reports successful removals separately from skipped/incomplete ones, protects the current/streaming chat and serializes overlapping sweeps. Settings bulk deletion uses the same store action; a connection change stops the remainder of a bulk action.

## Verification and remaining work

```text
node --test test/chat_deletion.test.cjs test/cep_fs.test.cjs test/cep_history.test.cjs
```

The shared extension-chat regression also executes the actual manager/store/drivers against a controlled CEP transport and checks shared catalog, ownership, restoration and failed-history refusal. Separate release-Engine acceptance seeds legacy-format files in its own workspace and verifies restore/append/assets/deletion there.

The deletion proof additionally uses actual IndexedDB in a disposable browser profile: removal, catalog/attachment retention, restoration and transaction-abort refusal. No real user data is used. This establishes browser transaction behavior, not survival of power loss. Packaged desktop/native commands, other OSes, simultaneous-client writes and real Engine memory deletion remain separate acceptance work. A partial cross-store deletion can leave an entry whose files were partly removed; the App reports incomplete cleanup and allows an explicit retry. No rollback or all-API migration claim follows.

# 🏛️ Cluaiz App — Enterprise API Layer Architecture & Developer Guide

> **Directory:** `src/api/`  
> **Source of Truth:** `cluaiz/api/src/routes.rs` (routes) and `cluaiz/docs/api/cep/openrpc.json` (CEP methods)  
> **Design Pattern:** The 5-File Duck Domain Standard (Stateless API + Reactive Zustand Stores)  
> **Guiding Principle:** Domain Sovereignty, Zero-Khichdi, 100% Type-Safe Contracts, Zero Raw Fetch

---

## 📑 Table of Contents
1. [Architectural Overview (The 2-Pane System)](#1-architectural-overview-the-2-pane-system)
2. [The Unified Transport Pipe (`src/api/client/`)](#2-the-unified-transport-pipe-srcapiclient)
3. [The 5-File Duck Pattern Standard](#3-the-5-file-duck-pattern-standard)
4. [Domain map: what each folder calls on the Engine](#4-domain-map-what-each-folder-calls-on-the-engine)
5. [Tools subsystem (`src/api/engine/tools/`)](#5-tools-subsystem-srcapienginetools)
6. [Developer Usage & Code Examples](#6-developer-usage--code-examples)
7. [Team Workflow for 20–30 Engineers](#7-team-workflow-for-2030-engineers)

---

## 1. Architectural Overview (The 2-Pane System)

To ensure zero naming collisions and enforce clean boundaries across desktop IPC and backend engine daemon calls, the entire networking layer is split into **strictly two panes**:

```
                       ┌──────────────────────┐
                       │   cluaiz-app (UI)    │
                       └──────────┬───────────┘
                                  │
                 ┌────────────────┴────────────────┐
                 ▼                                 ▼
    ┌─────────────────────────┐       ┌─────────────────────────┐
    │  PANE 1: ENGINE APIS    │       │   PANE 2: APP APIS      │
    │  (`src/api/engine/`)    │       │   (`src/api/app/`)      │
    ├─────────────────────────┤       ├─────────────────────────┤
    │ • Target: localhost:8000│       │ • Target: Tauri Desktop │
    │ • Cluaiz Rust Engine    │       │   IPC & Local Client DB │
    │ • Inference, GGUF/ONNX  │       │ • Engine process spawner│
    │ • Hardware & VRAM       │       │ • Window & dialog mgmt  │
    │ • NVMe Fast File System │       │ • Local SQLite/Dexie DB │
    │ • Tools, MCP & Skills   │       │ • Cloud Sync (Future)   │
    │ • Audio & Embeddings    │       │ • User Accounts (Future)│
    └─────────────────────────┘       └─────────────────────────┘
```

### 🚫 The Hard Boundary Laws
1. **Zero Raw Fetch in UI:** Components (`src/features/`) NEVER import `fetch`, `axios`, or write endpoint strings.
2. **Zero Hardcoded URLs:** Every endpoint string MUST reside inside `[domain].endpoints.ts`.
3. **No Direct Third-Party Calls:** HuggingFace, OpenAI, or external provider calls are made by the **Engine daemon**, never directly from the browser window.

---

## 2. The Unified Transport Pipe (`src/api/client/`)

All HTTP, SSE, and IPC calls pass through a centralized transport layer in `src/api/client/`:

- **`http.ts`**: Unified `HttpClient` wrapper:
  - Dynamically resolves `http://localhost:8000` (or configured host/port).
  - Automatically injects `Authorization: Bearer <token>` on every authenticated request.
  - AbortController timeout handling (10-second default).
  - Automatic error envelope parsing and `ApiError` normalization.
- **`sse.ts`**: Dedicated `streamSse()` reader for `/v1/chat/completions` handling real-time token deltas and reasoning chunks.

Chat requests opt into `return_progress:true`. The engine adapter forwards `cluaiz.processing` observations independently of answer tokens; the chat send hook shows the actual stage and attachment name when available. These observations and context reports do not count towards token rate or first-token timing. No percentage is invented when the engine supplies no work count.

When an event refers to a successful attachment in an earlier turn, the label includes `earlier attachment` and that file's name. The current upload keeps its own identity; reading a source file can be followed by encoding an earlier image because successful media remains part of the conversation. Native media context fitting may remove complete old turns when the configured policy allows it. A current file larger than the remaining context is explicitly refused rather than silently shortened.

Structured engine errors and HTTP/stream failures remain visible in their original chat. Failed turns retain their displayed attachments but use the existing `finishReason:error` marker to exclude them from later model context. Legacy unanswered attachment turns and old UI-generated system errors are also excluded, so a new message does not implicitly retry a failed upload. Successful attachments remain in context. The SSE reader reports premature EOF as an error before its single completion notification; user cancellation remains distinct from failure.

PDF/document content is extracted by the engine into text, so a text-only chat model needs no vision projector for a fully extracted document. PDFs requiring OCR need the packaged native PDF/OCR assets in the engine installation. Extraction success does not guarantee that a large document fits the chosen context. Chat/ingest HTTP transport permits configured source bytes plus base64/JSON overhead; oversized requests still fail explicitly, and inference admission has separate limits.
- **`ipc.ts`**: Typed Tauri desktop `invoke()` caller with safe browser fallback mocks.
- **`errors.ts`**: Normalized `ApiError` class and `errorMessage(err)` helper.
- **`status.ts`**: Standardized async state type:
  ```typescript
  export type Status = 'idle' | 'pending' | 'success' | 'error';
  ```

The speech endpoint currently returns JSON with `output.audio_data` as a WAV data URI. `audioApi.speech` converts this envelope to a Blob and preserves structured engine errors; it also accepts a binary audio response. The API explorer passes the same URI to `AudioVisualizer`, which uses the shared Base64 decoder. RIFF form types distinguish WAV from WebP. Default voice selection is omitted from the payload; explicit speech voices use top-level `voice`, with unsupported values still rejected by the engine.

The model dropdown filters declared tasks, not successful native synthesis. Audio8 may therefore be listed while its native AR runtime remains unimplemented; that route returns an explicit error. A package being installed does not establish playable output or speech quality.

---

## 3. The 5-File Duck Pattern Standard

Every feature domain inside `src/api/engine/` is organized with strict 1-to-1 separation:

```text
src/api/engine/[domain]/
├── [domain].endpoints.ts   ← URL constants only (as const)
├── [domain].types.ts       ← Request/Response interfaces (1:1 with Rust structs)
├── [domain].api.ts         ← Pure stateless HTTP caller methods using http.ts
├── [domain].store.ts       ← Reactive Zustand store (data, status, optimistic update & rollback)
└── index.ts                ← Re-exports all 4 files
```

---

## 4. Domain map: what each folder calls on the Engine

The Engine has a few direct routes (chat, embeddings, audio, ingest, model lists, health) and every
other control is a CEP method at `POST /v1/cep` ([client/cep.ts](client/cep.ts); tasks through
[client/cepTask.ts](client/cepTask.ts), which also lists them with `tasks.list`). Each domain's README has the details.

| Folder | Direct routes | CEP methods |
|---|---|---|
| [`system/`](engine/system/) | `/health` | `system.info`, `system.live`, `system.ps`, `system.plan`, `system.exec`, `system.audit` and `system.update_check` ([maintenance.ts](engine/system/maintenance.ts)) |
| [`config/`](engine/config/) | | `config.get`, `config.set` (shared by `permission/`, `inference/`, `llm-optimization/`, `models/`) |
| [`permission/`](engine/permission/) | | `tokens.list/create/revoke`, `approvals.list/approve/reject` |
| [`chat/`](engine/chat/) | `/v1/chat/completions` (SSE) | `chat.cancel`, `chat.skip_reasoning`, `chat.telemetry`, `chat.import_app` ([importApp.ts](engine/chat/importApp.ts)), `context.*`, `memory.*` (history) |
| [`chat-memory/`](engine/chat-memory/) | | `kv.status/delete/clear`, `config.set` (section `kv`) |
| [`models/`](engine/models/) | `/v1/models`, `/api/tags` | `models.list/load/remove/inspect/download`, `models.embedding_room` ([embeddingRoom.ts](engine/models/embeddingRoom.ts)), `fs.read` (metadata files) |
| [`inference/`](engine/inference/) | | `config.get/set` (sections `gguf`, `onnx`) |
| [`llm-optimization/`](engine/llm-optimization/) | | `config.get/set` (section `optimization`) |
| [`storage/`](engine/storage/) | | `storage.status`, `storage.clean` |
| [`fs/`](engine/fs/) | | `fs.*`, `workspace.get/set`; the project's agent files `workspace.index/item/memory/remember/forget` ([projectAgent.ts](engine/fs/projectAgent.ts)) |
| [`audio/`](engine/audio/) | `/v1/audio/speech`, `/v1/audio/transcriptions` | `audio.voices`, `audio.languages` |
| [`memory/`](engine/memory/) | `/v1/embeddings`, `/v1/ingest` | |
| [`notes/`](engine/notes/) | | `notes.list/create/confirm/pin/invalidate/move` |
| [`tools/`](engine/tools/) | | `tools.*`, `chat.tools`, `chat.set_tools` (section 5) |
| [`automation/`](engine/automation/) | | `flows.list/get/validate/save/remove/enable/disable/run/rerun_from/runs/run_get/schema` (Automation's methods, served at the same `/v1/cep`) |
| [`prompts/`](engine/prompts/) | | `prompts.list/get/set/reset/history` |

---

## 5. Tools subsystem (`src/api/engine/tools/`)

One owner per action; the skills, plugins, MCP and components facades delegate to them.

| File | CEP methods |
|---|---|
| [`catalog.ts`](engine/tools/catalog.ts) | `tools.list` |
| [`lifecycle.ts`](engine/tools/lifecycle.ts) | `tools.install`, `tools.remove` (as tasks) |
| [`settings.ts`](engine/tools/settings.ts) | `tools.get_settings`, `tools.set_settings` |
| [`cache.ts`](engine/tools/cache.ts) | `tools.cache`, `tools.clear_cache` |
| [`files.ts`](engine/tools/files.ts) | `tools.files`, `tools.read_file`, `tools.write_file`, `tools.open_file` |
| [`execution.ts`](engine/tools/execution.ts) | `tools.call` |
| [`discover.ts`](engine/tools/discover.ts) | `tools.discover` |
| [`session/`](engine/tools/session/) | `chat.tools`, `chat.set_tools` |

---

## 6. Developer Usage & Code Examples

### 6.1 Using Stateless APIs Directly
If you need a one-off request without reactive global state:
```typescript
import { modelsApi } from '@/api/engine/models';

async function checkModels() {
  const res = await modelsApi.getInstalled();
  console.log('Installed models count:', res.count);
}
```

### 6.2 Consuming Reactive Zustand Stores in UI Components
```tsx
import { useEffect } from 'react';
import { useInferenceStore } from '@/api/engine/inference';

export function GgufSettingsPanel() {
  const { gguf, status, error, load, saveGguf } = useInferenceStore();

  useEffect(() => {
    load();
  }, [load]);

  if (status === 'pending' && !gguf) return <div>Loading hardware settings...</div>;
  if (status === 'error') return <div className="error">{error}</div>;

  return (
    <div>
      <label>GPU Layers</label>
      <input
        type="number"
        value={gguf?.n_gpu_layers ?? 0}
        onChange={(e) => saveGguf({ ...gguf, n_gpu_layers: Number(e.target.value) })}
      />
    </div>
  );
}
```

### 6.3 Calling Tools & Skills APIs
```typescript
import { skillsApi, useSkillsStore, sessionToolsApi } from '@/api/engine/tools';

// Pure API call:
await skillsApi.installSkill('deep-research');

// Reactive Store usage:
const { skills, installSkill, clearCache } = useSkillsStore();
```

---

## Document and speech contracts

`memoryApi.ingest` extracts text/chunks without a model or database persistence. Its result carries `status`, `total_sources` and `processed_sources`; `useMemoryStore` retains partial content with `status:partial` and omission details. Image embeddings use typed image/text parts, float output and optional `keep_alive` minutes. The explorer lists ONNX and GGUF embedding backends; GGUF text compatibility still depends on the engine/model, and images require ONNX. The header and payload store share `endpointUsesModel`, so native extraction cannot inject a rejected model field.

The read-aloud player fetches the actual voice capabilities for each run. Coherent models wait for completed text and buffer one complete WAV before playback; preset voices retain sentence queuing. This trades startup delay for avoiding independent sentence generations/playback underruns within that utterance. Playback rate owns speed once. Model/voice/language/reference changes cancel incompatible synthesis/cache; speed-only changes retain reusable audio. Only pre-output HTTP429 `speech_busy` is retried (four retries, abortable waits); stream errors after delivered audio are never replayed. No realtime, speaker-identity or audible-quality guarantee follows from these controls.

## 7. Team Workflow for 20–30 Engineers

To avoid merge conflicts when 20–30 developers work on this repo:

1. **One Domain Per Developer:**
   - Developer A working on **Audio** touches only `src/api/engine/audio/` and `src/features/audio/`.
   - Developer B working on **Skills** touches only `src/api/engine/tools/skills/`.
2. **Never Edit Other Domains' Files:** Avoid god-stores. If you need data from another domain, read from that domain's store via `useOtherStore.getState().data`.
3. **Adding a New Backend Route (3 Steps):**
   - Step 1: Add path to `[domain].endpoints.ts`.
   - Step 2: Add request/response types in `[domain].types.ts`.
   - Step 3: Add typed method in `[domain].api.ts` using `http.get/post/del`.

## Public catalogue boundary

The catalogue/ API owner reads public website model metadata and the official tools
repository through bounded, credential-free HTTPS requests. Features delegate to
its adapters; only catalogue/public.ts owns those reads. It must never reuse the
Engine authenticated client or receive its Bearer token. Installation remains in
the existing Engine domain APIs/tasks. See [catalogue contract](./catalogue/README.md)
for validation, cache and server-enforced quota boundaries.

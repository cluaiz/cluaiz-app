# 🏛️ Cluaiz App — Enterprise API Layer Architecture & Developer Guide

> **Directory:** `src/api/`  
> **Source of Truth:** `cluaiz/inference-engine/api/src/routes.rs`  
> **Design Pattern:** The 5-File Duck Domain Standard (Stateless API + Reactive Zustand Stores)  
> **Guiding Principle:** Domain Sovereignty, Zero-Khichdi, 100% Type-Safe Contracts, Zero Raw Fetch

---

## 📑 Table of Contents
1. [Architectural Overview (The 2-Pane System)](#1-architectural-overview-the-2-pane-system)
2. [The Unified Transport Pipe (`src/api/client/`)](#2-the-unified-transport-pipe-srcapiclient)
3. [The 5-File Duck Pattern Standard](#3-the-5-file-duck-pattern-standard)
4. [Master Domain Tree & 100% Route Mapping Matrix](#4-master-domain-tree--100-route-mapping-matrix)
5. [The Unified Tools Subsystem (`src/api/engine/tools/`)](#5-the-unified-tools-subsystem-srcapienginetools)
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
- **`ipc.ts`**: Typed Tauri desktop `invoke()` caller with safe browser fallback mocks.
- **`errors.ts`**: Normalized `ApiError` class and `errorMessage(err)` helper.
- **`status.ts`**: Standardized async state type:
  ```typescript
  export type Status = 'idle' | 'pending' | 'success' | 'error';
  ```

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

## 4. Master Domain Tree & 100% Route Mapping Matrix

Every single route declared in `cluaiz/inference-engine/api/src/routes.rs` is mapped below:

| Domain Folder | Backend Route (`routes.rs`) | HTTP Method | API Function (`[domain].api.ts`) | Reactive Store (`[domain].store.ts`) |
|---|---|---|---|---|
| **`system/`** | `/health` | `GET` | `systemApi.getHealth()` | `useSystemStore` |
| | `/info` | `GET` | `systemApi.getSystemInfo()` | |
| | `/v1/system/cmd` | `POST` | `systemApi.executeCommand()` | |
| | `/v1/system/ps` | `GET` | `systemApi.getProcesses()` | |
| | `/v1/system/control` | `GET` | `systemApi.getSystemControl()` | |
| **`permission/`** | `/v1/system/permission` | `GET` | `permissionApi.getPermission()` | `usePermissionStore` |
| | `/v1/system/permission` | `POST` | `permissionApi.updatePermission()` | |
| | `/v1/system/auth/token/generate` | `POST` | `permissionApi.generateAuthToken()` | |
| | `/v1/system/auth/token/revoke` | `POST` | `permissionApi.revokeAuthToken()` | |
| | `/v1/system/permission/pending` | `GET` | `permissionApi.getPendingPermissions()` | |
| | `/v1/system/permission/approve` | `POST` | `permissionApi.approvePermission()` | |
| | `/v1/system/permission/reject` | `POST` | `permissionApi.rejectPermission()` | |
| **`chat/`** | `/v1/chat/completions` | `POST` | `chatApi.createCompletion()` / `streamCompletion()` | `useChatStore` |
| | `/v1/chat/context_telemetry` | `GET` | `chatApi.getContextTelemetry()` | |
| | `/v1/chat/cancel` | `POST` | `chatApi.cancelStream()` | |
| | `/v1/chat/skip-reasoning` | `POST` | `chatApi.skipReasoning()` | |
| **`models/`** | `/v1/models` | `GET` | `modelsApi.getListV1()` | `useModelsStore` |
| | `/v1/models/installed` | `GET` | `modelsApi.getInstalled()` | |
| | `/models/available` | `GET` | `modelsApi.getAvailable()` | |
| | `/hardware` | `GET` | `modelsApi.getHardware()` | |
| | `/models/load` | `POST` | `modelsApi.loadModel()` | |
| | `/models/download` | `POST` | `modelsApi.downloadModel()` | |
| | `/api/tags` | `GET` | `modelsApi.getTags()` | |
| | `/api/pull` | `POST` | `modelsApi.pullModel()` | |
| | `/v1/models/{id}/inspect_raw_header` | `GET` | `modelsApi.inspectHeader()` | |
| | `/v1/models/{id}` | `DELETE` | `modelsApi.deleteModel()` | |
| **`inference/`** | `/v1/system/gguf_config` | `GET` / `POST` | `inferenceApi.getGguf()` / `saveGguf()` | `useInferenceStore` |
| | `/v1/system/onnx_config` | `GET` / `POST` | `inferenceApi.getOnnx()` / `saveOnnx()` | |
| | `/v1/hardware/calibrate` | `POST` | `inferenceApi.calibrateHardware()` | |
| **`llm-optimization/`**| `/v1/optimization/status` | `GET` | `optimizationApi.getStatus()` | `useOptimizationStore` |
| | `/v1/optimization/update` | `POST` | `optimizationApi.update()` | |
| **`storage/`** | `/v1/system/storage/temp_media` | `GET` | `storageApi.getTempMediaStatus()` | `useStorageStore` |
| | `/v1/system/storage/temp_media/clean` | `POST` | `storageApi.cleanTempMedia()` | |
| | `/v1/system/storage/settings` | `GET` / `POST` | `storageApi.getStorageSettings()` / `updateStorageSettings()` | |
| **`fs/`** | `/v1/fs/read` | `POST` | `fsApi.readFile()` | `useFsStore` |
| | `/v1/fs/write` | `POST` | `fsApi.writeFile()` | |
| | `/v1/fs/list` | `POST` | `fsApi.listDir()` | |
| | `/v1/fs/delete` | `POST` | `fsApi.deletePath()` | |
| | `/v1/fs/rename` | `POST` | `fsApi.renamePath()` | |
| | `/v1/fs/copy` | `POST` | `fsApi.copyPath()` | |
| | `/v1/fs/mkdir` | `POST` | `fsApi.createDir()` | |
| | `/v1/workspace` | `GET` / `POST` | `fsApi.getWorkspace()` / `setWorkspace()` | |
| **`audio/`** | `/v1/audio/speech` | `POST` | `audioApi.speech()` | `useAudioStore` |
| | `/v1/audio/transcriptions` | `POST` | `audioApi.transcriptions()` | |
| | `/v1/audio/execute` | `POST` | `audioApi.execute()` | |
| **`memory/`** | `/v1/embeddings` | `POST` | `memoryApi.generateEmbeddings()` | `useMemoryStore` |
| | `/v1/ingest` | `POST` | `memoryApi.ingest()` | |
| | `/v1/ingest/file` | `POST` | `memoryApi.ingestFile()` | |
| **`control/`** | `/v1/cel/execute` | `POST` | `controlApi.executeCel()` | `useControlStore` |
| | `/v1/benchmark/run` | `POST` | `controlApi.runBenchmark()` | |

---

## 5. The Unified Tools Subsystem (`src/api/engine/tools/`)

All Tool, Agent, Skill, Plugin, and Dynamic Execution routes (from `routes.rs:50-84`) are organized in `src/api/engine/tools/`:

```text
src/api/engine/tools/
├── 📁 session/                  # Lines 50–53: Chat Session Tools Governance
│   ├── session-tools.endpoints.ts # /v1/tools, /v1/chat/{session_id}/tools
│   ├── session-tools.types.ts
│   ├── session-tools.api.ts     # sessionToolsApi.getAllTools(), getSessionTools(), updateSessionTools()
│   ├── session-tools.store.ts   # useSessionToolsStore
│   └── index.ts
│
├── 📁 skills/                   # Lines 54–60: WASM Skills & Agents
│   ├── skills.endpoints.ts      # /v1/skills/list, /install, /remove, /cache
│   ├── skills.types.ts
│   ├── skills.api.ts            # skillsApi.listSkills(), installSkill(), removeSkill(), listCache(), clearCache()
│   ├── skills.store.ts          # useSkillsStore
│   └── index.ts
│
├── 📁 plugins/                  # Lines 61–67: Engine Plugins
│   ├── plugins.endpoints.ts     # /v1/plugins/list, /install, /remove, /cache
│   ├── plugins.types.ts
│   ├── plugins.api.ts            # pluginsApi.listPlugins(), installPlugin(), removePlugin(), listCache(), clearCache()
│   ├── plugins.store.ts         # usePluginsStore
│   └── index.ts
│
├── 📁 mcp/                      # Lines 68–74: Model Context Protocol (MCP)
│   ├── mcp.endpoints.ts         # /v1/mcp/list, /install, /remove, /cache
│   ├── mcp.types.ts
│   ├── mcp.api.ts            # mcpApi.listMcp(), installMcp(), removeMcp(), listCache(), clearCache()
│   ├── mcp.store.ts         # useMcpStore
│   └── index.ts
│
├── 📁 components/               # Lines 75–84: Dashboard Components & Dynamic Execution
│   ├── components.endpoints.ts  # /api/components/*, /v1/execute/{comp}/{func}
│   ├── components.types.ts
│   ├── components.api.ts        # componentsApi.listComponents(), getSettings(), updateSettings(), getFiles(), getFile(), updateFile(), clearCache(), executeDynamic()
│   ├── components.store.ts      # useComponentsStore
│   └── index.ts
│
├── tools.store.ts               # useToolsStore (Aggregates counts & global tools health)
└── index.ts                     # Master barrel re-exporting all tool APIs
```

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

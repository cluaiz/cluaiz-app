# Installed models and chat selection

`models.api.ts` owns the installed inventory for the normal App, the extension
services and API Explorer. `getInstalled(signal?)` uses CEP `models.list` through
the shared [CEP caller](../../client/cep.ts). HTTP/native choice, authentication,
token retry and request cancellation remain with the existing client.

```mermaid
flowchart LR
    UI["Existing chat dropdown / Explorer / SDK"] --> M["modelsApi.getInstalled"]
    M --> C["Shared CEP caller + existing client"]
    C --> E["Engine models.list"]
    E --> A["Validate inventory; preserve metadata and format alias"]
    A --> UI
    UI --> L["Shared model actions: load / remove / inspect"]
    L --> C
    UI --> D["download / pull: start one models.download task"]
    D --> T["Existing callCepTask: await actual result"]
    T --> C
    UI --> I["Existing ModelInspector: current model / tab / connection"]
    I --> R["readMetadata: fresh installed registry folder"]
    R --> F["Existing fsApi.readFile: authorized UTF-8 sidecar"]
    F --> C
    I --> L
    UI --> S["Select installed chat model"]
    S --> G["config.get: engine"]
    G --> P["Preserve slots; replace selected chat slot"]
    P --> W["config.set: engine"]
    W --> ACK["Check saved id; update existing chat state"]
```

## Contracts and failures

- Wire inventory: raw array of registry entries. The adapter provides the existing
  App `installed`, `models` and `count` container. `format` is also available as
  `format_type`; model IDs, capabilities, files and metadata are retained.
- Empty inventory is valid. Missing IDs, malformed tasks/formats, invalid JSON-RPC
  envelopes and HTTP/domain failures are errors; they are not an empty success.
- CEP requires matching response ID and exactly one result/error. `CepError`
  preserves code/data, including approval details. HTTP401 remains HTTP401.
  This helper does not approve or automatically repeat a write.
- `permissionApi.getPermission/updatePermission` now adapt `config.get/set` for
  the engine section. Their existing App container remains; the saved chat slot
  projects into `chat_models.text` for current controls/request builders.
- `selectChatModel` reads the latest slots, replaces only chat_slot and checks
  the returned saved ID. Other slots and unrelated settings are retained.
  This read/modify/write is not atomic against another concurrent settings writer;
  Engine config currently replaces the slots object and has no revision token.
- The chat hook aborts stale discovery/selection, clears empty/refused inventories,
  serializes selection, and updates existing EngineStore permissions only after
  acknowledgement. The normal chat request keeps using its existing model option.
- A failed inventory sets the models store to error and retains previous data,
  rather than reporting success with an empty list. The chat picker clears its
  stale choices and offers retry. No model is invented from a display label.
- `actions.ts` owns CEP models.load/remove/inspect/download. Installed model ids
  are not repo URLs or paths. Optional header files use the same relative-package
  path validator as tool files, moved into the existing filePath utility.
- Load/remove require matching model identity and actual timing/directory fields
  before an App success. These potentially long operations have no fixed client
  deadline; an optional signal aborts observation, not a promise of server rollback.
- Raw header inspection returns the real model/file/metadata/int_arrays/languages/
  tensors shape. Current Engine probes GGUF; an ONNX probe error is preserved.
  ONNX explicit load is unsupported by current models.load; ONNX still loads on
  its first inference request. This repair does not add an ONNX loader/prober.
- Download/pull share one models.download task start and the existing CEP task
  waiter. The final installed id can differ from the requested catalog/HF id.
  A cached result with downloaded:false and path:null is valid. A task handle,
  malformed final reply or failed/cancelled task is not download success.
- Download payload retains model_id as the App field, translated to model on
  the wire. Catalog ids and HF owner/name[:QUANT] or supported URLs go to Engine
  resolution. Unknown extra payload fields fail rather than being discarded.
- Standard /v1/models and /api/tags compatibility reads remain direct and valid.
  getAvailable refuses before dispatch because current Engine exposes no model
  recommendation method; it does not invent a suggested roster.
- `readMetadata(modelId, kind, signal?)` accepts only manifest/dna choices. It
  refreshes the installed registry, finds the exact id and uses its absolute
  local_dir, preserving Windows/UNC paths. Sidecar request filenames are mapped
  here; the screen selects a metadata kind instead of constructing file paths. fsApi remains the one file reader;
  authorization/canonicalization/roots stay in Engine. No caller-supplied folder,
  tool-kind model request or guessed home path is used. Empty UTF-8 is valid;
  missing model/folder, binary data and filesystem/approval failures stay errors.
  This reuses authorized filesystem access; no new model-specific sandbox is added.
- Model store actions return true only after real action completion, false with
  an error on refusal. Successful delete filters only the acknowledged model;
  older inventory/inspection replies cannot restore it. Download/pull refresh
  inventory after the task ends. A refresh can fail after a real download; the
  download completion remains true while the store exposes the refresh error.
- Inspector retains the existing design. Its first tab says Installed Metadata
  and identifies the registry source, without an invented probe timestamp or GGUF
  fallback. Raw GGUF inspection is disabled for other formats. Known metadata
  tabs use readMetadata. Empty content stays empty, failures stay visible and
  Reload retries the currently selected read tab. No new editor/view is added.
- Switching tab/model/connection or closing aborts the owned request; late
  replies are ignored even at a boundary that fails to honor abort. Read caches
  reset on model/connection/close and hold actual data, not failure messages.

## Scope and verification

`node --test test/cep_models.test.cjs test/api_explorer.test.cjs test/api_docs.test.mjs`
checks the actual caller/domain adapters with an injected transport boundary and
the existing Explorer contracts. Separate browser evidence uses the actual React
hook and chat adapter with controlled HTTP responses; it is not model inference.

Hardware now delegates to the shared [system owner](../system/README.md), and
voice/language discovery has its separate [audio owner](../audio/README.md).
Remaining model endpoint constants are only supported compatibility reads.
`node --test test/cep_model_actions.test.cjs test/cep_model_integration.test.cjs`
checks task completion/canonical ids, malformed/mismatched results, scoped errors,
metadata reads, store feedback and stale replies using the actual adapters at a
controlled client boundary. Inspector browser checks cover actual component/tab
behavior with controlled replies. Separate Engine acceptance uses tiny owned
fixtures in a disposable home for header/metadata/removal and expected errors.

Token/approval controls and task progress/cancel UI remain separate. This adds no
Engine backend, model, downloader, native connector or design system. Fresh public
model downloads, successful native inference loads, ONNX raw-header inspection and
packaged desktop/other-platform acceptance are not certified by these checks.

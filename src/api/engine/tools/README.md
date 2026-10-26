# Component: installed tool APIs

## Technical specification

- **Purpose:** shared owners for installed skill/plugin/MCP discovery, lifecycle, settings, cache, package files, explicit calls and per-chat bindings. A package catalog, a binding and an OpenAI function definition are different data shapes.
- **Transport:** shared callCep and authenticated client, using the selected HTTP or desktop native IPC connection. Features do not construct tools.list envelopes or Engine URLs.
- **Wire:** tools.list accepts optional kind (skill/plugin/mcp), returning real registry entries and function metadata. These are protocol categories, not hardcoded package names.
- **Ownership:** catalog.ts validates records once; existing components/category APIs delegate. No second client, registry or global cache is added.

## Architectural flow

```mermaid
flowchart LR
    F["Chat picker / Tools settings / context popover"] --> C["Existing componentsApi facade"]
    S["Skills / plugins / MCP list facade"] --> R["Shared catalog.ts"]
    C --> R
    N["Unified tools count store"] --> R
    R --> P["Shared callCep / transport"]
    P --> E["Engine tools.list / installed registry"]
    E --> V["Validated actual records and functions"]
    V --> R
    C --> S["settings.ts: validate patch / saved values"]
    C --> K["cache.ts: reports / cleanup counts"]
    S --> P
    K --> P
    C --> D["files.ts: relative paths / UTF-8 / main-file writes"]
    D --> P
    C --> X["execution.ts: explicit kind / id / function / input"]
    X --> P
    L["Category install/remove facade"] --> O["lifecycle.ts"]
    O --> T["cepTask.ts: start once / await result"]
    T --> P
    B["Existing session-tools API / store"] --> Q["chat.tools / chat.set_tools"]
    B --> R
    Q --> P
```

## API contract and projections

| App owner | Behavior |
|---|---|
| listTools(kind?, signal?) | Validated registry array; optional category filter sent to Engine |
| componentsApi.listComponents | Existing id arrays plus rich grouped records |
| skillsApi.listSkills | Existing status/skills container with actual entries |
| pluginsApi.listPlugins | Existing status/plugins container with actual entries |
| mcpApi.listMcp | Existing status/mcp_servers container with actual entries |
| useToolsStore.refreshAll | One catalog request; category counts and toolsCount from that reply |
| skillsApi.installSkill / pluginsApi.installPlugin / mcpApi.installMcp | Shared lifecycle.ts → tools.install once → cepTask.ts waits for tasks.result |
| Category remove methods | Shared tools.remove; validate returned kind/name before App success |
| componentsApi.getSettings / updateSettings | tools.get_settings/set_settings, explicit kind/id and strict patch |
| Category listCache / clearCache | tools.cache/clear_cache, all installed packages of that kind unless MCP name provided |
| componentsApi.getCache / clearCache | One explicit package; validated real usage/counts and explicit all-cache intent |
| componentsApi.getFiles / getFile / updateFile | tools.files/read_file/write_file through files.ts; retain actual UTF-8 text, bytes, cache and partial listing flags |
| componentsApi.executeDynamic(name, fn, input, kind) | tools.call with an explicit tool target; return {result} with actual JSON/scalar data |
| sessionToolsApi.getAllTools | Same tools.list package catalog, including actual function metadata; not a second function-discovery endpoint |
| sessionToolsApi.getSessionTools(chatId) | chat.tools; project chat_id/active_tools into existing session_id/tools container |
| sessionToolsApi.updateSessionTools(chatId, {tools?, detach?}) | chat.set_tools merges attachments/turns/pins and explicitly detaches ids; validate matching acknowledgment |

- **Metadata:** actual id/name, description, state, version and functions are retained. The touched ToolsSettings/ChatInput fallbacks that fabricated version1.0.0, display names or enabled state were removed.
- **Counts:** toolsCount means installed packages, not functions or tools bound to a chat. The unused sessionToolsCount name was corrected; no feature consumer was found. Per-chat binding uses chat.tools/set_tools through the session adapter.
- **Validation:** malformed records/functions and wrong-category filtered replies fail. Empty arrays are valid. Unknown kinds, including model, fail before dispatch; models have their own catalog.
- **Failure:** real CEP/HTTP errors propagate. Count refresh preserves prior counts and sets error instead of converting failure into empty success. Inventory does not prove install/execution success.
- **Cancellation:** signals use the shared transport. Chat picker/context effects abort old discovery on connection change/unmount and reject late replies even if the boundary ignores abort.

## Files and remaining migration

- **catalog.ts:** one wire request/validator and existing components projection.
- **Category APIs:** thin discovery/lifecycle/cache delegates. Obsolete category and components endpoint tables are removed; features use their existing facades.
- **lifecycle.ts:** validates package target and matching install/remove result. The existing status/message shape is an App projection after actual success, not a CEP envelope.
- **cepTask.ts (client):** starts once, validates method/task identity and waits in Engine-supported 30-second result windows with a 35-second transport timeout. Only CEP timeout errors trigger status inspection; failed/cancelled/approval/transport errors propagate. A terminal task whose own operation timed out is not polled forever. Waiting has no fixed total deadline, matching the previous install contract.
- **Abort semantics:** an optional signal stops client observation. This does not cancel or roll back installation on the Engine; its task may finish after disconnection. No automatic install retry or server cancellation is added.
- **settings.ts:** only enabled, execution_mode, security_mode and trust_annotations are writable. Unknown fields/enums, non-object patches and missing/wrong kinds fail before dispatch. Saved settings are validated and each requested value must be acknowledged before success. The existing settings UI can therefore apply its draft only after the Engine acknowledges it. Components store now requires an explicit kind; package type is not guessed from its id.
- **cache.ts:** tools.cache returns real entries and byte counts, retained as typed reports and the existing message projection. Zero/empty reports are valid; missing/malformed/wrong-package results are errors. Cleanup retains removed/freed_bytes. Omitted category name means every package of that kind; a literal MCP name all targets that actual package, never silently broadens to every MCP server.
- **Inspector cleanup:** current CEP clears the complete .cache contents, so the button says Clear Cache, sends explicit all:true and re-reads remaining usage after acknowledgment. Temp-only requests are refused rather than silently widened. A pending action disables repeat clicks; late replies cannot replace another tool's usage. Package uninstall remains separate.
- **files.ts:** validates relative package paths and actual list/read/write replies. Engine remains the authority for canonicalization, roots, symlinks and permissions. Read returns UTF-8 text, including empty strings. Write accepts only main-file content; Engine chooses SKILL.md or package.json. Arbitrary path fields fail rather than being ignored; returned bytes must match the UTF-8 payload. An App-level saved result requires the real acknowledgment.
- **Inspector reading:** existing source tree consumes tools.files with truncated/skipped flags, cache and actual paths. Listing failures are visible instead of an empty-folder success. File switching aborts previous reads and ignores late replies, including boundaries that ignore abort; switching tools/unmount also invalidates owned work. Optional icon loading does not hold up the listing or replace a subsequent selection. Partial listings remain partial. Existing styles are retained.
- **Limits:** tools.read_file is a UTF-8 reader, not a binary/image transfer API. Arbitrary-file writes and an additional editor UI were not introduced. Model manifest/DNA reads belong to model APIs, not tools.*; the old ModelInspector call with kind model is refused before dispatch and still needs its separate model migration.
- **execution.ts:** requires the actual package kind/id and function name with a JSON argument object. Missing kind or path-like functions fail before dispatch. Existing components store supplies explicit kind and returns result directly so null/false/zero/empty strings and nested tool-owned result fields stay intact. No guessed category or generic execution-success status is added. Engine CEP errors (including approval/disabled/not-found failures) propagate; a tool's returned domain data is preserved without pretending to interpret every tool's schema.
- **Execution limits:** tools.call dispatches the existing Engine executor. A plain enabled skill returns its SKILL.md instructions; a manifest-backed executable, native/WASM plugin or MCP server follows its own Engine runner. The App migration does not create runners, grant permissions or certify arbitrary third-party binaries. Actual fixture proof covers skill text and disabled-tool refusal; plugin/MCP process acceptance is separate.
- **Session binding types:** installed packages remain ToolCatalogEntry records with function metadata. ToolBinding instead has id/turns and optional inline/pinned/idle observations from Engine. Write input is a package id (Engine default turns) or {id, turns, pinned?}; inline/idle are not written by this facade. Turns are -1 (persistent), 0 (single-answer), or positive within Engine's i32 range. Unknown fields, invalid budgets, duplicate/conflicting attach/detach ids and missing chat ids fail before dispatch.
- **Merge semantics:** tools:[] does not clear all tools. Only detach:[id] removes the named binding. Other bindings and chats stay under Engine ownership. Returned chat identity, binding shapes and requested additions/budgets/pins/removals must agree before a saved response is returned. Binding metadata acknowledgment is not proof that a package is installed, enabled or executable; execution uses its own authorization and availability checks.
- **Session store:** prior valid state survives failed refresh/save. Per-chat request versions ignore older replies; reset invalidates in-flight session/catalog results. A write can still finish on Engine after a reset/disconnection; ignoring its UI response is not rollback. Consumers must reset this store when changing Engine connections. No cross-client transaction or restart-persistence guarantee is added.
- **Existing chat UI:** its dedicated chat generation/SSE and tool-selection payload stay unchanged. The session facade/store is exported infrastructure; no new attach/detach/pin screen or extra per-message network call was introduced. Source search found no feature consumer of that exported store, so adapter acceptance must not be presented as a newly tested chat-management UI.
- **tools.store.ts:** one read per count refresh. Separate feature consumers may each read; no cross-component cache is promised.
- **Features:** retain current visuals and consume real rich metadata through adapters.
- **Still pending:** model metadata Inspector wiring, binary assets and permission/task UI workflows. Dedicated chat-binding controls are not added by this migration. Adapter checks do not certify every package or native execution; remaining audited model/history/terminal groups are separate.

## Verification

```text
node --test test/cep_tools.test.cjs test/cep_tool_files.test.cjs test/cep_tool_execution.test.cjs test/cep_tool_settings.test.cjs test/cep_session_tools.test.cjs test/cep_chat.test.cjs
```

Actual adapter/caller/store tests cover catalog metadata, scope/identity errors, task outcomes, package files, execution results, binding merges/detach and late/reset replies. Release-Engine acceptance uses a disposable home, an owned local fixture registry and owned chat ids for mutations; user tools/chats/config are not changed. Actual Inspector browser checks use controlled client replies in a separate disposable profile. These checks do not certify packaged native UI, other platforms or arbitrary plugin/MCP processes.

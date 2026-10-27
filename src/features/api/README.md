# API Explorer

The Explorer uses the Engine's documentation as its data source. Runtime code does
not keep a second list of methods or example payloads.

```mermaid
flowchart LR
    R["Rust method registry"] --> G["Engine cep_docs test"]
    G --> M["Markdown payload blocks + written explanations"]
    M --> S["App sync-api-docs build step"]
    S --> C["Generated API catalog"]
    C --> V["Sidebar, canvas, examples and documentation"]
    V --> T["Existing authenticated HTTP/native transport"]
```

## Build and refresh

Keep the Engine checkout beside the App (`../cluaiz`), or set
`CLUAIZ_ENGINE_SOURCE` to its directory. This is a build-time source dependency;
the packaged web/desktop App does not read repository files or run a parser.

- Update Engine-generated blocks: from the Engine, run
  `CEP_DOCS_WRITE=1 cargo test --release -p cluaiz-api --test cep_docs`.
- Check those blocks: omit `CEP_DOCS_WRITE`.
- After editing Markdown: from the App, run `npm run sync:api`.
- Verify the generated App catalog: `npm run check:api`.
- Run parser and Explorer regressions: `npm run test:api-docs`.

`app`'s `predev` and `prebuild` hooks sync automatically. A standalone checkout or
CI build must supply the Engine docs directory explicitly. Parsing fails on
malformed metadata, missing method pages, duplicate requests and broken local
Markdown file links. `public/data/api-catalog.json` is generated and ignored; do
not edit it. The runtime loads that one file rather than the old static group
files. The unused group JSON and copied API Markdown have been removed. Old
unrelated App API clients are outside this Explorer migration.

## Owners and identity

- `scripts/sync-api-docs.mjs` parses YAML, preserves written documentation, and
  derives input choices from valid request-shaped JSON fences. Responses and
  calls for a different CEP method are excluded. Shortened prose examples stay
  in the documentation; sample paths/model IDs require actual installed inputs.
- `utils/catalogGroups.ts` gives the sidebar and architecture canvas the same
  five-category membership. Domain names merge case-insensitively, so direct
  chat completions and `chat.*` controls share one Chat card. TTS contains speech
  and voices; STT contains transcriptions and languages. Shared `audio.run` is
  shown once under TTS, matching its default text input; its transcription
  payload remains available. Endpoints and payloads are not copied or changed.
  Existing colors, controls and canvas behavior stay with their UI owners.
- `utils/requestPayload.ts` keeps the wire route separate from the selected
  request. `fs.read` and `fs.write` have distinct selection/storage keys; both
  send JSON-RPC to `/v1/cep`. Controls change `params`, retaining `method`, `id`
  and `jsonrpc`. HTTP inference requests keep their top-level fields.
- `services/catalogDiscovery.ts` uses the App's existing authenticated client
  for installed models and voices. It does not create a second model registry.
- `components/ApiDocumentation.tsx` keeps ordinary prose/code in the shared
  Markdown renderer and renders standalone Mermaid fences with the installed
  Mermaid library. Diagrams use strict sanitization and current theme tokens;
  a rendering failure retains the source/error rather than hiding the diagram.
  No chat renderer or API execution path is replaced.
- A task request shows its task handle. Use `tasks.get`/`tasks.result` examples
  to inspect progress/output; the Explorer does not silently auto-run them.

This catalog wiring does not certify all downloaded models, change Engine
permissions, migrate the rest of the App's API clients, or add a new native ABI.

## Interactive architecture overview

Open `/apis` without a selected endpoint, or use the existing **Architecture
Overview** button in the sidebar. This is an explanation and navigation view;
it is not a live trace or a request executor.

```mermaid
flowchart LR
    A[App / CLI / extension] <--> T[Existing HTTP or native transport]
    T <--> G[Applicable Engine checks]
    G <--> I[Chat and media]
    G <--> M[Memory and context]
    G <--> O[Tools, files, models and settings]
    I <--> M
    I <--> R[Compatible model runtime]
    M <--> S[Events, notes and saved KV]
    O <--> S
```

- `utils/architectureGraph.ts` projects the existing catalog into typed nodes.
  It reuses `catalogPillars` and the existing transport helper. Selection identity
  is HTTP method plus logical path: sharing `/v1/cep` does not merge methods.
  Every catalog endpoint remains reachable once, including future unknown groups.
  Memory, notes, context and saved KV have their own node instead of implying
  that every read runs inference. Descriptive relationships and example steps
  contain no executable request payloads.
- `components/ApiArchitectureLanding.tsx` owns the selected node, search and
  example step. It reads the existing API/connection stores without another
  catalog or inventory loader. Search includes names, descriptions and groups.
  Missing catalog data shows an explicit message and an intentional retry.
- `components/ApiArchitectureCanvas.tsx` owns pan, bounded zoom and Fit. Its
  buttons support keyboard selection; closing details restores focus. Narrow
  viewports default to a readable list, with Map/List switching also available.
  Map wheel handling stays inside the map, so details scroll independently.
  Relationships are static; no movement is needed to understand a step.
- `components/ApiArchitectureInspector.tsx` explains purpose, input, output,
  storage, model involvement and limitations. Payload and Documentation actions
  pass the original endpoint to the existing Explorer store. They do not send
  its request. The model node separates the Explorer selection and inventory
  snapshot from unmeasured loaded state, device and context. A connection change
  hides inventory metadata captured for the original connection.

Choose an example to step through chat, recall, human/AI notes, tools, ingestion,
speech, vectors, model lifecycle or saved KV. Steps highlight related modules;
they neither simulate a successful API result nor modify Engine state. An example
whose required groups are absent is marked unavailable. Full payload variants
and language examples remain in the original endpoint documentation.

The overview explains capabilities that do not yet have complete user controls.
In particular, it does not build the AI Memory panel, persist external memory
events, change model tool policy, or prove recall quality. The existing Notebook
is a separate feature. Browser acceptance covers the shared React UI; native
desktop and other operating-system acceptance must be reported separately.

Focused projection tests: `node --test test/api_architecture.test.cjs`.

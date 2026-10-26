# Extension contract — private schema 1

This is the P6 metadata and client identity contract. It is not a public stable SDK, package installer or native execution protocol. The existing compiled Notebook/Library registrations keep their v0 manifest through `adaptBundledManifest`.

P7 adds a native App-to-Engine **transport** for these existing services. It does not add a native-worker extension **execution runtime**. `sdk.host.runtimes` continues to advertise bundled execution only; downloaded execution and per-extension Engine authority remain unavailable. See [Engine API transport](../api/client/README.md).

## Three different identities

| Identity | Owner and lifetime | Used for |
| --- | --- | --- |
| `id`, such as `example.notes` | Explicit publisher-qualified package identity | Registration, routes and package-owned state |
| `version`, such as `1.2.0` | Exact SemVer release, including optional prerelease/build identifiers | Selecting immutable release metadata; not a state namespace |
| `instanceId` | Host creates 128 random bits for each session | Separating concurrent job owners, even for the same package/release |

`sdk.identity` is immutable client ownership metadata. It is **not** an Engine credential, verified publisher identity or native sandbox principal. A package-supplied `instanceId` is discarded. Package state remains keyed by package ID, so closing/reopening a session or changing release does not create a new empty namespace.

## Metadata shape

Illustrative external package metadata; this example cannot execute in the current bundled host:

```json
{
  "schema_version": 1,
  "hub_type": "extension",
  "id": "example.notes",
  "name": "Notes",
  "version": "1.2.0",
  "host_api": { "min": 1, "max": 1 },
  "runtime": { "kind": "webview", "entry": "dist/index.html" },
  "activation": "on-demand",
  "capabilities": {
    "required": ["storage.read", "storage.write"],
    "optional": ["audio.speech"]
  },
  "contributes": {
    "views": [
      { "id": "main", "title": "Notes", "surface": "workspace", "layout": "full" }
    ]
  }
}
```

- Schema version identifies the metadata shape. `host_api` is a separate integer API range, not the App release version or a SemVer range expression.
- Metadata accepts the designed `bundled`, `webview`, `native-worker` and `wasm` profiles. Parsing a profile does not implement it. Only compiled host registration can supply a bundled executable loader; bundled metadata cannot choose an entry path.
- Metadata can describe workspace, panel, floating, native-window and settings surfaces, and background activation. The current host advertises only workspace, full/with-chat layout and on-demand activation. An empty view list describes headless metadata; it cannot become a running bundled workspace module.
- Required and optional capability lists are separate, distinct and bounded. A syntactically valid future capability may be parsed but is unavailable unless the host advertises it. Unsupported required capabilities reject compatibility. Unsupported optional ones are reported without rejecting compatibility; neither list creates a grant.
- `runtime.entry` for non-bundled metadata must be package-relative. URLs, absolute paths, backslashes, dot segments, encoded segments, query/fragment components and empty segments are refused. This is metadata validation; future extraction must still enforce filesystem containment, reparse/symlink rules and integrity.
- Normalization copies and freezes recognized fields. Unknown executable functions, identity claims and trust flags do not survive normalization.

## Existing catalogue boundary

The existing Tools registry remains the catalogue/distribution owner. No second downloader is added. P6 inspects already-supplied metadata in memory:

```text
catalogue descriptor + host selection {version, canonicalId}
  → exact versions[version]
  → versions[version].app (complete schema-1 contract)
  → matching id/version and files.entry/runtime.entry
  → compatibility report
  → no install, code load or permission grant
```

`versions[version].files.entry` and `.app.runtime.entry` must agree. A catalogue cannot claim `bundled` provenance. There is no latest-version lookup, range resolution, network request or executable URL import in this adapter.

Old short catalogue IDs are preserved as `catalogueId`; a host-owned mapping must provide the canonical `publisher.app-name`. Author display names and repository URLs are not used to invent a publisher. A returned `legacyAlias` is just mapping metadata. Registration accepts explicit, unique short aliases and refuses conflicts before changing the registry. It never chains aliases or silently registers an inspected catalogue entry.

The existing `browser-voice`, `chat-widget` and `my-assistant` descriptors do not contain this `.app` metadata. Inspection returns an incomplete-metadata error instead of inventing a view, profile or permission. This P6 change does not migrate or publish those packages.

## Availability and permission discovery

`registry.host` and `sdk.host` expose the same frozen descriptor:

| Field | Current value / meaning |
| --- | --- |
| `hostApi` | `1` |
| `runtimes` | `bundled` only |
| `surfaces`, `layouts`, `activation` | `workspace`; `full`, `with-chat`; `on-demand` |
| `capabilities` | `storage.read`, `storage.write`, `models.list`, `ai.generate`, `ai.stream`, `audio.speech`, `audio.transcribe`, `chat.sessions`, `chat.send` |
| `limits` | Existing job concurrency/history and per-value JSON limits, imported from their owners |

Host availability means an adapter exists. Manifest requests say what a package wants. `sdk.grantedCapabilities` says what that session actually received; calls still enforce declared ∩ host-granted permission. These values do not certify installed model compatibility or Engine-side authorization. `models.list()` uses the existing model service; P6 adds no model-family claims.

The additive `ai.stream` capability has a separate grant from `ai.generate`. It uses
the existing App chat stream adapter and request-job owner, not a new runtime or
transport. Existing manifests retain their permissions; a manifest declaring only
`ai.generate` cannot invoke streaming. Supported streaming calls and terminal/error
behavior are specified in the folder README. This is a private bundled-host API;
external executable registration remains disabled.

`chat.sessions` grants create/open/read of this package's App-saved chats, using
instance-issued handles. `chat.send` grants text streaming into one of those chats.
Both retain the existing storage system; optional package ownership survives catalog
and metadata hydration. A new instance reopens a saved owned ID to obtain its own
handle. Raw/cross-instance handles and another package's or ordinary chat IDs are
rejected. These additive private capabilities do not grant UI surfaces, tool use,
background operation or Engine-side credentials. Interface details are in README.

For a declared `with-chat` view, the host additionally supplies the private view
prop `showChat(handle)`. It validates through this same instance SDK before the
existing App chat UI displays that saved session. It grants no capabilities,
accepts no raw session ID and never changes the main selection. No session is
created automatically on mount. `full` views receive no binding callback.

`inspectExtensionContract` returns `compatible`, reason codes, missing required capabilities, available optional capabilities and unavailable optional capabilities. Compatibility is a metadata decision. It does not verify package signatures, grant trust, install code or authorize execution. `registerDownloaded` continues to reject executable packages.

## Local UI package boundary

Toolkit accepts a devkit-produced local `.tgz` through shared App admission and an
explicit identity/permission review. This separate path supports on-demand full
workspace WebViews, not a deserialized React loader. The bundled registry and its
availability descriptor keep their compiled-module meaning. Installed routes
re-read receipts/digests, and receipt changes revoke the old guest session.
Package lifecycle details and limits are in packages/README.md.

## Next boundaries

Non-forgeable direct Engine principals, publisher-authenticated distribution,
native/background/floating profiles and other OS acceptance remain separate.
Current App-side sessions/grants, local UI packages and isolated document surfaces
do not establish these additional boundaries. See the existing architecture and
implementation plan under `.agent/plan/` for the phase history.

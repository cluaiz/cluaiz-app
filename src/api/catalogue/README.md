# Component: public catalogue metadata

## Technical specification

- **Purpose:** website model browsing and official tools-repository discovery. Public catalogue metadata is separate from installed inventory, execution and downloading.
- **Platform:** browser fetch in web/desktop WebView. Public sources must support cross-origin reads; packaged-desktop acceptance remains separate.
- **Authority:** only this API owner makes public metadata GET requests. It never imports the authenticated Engine client, sends Engine Bearer credentials, performs auth refresh or issues a website mutation. Production uses approved HTTPS origins; local development can explicitly select the loopback website registry.
- **Sources:** official Cluaiz website model-family endpoint and the official cluaiz/cluaiz-tools raw GitHub root/family/package pointers. Remote repository pointers remain untrusted metadata.

## Architectural flow

```mermaid
flowchart LR
  U["Toolkit Models / available Tools"] --> D["Validated catalogue adapters"]
  D --> P["One credential-free public read owner"]
  P --> C["Bounded memory and local last-good cache"]
  P --> W["Website / raw GitHub metadata"]
  U --> A["Explicit install action"]
  A --> E["Existing model / tool API and local Engine task"]
```

## Public read contract

- **Function:** readPublicCatalogue(url, parse, refresh?) returns validated data, actual saved timestamp and optional warning. Search, filtering, pagination and ordinary remounts do not dispatch their own requests. Pending same-URL reads share a promise.
- **Cache:** curated model/README data is fresh for60 seconds; other catalogues retain24 hours. Explicit refresh has a60-second minimum interval;429 honors numeric/date Retry-After bounded from that minimum to24 hours. Cache entries are keyed by complete source URL, so local and production snapshots never substitute for one another. No background polling is added.
- **Resources:**15-second network/body budget,8 MiB response bound,64 memory entries and an approximate8 Mi-character serialized memory budget. Persistent snapshots remain subject to browser storage quota; storage/privacy failure preserves current-session results. No background refresh loop or extra database.
- **Failures:** invalid/oversized/error responses cannot replace validated last-good data. Stale fallback is visibly labelled. Without a valid snapshot, error is explicit. Cached payloads are revalidated; corruption does not trap future reads. Failed requests keep a cooldown rather than retry automatically.
- **Sources:** approved HTTPS metadata hosts only, no embedded credentials/custom port/query/fragment; redirects refused. The README endpoint allows its family/model query. An explicit development override permits only its exact loopback origin and the model/README paths, never admin or arbitrary local endpoints. Repository pointer components reject traversal and hostile paths. Features never accept an arbitrary metadata URL from user text.
- **Credentials:** credentials:omit, no Engine authorization header or client-secret invention; no website download counters/analytics writes. Local cache writes are local, not website database writes.

## Domain adapters

- **models.ts:** validates families, distinct model/variant identities, repository coordinates, format/bytes and package metadata. Variants are restricted to saved `package_selector.allowed_quants`, or an explicit `primary_file`; absent/empty selections expose none even if the upstream API oversupplies files. Runtime support notes remain source data. modelInstallReference emits `owner/repo:tag` only when the package has an unambiguous file tag. Incomplete, unknown or ambiguous file selections fail instead of guessing. Different bundles with the same quant remain distinct; the panel counts unique quant types separately from packages and shows paths for repeated tags. The Engine currently accepts a reference, not an explicit file/format/revision selector; it owns installation. A reference does not cryptographically pin upstream bytes.
- **tools.ts:** root/category/package metadata, current object pointers and published legacy string pointers. Old souls routing maps to extension metadata, without execution authority. Missing families produce an explicit warning while valid families remain available; all-family failure remains an error. Package manifests load only when deliberately opened and must match the selected id/type. Legacy soul is accepted only as extension metadata.
- **Installed actions:** existing models.list/tools.list/download/install adapters remain authoritative. No downloader, shell command, fake installation result or parallel authenticated transport is added.

## UI and trust boundary

For an explicitly local website preview, put `CLUAIZ_MODEL_REGISTRY_ORIGIN=http://localhost:3000` in ignored `app/.env.local`. Vite's development server injects the origin into the shared read owner and model/README adapters. Production builds always use `https://cluaiz.com`, even when that local setting exists. This does not switch the Engine connection or publish website code.

The existing App ThemeProvider, Cards, Buttons, Inputs, Tabs and CustomDropdowns
render catalogue text. No HTML/SVG injection, JavaScript evaluation, npm script
execution or automatic permission grant comes from a manifest. Listing a package
does not prove runtime compatibility or publisher identity. Unsupported legacy
TypeScript extensions are shown with an explanatory refusal; compatible built
UI packages still use the existing Extensions import/admission path.

## Server-side security boundary

Open-source native Apps are public clients. Shared binary secrets, User-Agent and
marker headers cannot prove an unmodified App; see
[RFC8252 section8.5](https://www.rfc-editor.org/rfc/rfc8252#section-8.5).
Quota/rate limits belong at the website/gateway. Client cache/cooldown can be
removed by a modified client and are never advertised as unbypassable security.
Website source inspection found a separate model-resolution guard; its public
catalogue route has cache headers without that direct guard. Live edge coverage
was not verified and no Cloudflare/origin/website/Engine configuration changed.

## Verification and remaining work

node --test test/catalogue.test.cjs covers credential-free requests, shared reads,
cache/cooldown/reload, source/path refusal, response bounds, schema/identity,
variant ambiguity and legacy/partial registry behavior. Actual themed React UI
checks use controlled metadata/Engine boundaries; real public metadata reads are
recorded separately in the integration proof. Neither is a real large download.
Live published sources can lag local repository data; missing routes remain
warnings rather than synthetic packages. Catalogue task receipts now reattach to
the same selected Engine task, display its actual progress and support cooperative
cancel through the shared CEP owner. Missing totals remain unknown. A lost initial
task id, Engine expiry/restart, packaged WebView, real large downloads and other OS
acceptance remain separate. Leaving a view stops observation, not accepted work.

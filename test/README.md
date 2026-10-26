# Chat attachment regression tests

## Toolkit / component reference

Build private packages with npm run build:extensions, then run
npm run test:component-reference. Four checks cover all 30 real source owners,
truthful availability labels/public exports, direct/hash reference routes, guide
commands, SDK CSS and the UI graph's lack of App stores or API clients.

Add -- --browser to start the actual browser fixture and open its printed
COMPONENT_REFERENCE_BROWSER_URL. The runner binds distinct unused loopback ports
and accepts results from that exact origin only. It exercises every gallery entry,
the shared dropdown, copy success/failure, the actual preview theme store and
Toolkit's reuse of the gallery. Clipboard is controlled in the fixture, then
restored; no system clipboard is written. No model/Engine is launched. The runner
closes its own servers and saves ignored evidence under component-reference/.

npm run test:extension-artifact -- --component-reference uses the existing
independent author runner to write all nine displayed SDK examples into a new
project outside the App, install actual local tarballs offline, typecheck, build
and pack. It does not publish packages or certify a downloaded installer.

## Native transport checks

`native_transport.test.ts` exercises the actual fetch-compatible native adapter with an injected Tauri command boundary: request encoding, real Response streams, bounded reads, abort/start/header/body races, origin refusal, status/errors and no TCP fallback. It also checks that Developer Hub native mode returns the actual response status/body and refuses the old browser simulation. Bundle with the same esbuild/Node workflow below.

`test/native-transport/` compiles the actual Rust client, response owner and startup guard without Tauri/model loading. Its default Windows suite uses real named pipes. Run from the App repo:

```powershell
cargo test --offline --manifest-path test/native-transport/Cargo.toml --target-dir app/src-tauri/target -- --nocapture
```

The ignored child helper is invoked only by its bounded ownership test. `actual_cli_acceptance` is a separate ignored test requiring an explicitly supplied disposable Engine home and native endpoint; it never silently connects to the user's Engine. The P7 private acceptance runner launches/stops its own fresh-home CLI and records real health/auth/model-list/text-ingest plus zero Engine TCP listeners. See the foundation plan for executed output; these checks do not certify native WebView dispatch, Linux/macOS or model inference.

The chat-hook regression needs React external to avoid bundling its server CommonJS loader. Bundle the large icon-data package rather than importing its full module graph at test startup. Run this bundle directly: Node's `--test` discovery can exclude a bundle placed inside `node_modules`.

```powershell
node -e "require('esbuild').buildSync({entryPoints:['test/chat_send.test.ts'],bundle:true,platform:'node',format:'esm',jsx:'automatic',outfile:'node_modules/.cache/cluaiz-tests/chat_send-p7-bundled-icons.test.mjs',external:['react','react/*','react-dom','react-dom/*','zustand','zustand/*','@tauri-apps/*','framer-motion','lucide-react','@hugeicons/react']})"
node node_modules/.cache/cluaiz-tests/chat_send-p7-bundled-icons.test.mjs
```

## Extension foundation checks

`extension_chat.test.ts` runs the real SDK, session adapter, Zustand store,
ChatStorageManager and EngineFs JSON/JSONL driver with only filesystem HTTP and
model response boundaries replaced. It checks same-catalog saving, unchanged main
selection/URL, saved owner/history restoration, copied/cross-package handles,
independent grants, incognito, busy admission, failure/retry, abort/disposal, stale
loads and missing-history refusal. A minimal browser DB boundary also exercises
IndexedDB catalog/metadata owner recovery. No real user files, browser DB or model
are accessed. Bundling uses the same React externals as the chat-hook command above.

`extension_foundation.test.ts` runs the actual manifest, registry, owned state, granted SDK and request-job modules. It covers invalid/incompatible/duplicate registrations, downloaded-code refusal, cross-owner data separation, denied service calls, real quota failures, bounded state and immediate cancellation with late provider results. `extension_routes_services.test.ts` covers actual router and shared domain adapter delegation. Bundle these with the existing esbuild/Node workflow below; no new package is required.

These checks do not certify third-party sandboxing, native inference cancellation or downloadable package install/update. Existing Notebook/Library browser acceptance and build results are recorded in the foundation plan.

P6 adds `extension_contracts.test.ts` for normalized metadata, current-host compatibility, exact catalogue selection, explicit identity mapping, package-relative entry validation and alias conflicts. `extension_identity.test.ts` checks host-minted session IDs, same-package job/cancel separation, stable package state, immutable discovery and session grants. These execute the actual modules with service/storage boundaries supplied by the tests; no downloaded code or native Engine principal is exercised.

`extension_stream.test.ts` checks `ai.stream` discovery and its independent grant,
validation before adapter execution, forwarding to the actual chat stream adapter,
split UTF-8 SSE text/reasoning delivery, Engine error/truncated-stream failure,
listener failure, cancellation before dispatch, disposal and late callbacks, and
same-package instance separation. Network responses/providers are test boundaries;
the SDK, domain adapter, SSE parser and request-job owner are real source modules.
No Engine process, model inference, screen layout or native UI is tested here.

```powershell
node -e "require('esbuild').buildSync({entryPoints:['test/extension_stream.test.ts'],bundle:true,platform:'node',format:'esm',outfile:'node_modules/.cache/cluaiz-tests/extension_stream.test.mjs'})"
node node_modules/.cache/cluaiz-tests/extension_stream.test.mjs
```

Bundle each with the installed esbuild API and run Node's test runner (from the App repo, no install):

```powershell
node -e "require('esbuild').buildSync({entryPoints:['test/extension_contracts.test.ts'],bundle:true,platform:'node',format:'esm',outfile:'node_modules/.cache/cluaiz-tests/extension_contracts.test.mjs'})"
node --test node_modules/.cache/cluaiz-tests/extension_contracts.test.mjs
```

Use the same command with `extension_identity` for the session checks. The broader foundation/service/audio checks use the same ESM format.

`attachment_serializer.test.ts` runs the actual upload serializer with browser FileReader as the transport boundary. It checks video payload compatibility (no unsupported `fps`), preservation of audio MIME/bytes through `audio_url`, and unchanged code/PDF/image/pasted-text order. Run it with the same esbuild/Node commands below; actual codec/model execution is tested separately by the engine's isolated media acceptance.

Run from the App repository with the existing Node and esbuild dependencies; no package installation is required.

```powershell
node --experimental-strip-types --test test/chat_request.test.ts
node --experimental-strip-types --test test/chat_retention.test.ts
node_modules/.bin/esbuild.cmd test/sse.test.ts --bundle --platform=node --format=esm --packages=external --outfile=node_modules/.cache/cluaiz-tests/sse.test.mjs
node node_modules/.cache/cluaiz-tests/sse.test.mjs
node_modules/.bin/esbuild.cmd test/chat_send.test.ts --bundle --platform=node --format=esm --packages=external --outfile=node_modules/.cache/cluaiz-tests/chat_send.test.mjs
node node_modules/.cache/cluaiz-tests/chat_send.test.mjs
```

History tests preserve successful/current attachments and exclude failed or legacy unanswered turns. Stream tests cover structured errors, one completion notification, HTTP413, premature EOF, cancellation and consumer failures. The React hook test runs the actual hook, engine adapter, SSE reader and store, with storage/network boundaries replaced for isolation. It verifies the visible error message and same-chat retry payload; it does not inspect browser layout or run a model.

`chat_upload.browser.cjs` uses an existing Playwright package and installed Chrome with an isolated browser profile, an isolated release engine and the built App. It exercises the real upload button/file chooser, browser FileReader, HTTP/SSE, rendered answer and reload persistence. No inference response is replaced. The App picker offers audio, and also video when the selected model supports visual input; the existing staging checks still reject archives/executables.

Supply these environment variables from the App repository:

- `CLUAIZ_BROWSER_PLAYWRIGHT`: existing Playwright package directory (no installation by the test).
- `CLUAIZ_BROWSER_ENGINE`: release engine executable.
- `CLUAIZ_BROWSER_SEED_HOME`: disposable engine fixture home with registry, settings and native media assets; model weights remain external/read-only. Native assets are hardlinked, so both homes must be on the same volume.
- `CLUAIZ_BROWSER_VISION_MODEL`: installed compatible model ID in that registry.
- `CLUAIZ_BROWSER_MEDIA_FIXTURES`: existing genuine `jfk.wav` and `red-blue-audio.mp4` fixture directory, used for picker/media cases.
- `CLUAIZ_BROWSER_GUARD_HOME`: optional original home whose settings/registry/permission/token hashes must stay unchanged (only equality is reported).

Run `node test/chat_upload.browser.cjs --picker` for filters, real audio/video staging/removal and executable rejection; `--text` for real TSX/Markdown answers and chat refresh; `--visual` for image/PDF and optional audio/video recognition; no flag runs text and media. Build the App first. By default the test starts its own local preview; optional `CLUAIZ_BROWSER_APP_URL` uses an existing App server. Only the App and isolated local engine origins are allowed by the browser network boundary. Test-owned processes close on success/failure. Evidence goes into ignored `node_modules/.cache/cluaiz-tests/browser-upload/`.

The fixture uses thinking off and temperature zero; byte/context/RAM limits stay at their seed values. Optional `CLUAIZ_BROWSER_BATCH_TOKENS` sets batch and microbatch only in the disposable home. An observed memory refusal is recorded separately and leaves exit code 2; it never counts as successful recognition. Screenshots/requests/answers are retained per case. Windows browser behavior does not certify Tauri native dialogs, other platforms, arbitrary codecs or recognition accuracy outside these fixtures.

Retention tests cover Settings → Chats & History: defaults never delete, archive timers count from the archive time (legacy archived chats start their timer instead of being deleted), protected/open/private chats are untouched, and delete-inactive and keep-at-most order.

TTS response regressions run with the same esbuild/Node workflow using `test/tts_response.test.ts`. They cover WAV data URI/raw Base64 decoding, WAV versus WebP RIFF signatures, JSON-envelope and binary speech responses, visible structured errors, missing-audio rejection, and default/custom voice payload mapping. These tests replace the network boundary; real model/API synthesis and audible speech quality need separate evidence.

Streamed chat speech runs the same way with `test/tts_stream.test.ts`: `speechStream` hands over each `speech.audio.delta` part even when an SSE event is split across network reads, returns the whole WAV, shows engine errors, and `speechTurns` lets only one message speak (auto-play waits, a user request takes over). Audible playback in a browser is not covered.

Read-aloud queue regressions: `node --test test/persistent_audio_player.test.cjs`. This executes the actual player TSX and turn manager, with deterministic hook, speech and media boundaries (the existing App TypeScript dependency is used, no new package). It checks completed and live messages, metadata duration, pause/resume before metadata arrives, cached replay, abort/unmount, stale replies/events, speaker takeover, visible engine/decode/play errors and retry. This is not a React DOM, browser autoplay or audio-device test. `tts_response.test.ts` also checks that cancellation reaches fetch and rejects with `AbortError`.

Speaker languages run with `node --experimental-strip-types --test test/speaker_languages.test.ts`: no choice sends no list (every language), a choice is kept up to the engine's limit of 10, unreadable storage falls back to none, and languages show their English and own names. The Settings page and the microphone in a browser are not covered.

`memory_contract.test.ts` uses the same esbuild/Node command above: actual adapters/store preserve image/text payloads and retention, retain partial extraction without claiming complete success, expose403/413 failures and keep native ingest model-free. No inference vectors or OCR quality are certified by network-boundary fixtures.

The player suite additionally covers one complete/reference-conditioned request for coherent models, buffering before playback, per-run capability lookup, settings-change cancellation and cached replay. Settings tests check same-document save notifications; speech response/stream tests check bounded busy retries, abort while waiting, unrelated errors and no replay after a delivered part. Existing player icon/metadata test boundaries match the current UI; these tests do not change that UI or prove browser autoplay.

Owned shared chat UI: bundle `test/extension_chat_ui.test.tsx` with the same
esbuild/Node setup as the session tests. It executes the real hook/SDK/store with
filesystem and model boundaries replaced. Three cases check session routing,
missing model/attachments/tools/busy admission and scoped Stop/late tokens.
`test/fixtures/extensions/chat-ui.html` is the browser acceptance entry. Run Vite
from the repo root with `--config app/vite.config.ts --host 127.0.0.1 --port 1438`,
then open that HTML URL. It uses real host/UI/SDK/store under React StrictMode,
with only model/server/storage boundaries replaced. The fixture's visible counters
show main selection/messages, subscription/global-stop calls and owned aborts.
Create/bind, copied-main-handle refusal, Send, Stop, late tokens, main new-chat
events, binding changes and workspace close can be checked without loading a
model or writing user chat files. This does not certify native Tauri, model
inference, actual disk persistence or external untrusted extensions.

Input getter regression: `node --test test/inline_prompt_input.test.cjs`. It runs
the actual TSX component with controlled hook/DOM boundaries: text, whitespace,
chips and an unmounted editor return emptiness without setting state; real event
callbacks still update placeholder state. Browser/native checks cover React itself.

Windows native saved-chat acceptance: set `CLUAIZ_ACCEPT_ENGINE` to an existing
compatible release executable and `CLUAIZ_ACCEPT_MODEL` to an installed chat ID,
then run `node test/native_chat_acceptance.cjs` from the App repo. Optional
`CLUAIZ_ACCEPT_SEED` supplies the existing Engine home. It starts Vite and two
actual Tauri/WebView launches, uses native IPC and the real selected model, and
checks streamed rendering, save/restart/read, unchanged main chat, Stop and the
render warning. Existing runtime files are linked/copied into a disposable home;
there is no Engine rebuild or model download. Process-only PATH and offline proxy
settings isolate bootstrap; four real-user files and User PATH are guarded.

The test selects the production EngineFs disk driver only in its fixture, using
native transport to keep real files in its disposable home. It does not certify
the default TauriFs Windows profile directory. Browser HTTP outside the fixture/
report origins is refused; Tauri's own IPC protocol remains allowed. Existing
auxiliary tools/context telemetry HTTP calls may be refused by that guard. Test
results therefore do not certify full UI transport parity. Model/service/disk
responses are not mocked in this run. The runner restores the default debug build
after the test so its temporary dev URL is not left in the usual App artifact.
Evidence, profiles and logs stay under ignored
`node_modules/.cache/cluaiz-tests/extension-chat-hardening/`. One Windows model
case is not a general model/platform compatibility or performance result.

## Bundled extension theme fixture

Start Vite from the repo root using `--config app/vite.config.ts --host 127.0.0.1
--port 1446 --strictPort`, then open `/test/fixtures/extensions/theme.html`. Use
a separate test port/origin, never the running user's App origin: the fixture
initializes the existing theme store for this test. It loads the real stylesheet,
ThemeProvider, extension host and `src/extensions/ui.ts` re-exports. It requests no
model/chat/storage capabilities and needs no Engine or downloaded model.

Type a local draft and increment the counter; switch themes using the host
selector. Compare the host and extension primary buttons, surfaces, text, borders
and corners. The draft/count must remain. Change the accent and font, inspect
hover/focus, and check that the disabled button cannot increment the counter.
The custom panel uses CSS variables, and the secondary button uses exported
semantic classes. This fixture is not registered in production navigation.

This checks same-document CSS reuse. Separate windows, isolated webviews,
downloaded package execution and every possible custom CSS override are outside
this fixture's scope.

## Independent author SDK/devkit

Build private packages with `npm run build:extensions`; behavior tests run with
`npm run test:extensions`. The latter needs npm's supplied CLI path for its actual
archive test; it creates disposable projects, validates rejection cases and uses
real Vite/npm builds. Cases cover scaffold overwrite, bad metadata/type errors,
path traversal/output junctions, ignored config/.env, receipt-listed packing,
hash changes, immutable artifact output and receipt invalidation on failed rebuild.
Temporary cleanup verifies resolved absolute paths stay inside the test temp root.

Independent-project acceptance packs the actual SDK/devkit, installs the tarballs
in a directory outside the App repo, imports SDK types and UI, then runs that
project's check/build/pack/dev scripts. Keep the preview on its own loopback origin;
the real user's App profile is not connected. The preview must show UI-only,
match App themes and respond to draft/count interactions and source reload. Its
production archive must exclude preview controls, source, .env and node_modules.

This is author tooling acceptance, not external runtime installation, per-package
Engine authority or native platform certification. Local evidence lives under
`node_modules/.cache/cluaiz-tests/extension-devkit/`.

## Portable guest bridge (W1-W4)

Bundle test/extension_guest.test.ts with the existing esbuild/ESM workflow and run
its absolute output path with Node. It uses real MessagePorts and existing
SDK/jobs/storage with controlled model/chat service boundaries: negotiation,
grants, storage acknowledgement/quota, original handles, cross-instance tokens,
late results, cancellation, raw ingress abuse, stream credits and oversized audio.
It is not native isolation evidence.

After build:extensions, serve test/fixtures/extensions/guest.html on a separate Vite
test origin. Same-origin guest consumes built SDK guest/UI entries; host uses
real ThemeProvider and test-owned memory storage. Save a draft, edit it and read
back. Switch light/pixel themes; compare computed button color/font/radius and
retained draft/count. Close host; save must fail without increasing write count.

The fixture bootstrap is test-only. No production route/loader, native permission,
Engine/model or user chat profile is involved. Evidence lives in the ignored
node_modules/.cache/cluaiz-tests/extension-guest/ directory.

## Actual developer document runtime (W5-W6)

For browser-only diagnosis, use `npm run test:extension-runtime -- --web-only`.
That mode does not launch/rebuild Desktop and cannot establish native acceptance.

From the App repo, build the private packages, prepare the independent author
artifact, then start the two-host acceptance:

```text
npm run build:extensions
npm run test:extension-artifact
npm run test:extension-runtime
```

Open the printed EXTENSION_RUNTIME_BROWSER_URL in the test browser while the
runner starts a hidden, separately identified Windows Tauri App. Both load the
same self-contained author HTML; the runner compares its SHA-256. The author
project installs actual local tarballs in a disposable directory outside the App
checkout. Installation is offline with scripts disabled and installed-version
pins in that test project; --online can be supplied explicitly if the npm cache
does not contain those versions. Source/artifacts/logs are retained before guarded
temporary cleanup. This helper is test-only and publishes no package.

runtime.tsx uses the actual GuestWorkspaceHost, theme/state owners and surface
adapters. runtime-guest.tsx is independent author source consuming public SDK
imports. Checks cover invalid metadata before execution, actual opaque/native
bootstrap, host DOM/storage separation, resource-policy fetch denial, light/pixel
computed styles, retained draft/count, close/reopen identity and saved state,
an unavailable model service, exact binary sentinel bytes, literal JSON keys
resembling a binary envelope, and two streams with scoped individual stop over
the real channel. Sentinels are controlled transport data, not synthesized audio
or model-generated tokens. No inference is claimed.

On Desktop the guest attempts actual token, Engine, chat-storage, host-message,
surface-create and event-listen commands and must receive Tauri ACL denials.
Closing must revoke its old native label. The runner uses an empty test Engine
home and no real model/Engine. It stops only its own process tree/servers and
rebuilds the ordinary debug binary so a test URL is not left embedded there.
Other desktop OSes/mobile and signed installed execution are not certified.

extension_surface.test.ts also exercises the real source-bound bootstrap with
MessagePorts and bounded native Blob encoding/decoding. Rust surface-state tests
run with cargo test --offline --locked --manifest-path app/src-tauri/Cargo.toml
--lib features::extensions::surfaces::tests. The earlier standalone
extension-surface/ crate retains the limited experimental API/ACL probe.
Runtime evidence is ignored under node_modules/.cache/cluaiz-tests/extension-finish/.

## Real developer WebView chat acceptance (Windows)

Build the independent author fixture with `npm run test:extension-artifact -- --live-chat`.
It uses the real private SDK/devkit tarballs and produces
`node_modules/.cache/cluaiz-tests/extension-finish/live-chat-document.html`.

Set `CLUAIZ_ACCEPT_ENGINE` to an existing compatible release executable,
`CLUAIZ_ACCEPT_MODEL` to an installed chat model ID, and
`CLUAIZ_ACCEPT_DOCUMENT` to that built HTML. Run
`node test/native_chat_acceptance.cjs`. Omitting DOCUMENT preserves the earlier
bundled/shared-chat-UI acceptance. Neither mode downloads or builds an Engine.

The developer mode runs actual GuestWorkspaceHost, the separate native WebView
and public guest SDK against the installed model. It creates an owned ordinary
App chat, streams a short answer, checks the existing JSONL driver, closes the
App, then relaunches with the same test profile/home and reopens that answer.
A second model request is stopped through its own SDK job; main selection and
messages must remain unchanged. No fixed generated response is substituted.

The runner reuses its existing disposable Engine/config preparation and seed
hash guards. Developer mode bounds context/CPU threads and avoids GPU offload
only in that disposable config. Native guest profiles remain separate from the host;
no global WebView2 profile override is used. It uses the App-installed Vite,
records startup failures and restores the ordinary debug binary afterward.
Each native run uses a unique test application identifier, retained across its
two launches. Tauri 2.11.2 does not forward WindowConfig dataDirectory to the
runtime attributes; that ineffective setting is no longer used for isolation.

As in the earlier native-chat fixture, only this test selects the existing
EngineFsChatStorageDriver so its files stay in the owned Engine home. This does
not certify the default Windows TauriFs path, browser live inference, other OSes,
production downloaded install/signing or every model. Runtime/test logs live
under the existing ignored extension-chat-hardening/native/<run-id>/ folder.

## Real browser developer chat acceptance

Use the same built live-chat document, Engine and model variables above. Also set
CLUAIZ_ACCEPT_BROWSER=1, CLUAIZ_ACCEPT_HTTP_PORT to an unused loopback API port,
and CLUAIZ_ACCEPT_VITE_PORT to a different unused port. Run the same
node test/native_chat_acceptance.cjs command, then open the printed
EXTENSION_LIVE_BROWSER_URL in a real browser while the runner is waiting.
A unique Vite port isolates browser state from the user's ordinary App origin.

This mode launches the existing Engine on 127.0.0.1 and skips Cargo/native builds.
Its temporary token is delivered only to the exact fixture Origin by a no-store
config response, never placed in the URL/results. Missing/wrong Origin returns
403. The guest has no native transport and must not read parent credential
storage. The host clears its token after the successful second phase.

The fixture configures the owned connection before importing ChatStore, then
waits for its existing automatic hydration. It does not launch a competing manual
hydration. It remembers its original fixture URL because normal chat hydration
changes browser history to the production chat route. Reload returns to that
fixture, restores the saved answer, and stops a second real request through the
same public SDK. Main chat selection/messages and exact JSONL rows are checked.
The runner records results/seed-file guards and stops its own Engine/Vite.

## Isolated desktop storage command checks

Run cargo test --offline --locked --manifest-path app/src-tauri/Cargo.toml
--lib features::chat::storage::tests -- --nocapture from the App repo.
The actual storage.rs commands use a cfg(test)-only task-local UUID temp root;
normal App builds keep the existing Known Folder path. Checks cover save/read/
replace/delete, assets, malformed catalog/tail recovery, pagination and invalid
session refusal. This is filesystem-command evidence, not a GUI test writing to
the user's default catalog. See the native chat owner README for details.

## App-owned UI package lifecycle

Run `node test/extension_packages.mjs` (or npm run test:extension-packages) for
bounded USTAR/gzip admission tests, including bad paths/links/checksums and a small
compressed expansion bomb. Native filesystem checks:

```sh
cargo test --offline --locked --manifest-path app/src-tauri/Cargo.toml --lib features::extensions::packages::tests -- --test-threads=1
```

Prepare the actual independent guest with npm run test:extension-artifact, then
run `node test/extension_runtime_acceptance.mjs --packages`. Open its printed
browser URL while it waits. `--web-only` and `--desktop-only` run one host each.
The browser uses an unused origin; Windows uses a unique test application ID.
Its user profile/installed packages are separate from the ordinary App. Logs live
in ignored extension-finish/packages-runtime/<UUID>/; failures remain retained.
The runner stops only its own process tree and restores the ordinary debug build.

The fixture chooses the actual devkit tarball through the UI, checks explicit
installation and permission editing, runs the built guest through the installed
host, verifies storage/theme/scoped jobs and native raw-command denial, then
exercises bad update, new version, stale revision, disable/re-enable and confirmed
uninstall. Saved preferences remain in their original owner. A controlled new
version is re-inventoried by a test-only helper; this is not another production
packer. The local report listener counts actual guest fetch/navigation attempts.
Provider failures/binary sentinels are controlled transport boundaries; this test
does not establish audio or model inference quality or publisher authentication.

## Floating extension presentation

Run node test/extension_packages.mjs --activities for host activity identity,
duplicate/limit, selected Stop, immutable snapshots and late-error/subscription
checks. The same reusable runner accepts --floating with --web-only or
--desktop-only. Logs use extension-finish/floating-runtime/<UUID>/.

The actual Toolkit Open floating action starts the same built package. The fixture
unmounts its package screen/changes route while the App-root activity remains;
instance identity, shared theme and saved state are checked. Browser Close and
the native window close-request path revoke the activity, then it reopens with
saved data. Native close is performed with main's existing window-close API,
which emits the same CloseRequested path as the OS button; no physical mouse
click on the window X is claimed. Main survives, and the old native label is
unusable. All nine existing guest raw-command probes still apply.

A second controlled, inventoried package runs concurrently. Installing, disabling
and uninstalling it must preserve the original guest's instance. Existing bad
update, approved replacement, stale revision and confirmed uninstall checks also
run. Browser self-navigation/fetch probes still count escaped requests. These are
controlled provider/transport tests, not fresh model inference, durable job,
physical drag/resize, background scheduling or other OS acceptance evidence.

## Desktop close-to-tray lifetime

node test/extension_packages.mjs --desktop runs preference/acknowledgement,
rollback, storage denial, native unavailable and browser unsupported checks.
Native lib tests include tray-ready/enable/main-label/quitting close policy and
guest caller refusal. Tauri's existing locked tray dependency is enabled; no
package version upgrade is required.

Run node test/extension_runtime_acceptance.mjs --background after the normal
independent runtime artifact build. It implies desktop/floating/package mode and
does not require opening a browser URL. A visible isolated Windows test window
is used so actual hide/restore can be observed. Logs use
extension-finish/background-runtime/<UUID>/.

Phase 1 checks native tray registration, actual main CloseRequested hiding,
SDK operation from a still-open floating guest while main is hidden, restoration
of the same window/instance, and the real existing preference UI saving false.
The 13 raw guest command attempts include all four desktop commands and must be
denied. The earlier package/floating/sibling checks still run. It leaves an active
floating guest, then requests full Quit. Runner requires process exit code 0;
taskkill cannot count as a successful Quit.

Phase 2 relaunches the same test identity/profile/config, reads persisted false,
removes the controlled installed package, requests normal main close and requires
another process exit code 0. Ordinary debug build is restored afterward. No user
profile is the fixture target and no model download/inference is performed.

Tray icon/menu callbacks share native Show/Quit functions with the tested commands.
Physical tray-menu mouse clicks, Linux/macOS desktop, OS sleep/power scheduling,
startup registration and owned real Engine/model shutdown are not certified by
this controlled fixture. A Chromium class-unregister diagnostic may appear at
Windows shutdown; the runner still requires actual normal native exits.

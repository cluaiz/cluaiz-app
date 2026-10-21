# Chat attachment regression tests

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

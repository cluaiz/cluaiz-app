# Chat attachment regression tests

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

Retention tests cover Settings → Chats & History: defaults never delete, archive timers count from the archive time (legacy archived chats start their timer instead of being deleted), protected/open/private chats are untouched, and delete-inactive and keep-at-most order.

TTS response regressions run with the same esbuild/Node workflow using `test/tts_response.test.ts`. They cover WAV data URI/raw Base64 decoding, WAV versus WebP RIFF signatures, JSON-envelope and binary speech responses, visible structured errors, missing-audio rejection, and default/custom voice payload mapping. These tests replace the network boundary; real model/API synthesis and audible speech quality need separate evidence.

Streamed chat speech runs the same way with `test/tts_stream.test.ts`: `speechStream` hands over each `speech.audio.delta` part even when an SSE event is split across network reads, returns the whole WAV, shows engine errors, and `speechTurns` lets only one message speak (auto-play waits, a user request takes over). Audible playback in a browser is not covered.

Read-aloud queue regressions: `node --test test/persistent_audio_player.test.cjs`. This executes the actual player TSX and turn manager, with deterministic hook, speech and media boundaries (the existing App TypeScript dependency is used, no new package). It checks completed and live messages, metadata duration, pause/resume before metadata arrives, cached replay, abort/unmount, stale replies/events, speaker takeover, visible engine/decode/play errors and retry. This is not a React DOM, browser autoplay or audio-device test. `tts_response.test.ts` also checks that cancellation reaches fetch and rejects with `AbortError`.

Speaker languages run with `node --experimental-strip-types --test test/speaker_languages.test.ts`: no choice sends no list (every language), a choice is kept up to the engine's limit of 10, unreadable storage falls back to none, and languages show their English and own names. The Settings page and the microphone in a browser are not covered.

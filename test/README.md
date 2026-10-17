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

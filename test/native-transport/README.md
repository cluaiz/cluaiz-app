# Native App transport tests

This standalone Rust workspace compiles the actual App `client.rs`, `requests.rs` and
`state.rs` using path modules. It does not load Tauri, launch the user Engine, download
models or connect to public services.

Run from the App repository, reusing the existing native build cache:

```powershell
cargo test --manifest-path test/native-transport/Cargo.toml --target-dir app/src-tauri/target --offline
```

Windows tests create random local named pipes and real Hyper HTTP/1 connections over
them. Fixtures cover binary framing/chunk bounds, owner checks, cancellation versus EOF,
window cleanup, connection ownership, missing endpoint/no TCP fallback, capacity and
truncated responses. The fixture server owns and aborts its tasks on teardown.

Cross-platform validation covers request path/headers and the transport size ceiling.
One limit test allocates a single 128 MiB + 1 byte zero-filled request and rejects it
before connection. The readiness guard test launches only this test binary's ignored
15-second helper, hides its Windows console, and verifies kill/wait cleanup. It never
launches a shell or persistent helper. The ignored helper is not a shipped product test.

These tests do not establish real-model parity, OS peer-security configuration,
Tauri window dispatch or Linux/macOS transport execution. Windows-specific tests are
compiled and run only on Windows; other platforms must not claim those tests passed.

`actual_cli_acceptance` is separately ignored by default. It requires
`CLUAIZ_NATIVE_ACCEPT_ENDPOINT` and `CLUAIZ_NATIVE_ACCEPT_HOME` naming a disposable,
test-owned native-only CLI. Its token is read from that isolated home's session file,
never printed or supplied on a command line. The private P7 runner starts/stops this
CLI, guards selected real-home files and User PATH, and checks the child has no TCP
listeners. This separate run covers real health, missing/invalid auth, an empty model
list and model-free text ingestion; it does not load weights or certify inference.

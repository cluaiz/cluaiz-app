# 🧠 Cluaize Desktop App — Status Tracker

## 🎯 Grand Vision
To build a lightning-fast, native desktop frontend for the Cluaize Engine. 
The UI must feel premium, non-blocking (60/120fps), and directly wired to the `cluaizd` (database) and `cluaize` (inference engine) using a 0-ms FFI bridge via Tauri.

---

## ✅ KAM JO HO CHUKA HAI (DONE)

### UI / Frontend
- [x] Basic Application Shell (`AppShell.tsx`) and layout structure built.
- [x] Zustand stores setup for UI state (`useLayoutStore.ts`, `useShortcutStore.ts`).
- [x] Chat Input area styled with attachments and commands menu.
- [x] Replaced the heavy Apple Watch style bubble menu with a sleek, centered Command Palette / Dropdown (`Ctrl + M`).
- [x] Keyboard shortcuts initialized and persistent storage fixed.

### Engine Backend (cluaize repo reference)
- [x] `tensor_transducer.rs` FFI bridge is ready.
- [x] Vector Pipeline (ONNX) and LMDB storage is active.
- [x] Shannon Entropy Gating and Memory Ring Buffers are implemented.
- [x] CLI commands (`brain on/off`) are functional.

---

## ❌ KAM JO ABHI BAKI HAI (PENDING)

### Priority 1 — The Core Chat Loop (Frontend to Engine FFI)
- [ ] **Tauri Bridge Setup:** Create Rust commands in Tauri to accept text from the React UI.
- [ ] **FFI Connection:** Wire the Tauri command directly to `tensor_transducer.rs` to send user prompts to the engine.
- [ ] **DB Saving:** Ensure `cluaizd` saves the chat history through the FFI call.
- [ ] **Token Streaming:** Listen to the engine's text generation and stream tokens back to the UI in real-time via Tauri Events (`emit_all`).

### Priority 2 — AI Mechanics & Auto-Metadata
- [ ] **Auto-Title:** When a new chat starts, trigger a background task for the AI to generate a short title.
- [ ] **Auto-Emoji:** AI to select a relevant emoji based on the context.
- [ ] **History Hydration:** On app load, read all past threads from `cluaizd` and populate the Sidebar.

### Priority 3 — CLI-to-UI Setup & Management Ports (Later Phase)
- [ ] **Onboarding Wizard:** Port the CLI user setup (Name, Goal, Role -> Purpose Vector) to a visual UI flow.
- [ ] **Model Downloader:** UI interface to paste model links, download via engine, and show progress bars.
- [ ] **Skill / Model Manager:** UI screens to list and delete installed models and skills.

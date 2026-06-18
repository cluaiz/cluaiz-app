# Universal Settings & Lazy Load Native FFI Integration

This plan outlines the architecture for connecting the Tauri App's UI settings directly to the Cluaize Engine via Native FFI (Named Pipes), bypassing HTTP entirely. It also details the exact logic for the "Lazy Load Model" feature, and the specific ON/OFF boolean refactor for Pure Brain Mode.

## 1. Goal Description

The Cluaize Engine must act as a sovereign native daemon controlled entirely by the Tauri Desktop App via a 0-latency Named Pipe (`\\.\pipe\cluaize_engine_pipe`). 
We are completely **banning HTTP requests** from the Desktop App to the Engine for security and performance reasons. Furthermore, we are introducing deep logic for "Lazy Loading" the ML models into RAM based on user preferences.

> [!IMPORTANT]
> The Engine must understand native IPC payloads that update `Permission.json`, `system_booster.bin`, and `system_control.json` directly. The App UI is the master controller.

## 2. Refined Understanding (As per your latest instructions)

Bhai, tumhari aakhiri baat mujhe 100% samajh aa gayi:
Tumne bataya ki `system_control.json` mein jo `"brain": { "cluaizd_connect_ffi": "local" }` likha hai, usko badal kar simply **ON / OFF (True/False)** karna hai.
Agar "Brain Mode" **ON** hai, iska matlab Engine sirf ek Database/Brain ki tarah chalega aur kisi bhi haalat me LLM Model load nahi hoga (RAM 0 bachegi). Pure Brain mode ON matlab LLM strictly OFF.

## 3. Open Questions for User Approval

> [!NOTE]
> Bhai, sirf ek choti si cheez confirm karni hai:
> FFI (Named Pipe) par settings bhejte waqt, kya main string format aise rakhu:
> `//SYS_CMD:SET_PERMISSION {"lazy_load_model": true, ...}`
> Ya phir kuch aur prefix chahiye?

## 4. Deep Implementation Details

---

### Phase 1: Engine Schema & Core Configuration

#### [MODIFY] `cluaize-shared/src/hardware/governor.rs` (or equivalent file for `system_control.json`)
- Refactor the `BrainControl` struct to be a simple boolean or ON/OFF flag instead of the `cluaizd_connect_ffi: "local"` string.
- Ensure that if `brain_mode == true`, the engine strictly disables all model loading logic everywhere.

#### [MODIFY] `inference-engine/engines/src/neural_foundry/security/permission_schema.rs`
- Add `pub lazy_load_model: bool` to the `PermissionSchema` struct.
- Write a default function `default_lazy_load_model() -> bool { false }`.
- Update `PermissionSchema::default()` to include this new setting.

#### [MODIFY] `cmd/src/ui/menu.rs` (CLI Dashboard)
- Add "Lazy Load Model (Current: true/false)" to the `cluaize permission` terminal menu.
- Connect the up/down arrow toggles so users can save this directly to `Permission.json`.

---

### Phase 2: Native FFI Pipe Controller (The "No HTTP" Rule)

#### [MODIFY] `inference-engine/api/src/lib.rs` (or the FFI Pipe Listener Module)
- Update the Named Pipe token reader to intercept specific command prefixes.
- **Example Flow:**
  - If payload starts with `//SYS_CMD:SET_PERMISSION`: Parse JSON, overwrite `Permission.json`, and apply changes instantly without rebooting.
  - If payload starts with `//SYS_CMD:EAGER_LOAD`: Immediately load the 4GB text model into RAM (only runs if Lazy Load is OFF and Brain Mode is OFF).
  - Otherwise: Treat it as a chat prompt and send it to the `NeuralDispatcher`.

---

### Phase 3: Tauri App UI & Backend Wiring

#### [MODIFY] `cluaize-app/app/src/components/Settings.tsx`
- The React UI has toggles for "Lazy Load Model", "Pure Brain Mode", etc.
- When toggled, do **NOT** call Axios/Fetch.
- Instead, invoke a Tauri IPC command: `invoke('update_engine_settings', { payload: settingsJson })`.

#### [MODIFY] `cluaize-app/app/src-tauri/src/core/engine/spawner.rs`
- Create the `update_engine_settings` command.
- This Rust function grabs the `tx` handle of the active FFI Named Pipe and streams the command: `//SYS_CMD:SET_PERMISSION ...` directly to the Engine.

---

### Phase 4: The Lazy Load Logic Execution

#### [MODIFY] The Model Loading Logic (`NeuralDispatcher`)
- **Condition 0 (Pure Brain Mode ON):** LLM never loads. Period.
- **Condition 1 (Lazy Load ON):** 
  - When the user opens the Chat UI, the App does nothing. RAM stays at ~3MB.
  - When the user types "Hello" and hits SEND, the Engine checks if the model is loaded. If not, it loads the 4GB model into RAM, then streams the response.
- **Condition 2 (Lazy Load OFF):**
  - When the user opens the Chat UI (or CLI New Chat), the App immediately sends `//SYS_CMD:EAGER_LOAD` via the Named Pipe.
  - The Engine silently loads the 4GB model in the background. By the time the user types their message, the model is already in RAM.

## 5. Verification Plan

- **CLI Verification:** Run `cluaize permission` and ensure "Lazy Load Model" toggles correctly.
- **Brain Mode Verification:** Change Brain to ON. Try to chat. Ensure model does not load and it only uses DB/Brain logic.
- **Lazy ON Verification:** Open chat. Verify RAM stays at 3MB. Send message -> RAM spikes to 4GB.
- **Lazy OFF Verification:** Open chat -> RAM immediately spikes to 4GB before sending message.

Bhai, mujhe tumhara `system_control.json` (Brain mode ON/OFF wala) correction 100% samajh aa gaya hai. Agar tum is update se agree karte ho, toh bas **Approve** likh kar bhej do, aur main code likhna start kar dunga!

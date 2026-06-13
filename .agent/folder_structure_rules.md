# Folder Structure Strict Adherence Rules

1. **No Circular Imports**: Components in `features/` cannot import from other `features/` unless explicitly exposed via a shared `index.ts`. Use the `store/` or `core/` for shared states.
2. **Component Co-location**: If a CSS module, utility function, or sub-component is ONLY used by `ChatWindow.tsx`, it must live inside the `features/chat/` folder alongside it. Do not pollute global `components/` or `utils/` with feature-specific code.
3. **Zustand Slices**: Large global states should be split into logical slices (e.g., `useChatStore`, `useThemeStore`) rather than a single monolithic store.
4. **Tauri IPC Isolation**: Do not call `invoke()` directly inside React components. Create wrapper functions in `core/tauri-api.ts` so that components remain pure and easy to test or mock in the browser.

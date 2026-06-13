# Cluaize App Core Policies

1. **Zero Bloat Policy:** Do not import heavy UI libraries (like Material UI or Ant Design) if a lightweight alternative or custom CSS can achieve the same result. The app must remain fast and lean.
2. **Strict Typing:** All React components, props, Zustand stores, and Tauri IPC payloads must be strictly typed using TypeScript interfaces or Zod schemas.
3. **Graceful Degradation:** Features dependent on native OS APIs (e.g., file system, local TTS) must not crash the webview if the API is unavailable (e.g., running in browser mode). Always provide fallbacks.
4. **Theme Consistency:** Do not use hardcoded hex colors in components. Always use CSS variables from the global theme context to ensure the Premium/Pixel toggle works flawlessly.

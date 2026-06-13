# Production Readiness Checklist (Tauri + React)

Before any release build (`npm run build:desktop`), the following criteria must be met:

1. **Performance Check:** 
   - Ensure the production build uses Vite's minification.
   - Run React DevTools Profiler to ensure no unnecessary re-renders in hot paths (like the Chat list or Speech visualization).
2. **Bundle Size:**
   - Ensure image assets and large SVGs are optimized.
   - Avoid pulling in large dependencies for single utility functions (e.g., use native `Intl` over `moment.js`).
3. **Cross-Platform Verification:**
   - Test UI responsiveness on both Windows (WebView2) and macOS (WebKit).
   - Verify native OS window controls (custom titlebars, drag areas) work flawlessly.
4. **Offline Resilience:**
   - If the app loses internet connection, the UI must not crash. It should gracefully queue actions or show an offline banner.
5. **No Console Errors:**
   - Clean up all `console.log` statements in production builds. No React warning about missing `key` props or unhandled promises.

# Cluaize Universal App Folder Structure & Naming Rules

To support a Hyper-Modular, Centrally Controlled, and Omni-Platform application (Desktop, Web, Mobile), the folder structure must be flawless.

## 1. The Strict Monorepo Layout

```text
cluaize-app/
├── package.json
├── apps/                       
│   ├── shell-desktop/          # Tauri wrapper for Desktop
│   ├── shell-web/              # Web SPA wrapper
│   └── shell-mobile/           # Mobile wrapper (React Native / Tauri Mobile)
│
├── src/                        # The Single Source of Truth
│   ├── config/                 # Centralized Control Systems
│   │   ├── themes.ts           # Light, Dark, Matrix, Cyberpunk, Pixel configurations
│   │   ├── shortcuts.ts        # Global keyboard shortcuts
│   │   └── features.ts         # Feature flags (what to enable/disable in UI)
│   │
│   ├── core/                   # Global Providers and Tauri IPC wrappers
│   │   └── ThemeProvider.tsx   # Applies the central theme config globally
│   │
│   ├── store/                  # Global Zustand state management
│   │   ├── useAppStore.ts      # UI state, active theme, background settings
│   │   └── useUserStore.ts     
│   │
│   ├── components/             # Hyper-Reusable DUMB Components (Never duplicate code)
│   │   ├── ui/                 # Smallest atoms: Buttons, Inputs, Avatars
│   │   ├── layout/             # Universal wrappers: Sidebars, Headers
│   │   └── shared/             # Reusable composite blocks: Cards, Modals
│   │
│   ├── features/               # Future-Proof Modular Business Logic
│   │   ├── chat/               # Chat UI, useChatLogic, message lists
│   │   ├── agents/             # AI Agent management
│   │   ├── business/           # Production/Business mode tools
│   │   └── code-editor/        # Coding environment integration
│   │
│   ├── assets/                 # Backgrounds, Icons, Fonts
│   ├── App.tsx                 # Main router mapping
│   └── main.tsx                # React DOM entry
```

## 2. The "Import, Never Duplicate" Law
- If you need a Button in the `agents` feature, you MUST import it from `src/components/ui/Button`. You are forbidden from creating a new `AgentButton`.
- Components must be flexible enough (via props) to handle different use cases.

## 3. Strict Naming Conventions
- **Folders:** `kebab-case` (e.g., `chat-window`, `code-editor`).
- **Files/Components:** `PascalCase` for React components (e.g., `ThemeToggle.tsx`).
- **Hooks:** `camelCase` starting with `use` (e.g., `useWebSocket.ts`).
- **Styles:** Use global CSS variables `var(--primary-color)` mapped via Tailwind. Never hardcode `#1a1a1a` in a component.

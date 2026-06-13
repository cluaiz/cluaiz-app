# Architecture & Application Guidelines: Cluaize Universal App

## 1. The Omni-Platform Reality (Desktop, Web, Mobile)
The application is not just a desktop tool; it is a **Universal Client**.
- **Desktop (Tauri):** High-performance OS native capabilities.
- **Web App:** Fast loading, accessible from any browser.
- **Mobile (Tauri Mobile / PWA):** Fully responsive, touch-optimized interfaces.
**Rule:** UI components must be 100% responsive. Never hardcode fixed pixel widths that break on mobile screens. Use fluid layouts (`flex`, `grid`, `w-full`, `max-w-md`) and Tailwind breakpoints (`md:`, `lg:`).

## 2. Centralized Omni-Theming System (Single Source of Truth)
The application will support massive visual customization. This must NOT be hardcoded into individual components.
- **Modes:** Light Mode, Dark Mode, and OLED Black.
- **Themes & Alternate Designs:** Modern Premium, Minecraft/Pixel Style, Cyberpunk Terminal.
- **Rule:** A single global configuration (Zustand Theme Store) controls everything. Components only read CSS variables (`var(--bg-primary)`, `var(--radius-base)`, `var(--font-primary)`).
- If the user switches to "Pixel Mode", a single global toggle changes the CSS variables, instantly converting the entire app without changing a single React component file.

## 3. Hyper-Modular Component Architecture (Zero Duplication)
If a base is weak, the building falls. The folder structure is our ironclad base.
- **Absolute Isolation:** Every UI element (Button, Card, Input) has its own dedicated folder and file. 
- **Reusability:** Code must NEVER be duplicated. If a chat message bubble is needed in the "Business Module", it imports the exact same `ChatBubble` component used in the "Personal Module".
- **Dynamic Control:** Components must accept props for extreme customization (e.g., `featuresEnabled: { showTimestamps: boolean, allowReactions: boolean }`).

## 4. Feature-Driven Expandability (Future Proofing)
Cluaize will expand to include AI Agents, Business Logic, and a Coding Environment.
- **Rule:** Never pollute the global app router. Each major feature (Chat, Agents, Code Editor) must live in `src/features/` as a completely self-contained module. They manage their own internal states and only interact with the global store when necessary.

## 5. UI and Logic Decoupling
- **Hooks vs Components:** Logic (like WebSocket connections, Web Speech API) MUST be isolated into custom React hooks (e.g., `useChatLogic.ts`).
- UI components should be "dumb". They only care about what color to render and what text to show. They should never contain heavy business logic.

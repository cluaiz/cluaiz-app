# SDLC Rules for Cluaize App

1. **Discovery & Discussion:** Never jump into rewriting complex React components or building new Tauri commands without discussing the requirements and architectural impact with the founder first.
2. **Component Blueprinting:** Before writing a new complex feature (e.g., a new Web Speech integration), outline the Component hierarchy, the Zustand state needed, and the Tauri IPC calls required.
3. **Step-by-Step Implementation:** Build UI first with mocked data. Then, connect to Zustand state. Finally, connect the Tauri IPC backend.
4. **Validation:** Every UI PR/change must be validated for visual regressions across light/dark/pixel themes.

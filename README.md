<p align="center">
  <img src="public/logo/logo.png" alt="Cluaiz App" width="30%">
</p>

<h3 align="center">
The desktop app for Cluaiz: chat with your models, manage models and tools, explore the API and keep your notes, in one window</h3>

</br>
<p align="center">
  <img src="https://img.shields.io/badge/Status-In_development-red?style=for-the-badge" alt="Status">
  <img src="https://img.shields.io/badge/License-Apache_2.0-blue.svg?style=for-the-badge" alt="License">
  <img src="https://img.shields.io/badge/Built_with-Tauri_%26_React-24c8db?style=for-the-badge" alt="Tauri and React">
  <img src="https://img.shields.io/badge/Platform-Win_|_Mac_|_Linux-lightgrey?style=for-the-badge" alt="Platform">
</p>

<p align="center">
  <a href="https://cluaiz.com"><b>Website</b></a> &nbsp;|&nbsp;
  <a href="https://github.com/cluaiz/cluaiz"><b>Engine</b></a> &nbsp;|&nbsp;
  <a href="https://github.com/cluaiz/cluaiz-tools"><b>Tools</b></a> &nbsp;|&nbsp;
  <a href="https://discord.gg/mab8kBURz"><b>Discord</b></a>
</p>

> [!WARNING]
> **In development, not released yet.** The App is released after the Engine's pre-release ends. Until then there
> is no installer: you can build it from source as shown below to try it, but screens, settings and file layout
> change often. To use Cluaiz today, use the [Engine](https://github.com/cluaiz/cluaiz) and its terminal and API.

## About the Cluaiz App

The [Cluaiz Engine](https://github.com/cluaiz/cluaiz) runs and serves the models. The **App** is a desktop window
for the same work: chats, models, tools and settings.

The App does not run models itself. It talks to a running Cluaiz Engine, so a model is loaded once and shared by the
App, the terminal and your own programs at the same time.

## Screens in development

These screens exist in the code and change often. None of them is released yet.

| Screen | Purpose |
| :--- | :--- |
| **Chat** | Conversations with the models installed in the Engine |
| **Models** | The model catalogue, downloads, and loading a model |
| **Toolkit** | Skills, plugins and MCP servers from [Cluaiz Tools](https://github.com/cluaiz/cluaiz-tools) |
| **API** | An explorer for the Engine's routes and CEP methods |
| **Notebook and Library** | Notes and documents |
| **Settings** | Engine settings, permissions and API tokens, appearance |
| **Extensions** | Experimental local UI packages. See [local packages](src/extensions/packages/README.md) |

## How the App reaches the Engine

```mermaid
flowchart LR
    subgraph APP["Cluaiz App"]
        UI["React screens"] --> T["Transport<br/>(chosen explicitly)"]
        T -->|desktop| N["Tauri native host"]
    end

    N -->|"named pipe (Windows)<br/>Unix socket (macOS, Linux)"| G["Engine session<br/>token check"]
    T -->|"browser or HTTP setting"| H["Engine HTTP API<br/>/v1/... and /v1/cep"]
    H --> G
    G --> R["Engine router:<br/>chat, models, tools, settings, files"]
```

- **Desktop:** the App starts the Engine (`cluaiz serve --native-endpoint <path>`) and waits for an authenticated
  health reply before it says the Engine is ready. Each request has its own pipe or socket and can be cancelled.
- **Browser or HTTP:** the App uses the Engine's HTTP API with its session token, like any other client.
- Both paths reach the same Engine router, with the same permissions and approvals. There is no silent fallback
  from one to the other.

Details: [transport](src/api/client/README.md) and [native connector](app/src-tauri/src/core/engine/native/README.md).

## Run it from source

You need **Node.js 20.19 or newer** (for Vite 7), **Rust** (stable), the
[Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS, and the
[Cluaiz Engine](https://github.com/cluaiz/cluaiz#quick-start) installed. The App needs an Engine build that
supports `--native-endpoint`.

```bash
git clone https://github.com/cluaiz/cluaiz-app
cd cluaiz-app
npm install

npm run dev:desktop     # the desktop App, with hot reload
npm run dev:web         # the same screens in a browser, over HTTP
npm run build:desktop   # an installer for this OS
```

## Architecture

| Layer | Path | Responsibility |
| :--- | :--- | :--- |
| Native core (Rust, Tauri v2) | [`app/src-tauri/`](app/src-tauri/) | Window, Engine start and stop, native pipe transport, file access |
| Runtime bridge | [`src/core/`](src/core/) | Calls into the native core, Engine health |
| API contracts | [`src/api/`](src/api/) | Typed adapters for the Engine's HTTP routes and CEP methods |
| State | [`src/store/`](src/store/) | Zustand stores: chats, models, engine, layout |
| UI building blocks | [`src/components/`](src/components/) | Shared components, the app shell, file previews |
| Features | [`src/features/`](src/features/) | Chat, toolkit and catalogue, API explorer, notebook, library, settings, extensions |
| Extension SDK | [`packages/`](packages/) | `@cluaiz/extension-sdk` and `@cluaiz/extension-devkit` for local UI packages |

The full guide, with the rules every change follows, is [ARCHITECTURE_GUIDE.md](ARCHITECTURE_GUIDE.md). Every file
is listed in [Files.md](Files.md).

## Community

- **Found a bug, or something is missing?** [Open an issue](https://github.com/cluaiz/cluaiz-app/issues/new/choose).
- **Want to talk or help?** Join the [Discord](https://discord.gg/mab8kBURz).
- **Found a security problem?** Report it privately, as [SECURITY.md](SECURITY.md) describes.

Until it is released, the App takes issues and feedback but not pull requests. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

The Cluaiz App is released under the [Apache License 2.0](LICENSE).

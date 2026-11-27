<p align="center">
  <img src="public/logo/logo.png" alt="Cluaiz App" width="30%">
</p>

<h3 align="center">
Chat with Cluaiz, manage models and tools, and explore the API from a desktop window or a local browser.</h3>

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
> **In development.** Until the App pre-release is published, use the source build below
> or use the [Engine](https://github.com/cluaiz/cluaiz) from a terminal.

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

## Install the App

Once the pre-release is published, choose an installer from [App Releases](https://github.com/cluaiz/cluaiz-app/releases).

| System | Install and launch |
| --- | --- |
| Windows | Run the `.exe` or `.msi` installer. Setup adds the command to PATH by default. When the Engine is not installed yet, the `.exe` setup asks whether to install the latest Engine release for this computer; answering No is fine, the App asks again on start. Open **Cluaiz App** from Start or open a new terminal and run `cluaiz-app`. For managed MSI installs, set `CLUAIZADDTOPATH=0` to skip the machine PATH entry. |
| Linux | Install the `.deb` with `sudo apt install ./<file>.deb` or the `.rpm` with `sudo dnf install ./<file>.rpm`. Open the desktop entry or run `cluaiz-app`. |
| Linux AppImage | Make the download executable with `chmod +x ./<file>.AppImage`, then run it by path. Pass the same launcher flags after the filename. |
| macOS | Open the `.dmg`, drag the App into Applications and open it from there. To use flags, run the executable inside the App bundle at `/Applications/cluaiz App.app/Contents/MacOS/cluaiz-app` with the path quoted. The v0.1.0 DMG is unsigned and has not been notarized. |

## Open a window or use a browser

```sh
cluaiz-app
cluaiz-app --web
cluaiz-app --web --port 1420 --no-open
```

The first command opens the desktop window. With `--web`, the same executable serves the bundled UI
on `127.0.0.1` and opens your browser. It prints the final URL if it needs to move to the next free
port. Port 8000 and the configured Engine port are reserved. With `--no-open` you can open the URL
yourself. Press Ctrl+C to stop the web launcher. Node is needed to build the UI from source.

In an interactive Windows Command Prompt, use `start "" /wait /b cluaiz-app --web`
to keep the prompt waiting for the web launcher. Desktop shortcuts open the App window directly.

## How the App finds and starts the Engine

The launcher checks for a running Cluaiz Engine on loopback. It reads the port from `CLUAIZ_PORT`
when set, then from the Engine's saved configuration, and otherwise uses the Engine default.
The executable lookup checks `CLUAIZ_HOME/bin` when set. Otherwise it looks for a workspace install
and then `~/.cluaiz/bin`. If the Engine is installed and offline, the App starts `cluaiz serve`.
An Engine you started yourself keeps running when the App quits.

If the Engine is missing, the App shows the official install command and runs it only when you
choose **Install for me**. If you install in a separate terminal, use **Check again**. The launcher
uses the Engine's existing authentication. In browser mode, enter the Engine session token when prompted.

## Run it from source

You need **Node.js 24**, **Rust** (stable), the
[Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS, and the
[Cluaiz Engine](https://github.com/cluaiz/cluaiz#quick-start). Checkout the Engine source beside the App
for API documentation generation, or set `CLUAIZ_ENGINE_SOURCE` to that checkout.

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

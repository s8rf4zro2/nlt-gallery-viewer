# NLT Gallery Viewer

[![CI](https://github.com/d0nj/nlt-gallery-viewer/actions/workflows/ci.yml/badge.svg)](https://github.com/d0nj/nlt-gallery-viewer/actions/workflows/ci.yml)
[![Bun](https://img.shields.io/badge/Bun-1.4.2-black?logo=bun)](https://bun.sh)
[![Electron](https://img.shields.io/badge/Electron-44.4.3-47848F?logo=electron)](https://www.electronjs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A high-performance Electron desktop gallery viewer engineered for NLT Media RPG Maker cutscenes. It scans, indexes, groups, and streams video cutscenes with frame-accurate scrubbing, multi-part sequence navigation, synchronized in-game dialogue subtitles, and smart filtering.

---

## Supported Games

| Game | Engine | Cutscenes Path |
|---|---|---|
| **Treasure of Nadia** | RPG Maker MV | `www/movies/` |
| **The Genesis Order** | RPG Maker MV | `www/movies/` |
| **Symphony of the Serpent** | RPG Maker MZ | `movies/` |

---

## Key Features

- **Custom Streaming Protocol (`nlt-media://`)**:
  - Implements Chromium-compatible HTTP 206 Partial Content byte-range slicing.
  - Enables instant timeline scrubbing and seeking without loading entire video files into memory.

- **Virtualized 60fps Grid with DOM Element Recycling**:
  - Custom virtualized grid that only renders tiles within the visible viewport.
  - Recycled DOM card pool minimizes garbage collection pauses and handles 10,000+ cutscenes smoothly.
  - Fully responsive column layout that automatically adapts to window resizing and ultra-wide displays.

- **Intelligent Scene & Outfit Grouping**:
  - Automatically identifies and groups multi-part cutscenes into unified cards.
  - Outfits and variants (e.g. `O1`, `O2`, `NP`) are organized into non-interlaced sequential streams.
  - Alternate camera angles (`ALT`) are placed seamlessly at the end of their respective takes.

- **Synchronized In-Game Dialogue Subtitles**:
  - Extracts dialogue events directly from RPG Maker `CommonEvents.json`.
  - Authoritative character speaker resolution across all three games (Cole, Agrat, Michael, Hero, etc.).
  - Distinguishes linear story cutscenes with frame-accurate timestamps from looping dialogue scenes.
  - Interactive transcript drawer in the modal player with click-to-seek support.

- **Dynamic SFW / NSFW Filtering**:
  - Intelligent classifier distinguishing adult/erotic cutscenes from story, showcase, and system clips.
  - Default NSFW view with optional SFW view and full-text search across characters, scenes, and filenames.

- **One-Click Directory Auto-Discovery**:
  - Point to a parent directory (e.g. `D:\games`) to auto-detect and configure all installed titles simultaneously.
  - Automatically bridges differences between RPG Maker MV (`www/movies`) and MZ (`movies`) directory structures.

---

## Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                       Main Process                          │
│   main.js · src/main/*.js (Node.js / Electron APIs)         │
│   - Custom streaming protocol: nlt-media:// (protocol.js)   │
│   - Game directory auto-detection (roots.js, scanner.js)    │
│   - IPC Dispatcher (ipc.js) & Persistent Config (config.js) │
└──────────────────────────────┬──────────────────────────────┘
                               │
               IPC (Request/Response via nlt:*)
               Media Streams (nlt-media://)
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    Preload Context Bridge                   │
│   preload.cjs (CommonJS, contextBridge.exposeInMainWorld)   │
│   Exposes: window.nlt (safe async API wrapper)              │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                      Renderer Process                       │
│   renderer/ (Chromium Browser Context, Vanilla ESM)         │
│   - App controller & central state store (app.js)           │
│   - Virtualized scrolling grid (modules/virtual-grid.js)    │
│   - DOM tile element recycling (modules/tile-pool.js)       │
│   - Custom modal video player & scrubbing (player/*.js)     │
│   - Strict security: Zero Node.js builtins in renderer      │
└─────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Prerequisites

- **[Bun](https://bun.sh/)** `v1.4.2` or later
- **Node.js** `v20+` (required by Electron runtime)

### Installation

```bash
# Clone the repository
git clone https://github.com/d0nj/nlt-gallery-viewer.git
cd nlt-gallery-viewer

# Install dependencies with Bun
bun install
```

### Development

```bash
# Launch the Electron desktop application
bun run start

# Run the test suite (all unit & integration tests)
bun test

# Run build-time cutscene scanner manually
bun run scan
```

### Packaging & Distribution

```bash
# Package a standalone Windows 64-bit portable executable (.exe)
bun run build:portable

# Output will be located in dist/
# e.g. dist/NLT Gallery Viewer-Portable-0.1.0.exe
```

---

## Configuration & Environment Variables

- **Game Directories (`.cache/roots.json`)**: Configured automatically via the in-app **Folders / Setup** modal.
- **Environment Variable (`NLT_GAMES_ROOT`)**: You can supply game paths out-of-band:
  ```bash
  export NLT_GAMES_ROOT="D:\games;E:\visual-novels"
  ```

---

## Project Structure

```
├── main.js                  # Electron application entry point
├── preload.cjs              # Secure contextBridge wrapper exposing window.nlt
├── package.json             # Bun dependencies and electron-builder config
├── src/
│   ├── main/                # Main process modules (protocol, IPC, in-app scanner, roots)
│   └── shared/              # Shared decoder and feedback classification engine
├── renderer/                # Sandboxed Web frontend (Vanilla ESM, CSS, HTML)
│   ├── app.js               # Application state coordinator
│   ├── index.html           # Desktop UI shell
│   ├── modules/             # Virtual grid, tile pool, filtering, folder modal
│   ├── player/              # Video player controller, timeline rail, subtitle overlay
│   └── styles/              # Tokenized modular stylesheets
└── tests/                   # Native Bun unit test suites
```

---

## Testing

The test suite runs natively on Bun and verifies protocol streaming ranges, subtitle scheduling, outfit grouping, and virtual grid responsiveness:

```bash
bun test
```

---

## Disclaimer

This application is an independent, open-source viewer tool created for educational and archival purposes. It does **not** include, distribute, or bundle any copyrighted video assets, game data, or media from NLT Media titles. Users must provide their own legally obtained game installations.

---

## License

This project is licensed under the [MIT License](LICENSE).

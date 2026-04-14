# Morphase

**Local-first, open-source conversion router for files and media.**

Morphase converts documents, images, audio, video, and web pages using the best tool for the job — all on your machine, no cloud uploads required. It routes your request to the right backend automatically, so you never have to remember which tool handles which format.

## Highlights

- **Local-first** — files never leave your machine unless you explicitly fetch from the internet
- **Smart routing** — picks the best backend for your conversion, with scoring, fallbacks, and multi-step pipelines
- **Plugin-based** — each backend (FFmpeg, Pandoc, LibreOffice, etc.) is an isolated plugin detected at runtime
- **Interactive wizard** — run `morphase` with no arguments for a guided experience
- **Explain mode** — see exactly what Morphase will do before it does it

## Installation

```bash
# Install globally
npm install -g morphase

# Or run without installing
npx morphase --help
```

Morphase is a thin CLI in Node.js. The heavy lifting is done by external backends like FFmpeg, Pandoc, and LibreOffice, which you install separately through your system package manager. Morphase detects what you have at runtime and only offers routes you can actually run.

## Quick Start

```bash
# Interactive wizard (just run morphase with no arguments)
morphase

# Convert files
morphase convert presentation.pptx presentation.pdf
morphase convert README.md README.docx
morphase convert photo.heic photo.jpg
morphase convert recording.wav recording.mp3

# Convert images to PDF
morphase convert photo.jpg photo.pdf
morphase convert page1.jpg page2.jpg -o document.pdf

# Convert PDF pages to images
morphase convert report.pdf report.png

# Extract content
morphase extract paper.pdf --to markdown
morphase extract https://example.com --to markdown

# Fetch media from URLs
morphase fetch https://youtube.com/watch?v=dQw4w9WgXcQ --to mp3
morphase fetch https://youtube.com/watch?v=dQw4w9WgXcQ --to transcript

# Compress media
morphase image compress photo.jpg
morphase video compress movie.mov

# PDF operations
morphase pdf merge chapter1.pdf chapter2.pdf chapter3.pdf -o book.pdf
morphase pdf split report.pdf --pages 1-3,5 -o excerpt.pdf
morphase pdf optimize large.pdf -o smaller.pdf
morphase pdf extract-images document.pdf

# Diagnose your setup
morphase doctor
morphase backend list
morphase backend verify ffmpeg

# See what Morphase would do (without running anything)
morphase explain deck.pptx --to pdf
```

## How It Works

```
  Your command  →  Morphase Engine  →  Best matching plugin  →  External tool
```

1. You describe what you want (e.g. convert a PPTX to PDF)
2. The engine normalizes your request, infers the input/output types, and identifies the route
3. The planner scores every plugin that can handle the route (considering install status, health, quality, and preferences)
4. The highest-scoring installed plugin builds an execution plan
5. The executor runs the plan, validates outputs, and returns the result

If no single plugin can handle the route, Morphase checks curated multi-step pipelines (e.g. Markdown → DOCX → PDF chains Pandoc into LibreOffice).

## Stable Commands

All commands below are stable and tested:

| Command | Description |
|---------|-------------|
| `morphase convert <input> <output>` | Convert a file from one format to another |
| `morphase extract <input> --to <format>` | Extract content to text, markdown, etc. |
| `morphase fetch <url> --to <format>` | Download from a URL (YouTube, media sites, web pages) |
| `morphase media <input> --to <format>` | Convert audio or video formats |
| `morphase image compress <input>` | Compress a JPEG or PNG image |
| `morphase video compress <input>` | Compress a video file |
| `morphase pdf merge <inputs...> -o <out>` | Merge multiple PDFs |
| `morphase pdf split <input> --pages <range> -o <out>` | Extract pages from a PDF |
| `morphase pdf optimize <input> -o <out>` | Optimize/reduce PDF file size |
| `morphase pdf extract-images <input>` | Extract embedded images from a PDF |
| `morphase doctor` | Inspect health of all backends |
| `morphase backend list` | Show installed/uninstalled backends |
| `morphase backend status` | Detailed backend status |
| `morphase backend verify <id>` | Verify a specific backend |
| `morphase backend install <id>` | Show install hints for a backend |
| `morphase backend update <id>` | Show update hints for a backend |
| `morphase explain <input> --to <format>` | Show the plan without executing |
| `morphase serve` | Start local HTTP API server (experimental) |

### Common Options

All conversion commands accept:

| Flag | Description |
|------|-------------|
| `--from <kind>` | Explicitly set the input resource kind |
| `--backend <id>` | Force a specific backend plugin |
| `--offline` | Only use offline-capable backends |
| `--debug` | Enable debug logging |
| `--dry-run` | Plan the job without executing it |
| `--force` | Overwrite an existing output path |

### Fetch Options

The `fetch` command also accepts:

| Flag | Description |
|------|-------------|
| `--format <format>` | Transcript format: `text` or `markdown` |
| `--quality <quality>` | Quality level: `best`, `high`, `medium`, `low` |

### Serve Options

The `serve` command accepts:

| Flag | Description |
|------|-------------|
| `--host <addr>` | Bind address (default: `127.0.0.1`) |
| `--port <port>` | Bind port (default: `3210`) |
| `--allow-remote` | Allow non-localhost connections |

## Plugins

### Stable Plugins

| Plugin | ID | Handles | External Tool |
|--------|-----|---------|---------------|
| Pandoc | `pandoc` | Markdown/HTML → PDF, DOCX, TXT; HTML → Markdown | `pandoc` |
| LibreOffice | `libreoffice` | DOCX/PPTX/XLSX/ODF → PDF; PDF → DOCX | `soffice` |
| FFmpeg | `ffmpeg` | Audio/video conversion, video compression (H.265) | `ffmpeg` |
| ImageMagick | `imagemagick` | Image format conversion (JPG, PNG, WebP, HEIC) | `magick` |
| qpdf | `qpdf` | PDF merge, split, optimize | `qpdf` |
| Trafilatura | `trafilatura` | Web page → Markdown/text extraction | `trafilatura` |
| yt-dlp | `ytdlp` | YouTube/media site downloads | `yt-dlp` |
| img2pdf | `img2pdf` | Image(s) → PDF (lossless, multi-image support) | `img2pdf` |
| Poppler | `poppler` | PDF → PNG/JPG rendering, embedded image extraction | `pdftocairo` / `pdfimages` |

### Experimental Plugins

| Plugin | ID | Handles | External Tool |
|--------|-----|---------|---------------|
| Whisper | `whisper` | Audio/video → transcript (local transcription) | `whisper` |
| MarkItDown | `markitdown` | PDF/DOCX/PPTX/XLSX/HTML → Markdown | `markitdown` |
| jpegoptim | `jpegoptim` | JPEG compression | `jpegoptim` |
| optipng | `optipng` | PNG compression | `optipng` |
| summarize | `summarize` | YouTube transcript extraction, URL → Markdown | `summarize` |

Experimental plugins are functional but may have rough edges or narrower platform support.

### Removed Plugins

`docling`, `jina`, and `pngquant` have been removed from the project.

## Backend Philosophy

Morphase does **not** bundle any conversion tools. Each backend is a separate, independently installed tool (FFmpeg, Pandoc, LibreOffice, etc.) that you install through your system's package manager. Morphase:

- **Detects** what you have installed at runtime
- **Scores** each available backend for quality and health
- **Falls back** to alternatives if the preferred backend is missing or unhealthy
- **Tells you** exactly what to install when something is missing

This means Morphase stays small, and you only install the backends you actually need.

## doctor and explain Workflow

### Diagnosing Problems

```bash
# Check the health of every backend
morphase doctor

# Quick list of what's installed vs. missing
morphase backend list

# Detailed backend status
morphase backend status

# Verify a specific backend in detail
morphase backend verify ffmpeg

# Get an install hint for a missing backend
morphase backend install ffmpeg

# Run the install command (with confirmation prompt and config opt-in)
morphase backend install ffmpeg --run
```

`morphase doctor` reports on every backend: whether it's installed, which version, if it meets the minimum version requirement, verification issues, and platform-specific install instructions.

`backend install --run` and `backend update --run` are disabled by default. Enable them explicitly by setting `"allowPackageManagerDelegation": true` in `~/.morphase/config.json`.

### Previewing Plans

```bash
morphase explain deck.pptx --to pdf
```

This shows you which plugin Morphase would use, why it chose it, and any fallbacks — without running anything. Useful for debugging or understanding routing decisions.

## Supported Platforms

Official support covers three environments. Everything else is best-effort.

| OS | Package Manager | Install Example |
|----|----------------|-----------------|
| macOS | Homebrew | `brew install ffmpeg` |
| Windows | WinGet | `winget install Gyan.FFmpeg` |
| Ubuntu / Debian | apt-get | `sudo apt-get install ffmpeg` |

Morphase auto-detects your OS and package manager to provide tailored install hints.

## Route Matrix

Common conversion routes and their preferred backends:

| Route | Backend | Quality | Local-only |
|-------|---------|---------|------------|
| Markdown → PDF | Pandoc | High | Yes |
| Markdown → DOCX | Pandoc | High | Yes |
| Markdown → TXT | Pandoc | High | Yes |
| HTML → PDF | Pandoc | Medium | Yes |
| HTML → Markdown | Pandoc | High | Yes |
| HTML → DOCX | Pandoc | Medium | Yes |
| DOCX/PPTX/XLSX/ODF → PDF | LibreOffice | High | Yes |
| PDF → DOCX | LibreOffice | Medium | Yes |
| PDF → Markdown | MarkItDown | Medium | Yes |
| PDF → PNG/JPG | Poppler | High | Yes |
| PDF extract-images | Poppler | Medium | Yes |
| URL → Markdown | Trafilatura / summarize | High | No |
| URL → TXT | Trafilatura | High | No |
| JPG ↔ PNG | ImageMagick | High | Yes |
| WebP → PNG/JPG | ImageMagick | High | Yes |
| HEIC → JPG/PNG | ImageMagick | Best effort | Yes |
| JPG/PNG → PDF | img2pdf | High | Yes |
| MP4 → MP3 | FFmpeg | Medium | Yes |
| MOV/MKV → MP4 | FFmpeg | Medium | Yes |
| WAV → MP3 / MP3 → WAV | FFmpeg | Medium/High | Yes |
| PDF merge/split/optimize | qpdf | High | Yes |
| YouTube → MP4/MP3 | yt-dlp | Medium | No |
| YouTube → transcript | summarize / yt-dlp | High/Medium | No |
| Media site download | yt-dlp | Medium | No |

Multi-step pipelines handle routes with no direct backend (e.g. PDF → TXT chains MarkItDown into Pandoc).

See [docs/route-matrix.md](docs/route-matrix.md) for the complete route matrix with all experimental routes and install instructions.

## Configuration

Morphase reads optional configuration from `~/.morphase/config.json`:

```json
{
  "offlineOnly": false,
  "preferredBackends": {},
  "debug": false,
  "allowPackageManagerDelegation": false,
  "server": { "host": "127.0.0.1", "port": 3210 }
}
```

If the file is missing or invalid, defaults are used. You can override the preferred backend for any route via `preferredBackends` or the `--backend` CLI flag.

## Legal Notice

Some Morphase plugins can download media from YouTube, Instagram, TikTok, X/Twitter, Reddit, and other sites. Users are solely responsible for ensuring their use complies with the terms of service of the source platform and with applicable copyright and intellectual property laws. Morphase does not host, cache, or redistribute any downloaded content.

## Privacy

Morphase is local-first by design:

- **No cloud uploads** — file conversions happen entirely on your machine
- **No telemetry** — Morphase does not phone home or collect usage data
- **No accounts** — no sign-up, no API keys, no user tracking
- **Network is opt-in** — only `fetch` and `trafilatura` plugins use the network; all other routes work offline

## Development

Morphase is a pnpm monorepo:

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Type check
pnpm typecheck

# Run tests
pnpm test

# Run CLI in dev mode
pnpm dev

# Run tests in watch mode
pnpm test:watch
```

### Project Structure

```
morphase/
  apps/
    cli/                    # CLI (Commander + interactive wizard)
    server/                 # Local API server (Fastify, experimental)
  packages/
    shared/                 # Types, schemas, constants, utilities
    engine/                 # Core routing, planning, execution engine
    plugin-sdk/             # Plugin authoring helpers
    plugins/                # All builtin backend plugins (14 plugins)
  docs/                     # Architecture, route matrix, support matrix
  tests/                    # Planner, plugin, normalize-request, server tests
```

### Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and guidelines.

Good entry points:

- **New plugins** — implement the `MorphasePlugin` interface in `packages/plugins/`. Use `definePlugin()` from `@morphase/plugin-sdk` for type safety.
- **Bug fixes** — check the issue tracker for known bugs or run `morphase doctor` to find backend-specific issues.
- **Route coverage** — add new conversion routes to existing plugins by extending their `capabilities()` and `plan()` methods.
- **Tests** — the test suite lives in `tests/`. Add cases for new routes, edge cases, or platform-specific behavior.
- **Documentation** — improve guides, examples, or doc strings.

## Support

<a href="https://buymeacoffee.com/joeljstephen" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

## License

[MIT](LICENSE) © Morphase contributors

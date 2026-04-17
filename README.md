# Morphase

**Local-first, open-source conversion router for files and media.**

Morphase is a CLI that converts documents, images, audio, video, and web pages using whichever tool on your machine is best for the job. You say what you want; Morphase figures out which backend to run.

Nothing leaves your computer unless you explicitly fetch from the internet.

## Why Morphase

Converting files usually means remembering which tool handles which format, installing the right one, and stitching them together when no single tool can do the job.

Morphase does that part for you:

- One command, any format it can route.
- Picks the best installed backend automatically, with scoring and fallbacks.
- Chains tools when no direct route exists (e.g. Markdown → DOCX → PDF).
- Tells you exactly what's missing and how to install it.
- No cloud, no telemetry, no accounts.

Morphase itself stays small. The heavy lifting is done by external tools like FFmpeg, Pandoc, and LibreOffice, which you install separately through your system package manager. Morphase detects what you have at runtime and only offers routes you can actually run.

## Install

```bash
npm install -g morphase
```

You'll also need at least one backend installed on your system (FFmpeg, Pandoc, LibreOffice, etc.) depending on which routes you want. Run `morphase doctor` to see what's detected.

Running from source

```bash
git clone https://github.com/joeljstephen/morphase.git
cd morphase
pnpm install
pnpm build

# Run the CLI
pnpm dev -- --help
# or, after building:
node apps/cli/dist/index.js --help
```



## Quick start

```bash
# Interactive wizard
morphase

# Convert files
morphase convert presentation.pptx presentation.pdf
morphase convert README.md README.docx
morphase convert photo.heic photo.jpg

# Images ↔ PDF
morphase convert photo.jpg photo.pdf
morphase convert page1.jpg page2.jpg -o document.pdf
morphase convert report.pdf report.png

# Extract content from files or web pages
morphase extract paper.pdf --to markdown
morphase fetch https://example.com --to markdown

# Fetch media from URLs
morphase fetch https://youtube.com/watch?v=... --to mp3
morphase fetch https://youtube.com/watch?v=... --to transcript

# Compress
morphase image compress photo.jpg
morphase video compress movie.mov

# PDF operations
morphase pdf merge chapter1.pdf chapter2.pdf -o book.pdf
morphase pdf split report.pdf --pages 1-3,5 -o excerpt.pdf
morphase pdf optimize large.pdf -o smaller.pdf

# See what Morphase would do without running it
morphase explain deck.pptx --to pdf

# Diagnose your setup
morphase doctor
morphase backend list
```

All conversion commands accept `--from`, `--backend`, `--offline`, `--debug`, `--dry-run`, and `--force`.

## How it works

```
  Your command  →  Morphase engine  →  Best matching plugin  →  External tool
```

1. You describe what you want (e.g. convert a PPTX to PDF).
2. The engine normalizes the request and figures out the route.
3. The planner scores every plugin that can handle it, based on install status, health, quality, and your preferences.
4. The best installed plugin builds an execution plan.
5. The executor runs it, validates the output, and returns the result.

If no single plugin can handle the route, Morphase checks curated multi-step pipelines (e.g. Markdown → DOCX → PDF chains Pandoc into LibreOffice).

See [docs/architecture.md](docs/architecture.md) for a deeper walkthrough.

## Supported platforms

Morphase runs anywhere the required backend binaries are installed. Install guidance is environment-aware: it detects your OS, distro, and package managers, then shows the right command when it can — and honest manual instructions when it can't.


| Environment         | Install hint example                        |
| ------------------- | ------------------------------------------- |
| macOS with Homebrew | `brew install ffmpeg`                       |
| Windows with WinGet | `winget install Gyan.FFmpeg`                |
| Ubuntu / Debian     | `sudo apt-get install ffmpeg`               |
| Fedora / RHEL       | `sudo dnf install ffmpeg` or `sudo yum ...` |
| Arch / Manjaro      | `sudo pacman -S ffmpeg`                     |
| openSUSE            | `sudo zypper install ffmpeg`                |
| NixOS               | `nix profile install nixpkgs#ffmpeg`            |
| FreeBSD / OpenBSD   | `sudo pkg install ffmpeg`                       |


**Support tiers:**

- **Well-supported** — Morphase detects your package manager and the plugin has a strategy for it. You get the exact command.
- **Best effort** — The plugin has strategies but not for your package manager. You get manual instructions instead of a wrong command.
- **Manual only** — No compatible package manager detected. Clear manual guidance.

Run `morphase doctor` to see what's detected and what's missing.

## Documentation

- [Architecture](docs/architecture.md) — how the engine, plugins, and pipelines fit together
- [Route matrix](docs/route-matrix.md) — full list of stable and experimental routes
- [Plugin authoring](docs/plugin-authoring.md) — contract and SDK guide for new plugins
- [Contributing](CONTRIBUTING.md) — setup, PR flow, issue reporting

## Privacy and legal

Morphase is local-first by design: no cloud uploads, no telemetry, no accounts, no API keys. Network-backed routes (`fetch`, URL extraction) are clearly marked and opt-in.

Some plugins can download media from YouTube and other sites. Morphase does not host, cache, or redistribute any content. You are solely responsible for ensuring your use complies with the source platform's terms of service and applicable copyright law.

## Support the project

If Morphase saves you time, consider supporting development:



## License

[MIT](LICENSE) © Morphase contributors
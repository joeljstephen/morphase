# Morphase

**Local-first, open-source conversion router for files, media, PDFs, and web content.**

Morphase is a CLI that routes each request to the best backend already available on your machine. You ask for a conversion, extraction, fetch, or file operation; Morphase detects what is installed, chooses a healthy backend, and runs the right command.

Nothing leaves your machine unless you explicitly use a network-backed route such as `fetch`.

## Why Morphase

Working with files usually means remembering which tool handles which format, installing it, and falling back to awkward manual pipelines when one tool is not enough.

Morphase handles that coordination:

- One CLI for documents, images, audio, video, PDFs, and URL-backed extraction.
- Automatic backend selection based on route support, install status, health, and quality.
- Curated multi-step pipelines when no direct backend can produce the result.
- Environment-aware install guidance when a backend is missing.
- No cloud service, no telemetry, no account requirement.

Morphase itself stays small. Backends such as FFmpeg, Pandoc, LibreOffice, qpdf, Poppler, yt-dlp, and ImageMagick do the heavy lifting.

## Install

```bash
npm install -g morphase
```

Morphase does not bundle backend tools. After installing the CLI, run:

```bash
morphase doctor
```

That shows which backends are already available and which routes need an extra install.

### Running from source

The repo is pinned to `pnpm@10.2.0`, so use Corepack:

```bash
git clone https://github.com/joeljstephen/morphase.git
cd morphase
corepack pnpm install
corepack pnpm build

# Dev mode
corepack pnpm dev -- --help

# Built CLI
node apps/cli/dist/index.js --help
```

## Quick start

```bash
# Interactive wizard
morphase

# File conversions
morphase convert presentation.pptx presentation.pdf
morphase convert README.md README.docx
morphase convert photo.heic photo.jpg

# Image <-> PDF
morphase convert photo.jpg photo.pdf
morphase convert page1.jpg page2.png -o document.pdf
morphase convert report.pdf cover.png   # renders the first page

# Extraction
morphase extract paper.pdf --to markdown
morphase media ./podcast.mp3 --to transcript -o transcript.txt

# URL-backed routes
morphase fetch 'https://example.com/article' --to markdown
morphase fetch 'https://youtube.com/watch?v=...' --to transcript
morphase fetch 'https://youtube.com/watch?v=...' --to mp3

# File operations
morphase image compress photo.jpg
morphase video compress movie.mov
morphase pdf merge chapter1.pdf chapter2.pdf -o book.pdf
morphase pdf split report.pdf --pages 1-3,5 -o excerpt.pdf
morphase pdf optimize large.pdf -o smaller.pdf
morphase pdf extract-images report.pdf -o report-images

# Planning and diagnostics
morphase explain deck.pptx --to pdf
morphase doctor
morphase backend list
morphase backend verify ffmpeg
```

Most conversion and operation commands accept `--from`, `--backend`, `--offline`, `--debug`, `--dry-run`, and `--force`.

## Install guidance

Morphase resolves install hints against the current runtime environment:

- It detects the OS and, on Linux, the distro family.
- It probes for supported package managers in environment-specific priority order.
- It picks a matching install strategy for the backend when one exists.
- If no compatible strategy matches, it falls back to honest manual guidance instead of printing a guessed command.

Common package managers are the best-supported path: Homebrew, WinGet, Chocolatey, Scoop, apt, dnf, yum, pacman, zypper, nix, pip/pipx, npm, and `pkg` on BSD systems.

Examples of exact commands Morphase can emit:

| Environment | Example |
| --- | --- |
| macOS with Homebrew | `brew install ffmpeg` |
| Windows with WinGet | `winget install -e --id Gyan.FFmpeg` |
| Ubuntu / Debian | `sudo apt-get install ffmpeg` |
| Fedora / RHEL | `sudo dnf install ffmpeg` |
| Arch / Manjaro | `sudo pacman -S ffmpeg` |
| openSUSE | `sudo zypper install ffmpeg` |
| NixOS | `nix profile install nixpkgs#ffmpeg` |
| FreeBSD | `sudo pkg install ffmpeg` |

Useful commands:

```bash
morphase backend install ffmpeg
morphase backend update pandoc
```

`--run` can execute a suggested package-manager command, but only when:

- the hint is a structured package-manager command,
- the terminal is interactive, and
- `allowPackageManagerDelegation` is enabled in `~/.morphase/config.json`.

## How it works

```text
Your command -> Morphase engine -> selected plugin or pipeline -> external tool
```

1. The CLI parses a request.
2. The engine normalizes paths and infers the route.
3. The planner evaluates matching plugins for the current platform.
4. Healthy installed backends are preferred; missing or unhealthy ones are explained instead of run blindly.
5. If no direct backend can build a plan, Morphase tries a curated pipeline.
6. The executor runs the plan, validates outputs, and reports the result.

See [docs/architecture.md](docs/architecture.md) for the engine walkthrough.

## Platform support

Morphase can run anywhere the required backend binaries are available. What varies by environment is the quality of automatic install guidance.

- **Best supported**: common package managers with explicit plugin strategies.
- **Partial coverage**: Morphase recognizes the environment, but a given backend may only have manual guidance there.
- **Manual fallback**: no detected package manager or no compatible strategy.

That support model is intentional. Morphase prefers accurate partial coverage over guessed commands.

## Documentation

- [Architecture](docs/architecture.md)
- [Route matrix](docs/route-matrix.md)
- [Plugin authoring](docs/plugin-authoring.md)
- [Platform and package manager handling](docs/platform-and-package-manager-handling.md)
- [Contributing](CONTRIBUTING.md)

## Privacy and legal

Morphase is local-first by design: no cloud uploads, no telemetry, no accounts, no API keys.

Network-backed routes are explicit. If you use media-download or URL-fetching backends, you are responsible for complying with the source platform's terms and applicable law.

## License

[MIT](LICENSE) © Morphase contributors

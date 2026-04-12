# Release Ready — Morphase v0.1.0

This document defines what is stable, what is experimental, and what was intentionally deferred for Morphase v0.1.0.

---

## 1. What is stable for v0.1.0

### Stable commands

| Command | Description |
| --- | --- |
| `morphase convert` | Direct file conversion |
| `morphase extract` | Extract content to a target format |
| `morphase fetch` | Fetch a URL and convert to a target format |
| `morphase media` | Audio/video conversion |
| `morphase pdf merge` | Merge multiple PDFs |
| `morphase pdf split` | Split a PDF by page range |
| `morphase pdf optimize` | Optimize/linearize a PDF |
| `morphase doctor` | Inspect all backend health |
| `morphase backend verify` | Verify a single backend |
| `morphase explain` | Plan a route without executing |

### Stable plugins

| Plugin | Backend binary | Primary use |
| --- | --- | --- |
| `pandoc` | `pandoc` | Document and markup conversion |
| `libreoffice` | `soffice` | Office-family document to PDF |
| `ffmpeg` | `ffmpeg` | Audio/video conversion and compression |
| `imagemagick` | `magick` / `convert` | Image format conversion |
| `qpdf` | `qpdf` | PDF merge, split, optimize |
| `trafilatura` | `trafilatura` | URL to Markdown/text extraction |
| `ytdlp` | `yt-dlp` | YouTube/media URL download |

### Stable routes

| Route | Backend | Quality |
| --- | --- | --- |
| `markdown -> pdf` | pandoc | high |
| `markdown -> docx` | pandoc | high |
| `html -> pdf` | pandoc | medium |
| `html -> markdown` | pandoc | high |
| `docx -> pdf` | libreoffice | high |
| `pptx -> pdf` | libreoffice | high |
| `xlsx -> pdf` | libreoffice | high |
| `pdf -> docx` | libreoffice | best effort |
| `jpg -> png` | imagemagick | high |
| `png -> jpg` | imagemagick | high |
| `webp -> png` | imagemagick | high |
| `webp -> jpg` | imagemagick | high |
| `mp4 -> mp3` | ffmpeg | medium |
| `mov -> mp4` | ffmpeg | medium |
| `mkv -> mp4` | ffmpeg | medium |
| `wav -> mp3` | ffmpeg | medium |
| `mp3 -> wav` | ffmpeg | medium |
| `pdf merge` | qpdf | high |
| `pdf split` | qpdf | high |
| `pdf optimize` | qpdf | high |
| `url -> markdown` | trafilatura | high |
| `url -> txt` | trafilatura | high |
| `youtube-url -> mp4` | ytdlp | medium |
| `youtube-url -> mp3` | ytdlp + ffmpeg | medium |
| `youtube-url -> transcript` | summarize / ytdlp fallback | high/medium |
| `media-url -> mp4` | ytdlp | medium |
| `media-url -> mp3` | ytdlp + ffmpeg | medium |
| `media-url -> transcript` | ytdlp | medium |
| `image compress` | jpegoptim | high |
| `video compress` | ffmpeg | high |

---

## 2. What is experimental

Experimental features are shipped but not yet guaranteed stable. They may have incomplete error handling, limited test coverage, or behavior that could change in a patch release. Use them, but expect rough edges.

### Experimental commands and features

| Feature | Notes |
| --- | --- |
| `morphase serve` | HTTP API server (Fastify). Binds to `127.0.0.1:3210` by default. Endpoint surface and job model may evolve. |
| `morphase backend install --run` | Auto-executes the printed install command after confirmation. Delegates to the system package manager. |
| `morphase backend update --run` | Auto-executes the printed update command after confirmation. Delegates to the system package manager. |
| Any route not listed in the stable route matrix above | Routes not explicitly listed should be considered best-effort or unsupported. |

### Experimental plugins

| Plugin | Backend | Notes |
| --- | --- | --- |
| `whisper` | `whisper.cpp` / `faster-whisper` | Local transcription. Sub-backend selection and install guidance are still maturing. |
| `markitdown` | `markitdown` | PDF and document to Markdown extraction. May replace or complement pandoc for some extraction routes. |
| `jpegoptim` | `jpegoptim` | JPEG lossless/lossy optimization. Image compress route is experimental. |
| `optipng` | `optipng` | PNG optimization. Image compress route is experimental. |
| `summarize` | `@steipete/summarize` | YouTube transcript extraction and summarization. Requires Node 22+. |

---

## 3. What was intentionally deferred (and why)

These plugins and features were part of early planning but are not included in v0.1.0.

| Item | Reason for deferral |
| --- | --- |
| `docling` plugin | Heavier dependency with more complex install surface. Will be evaluated for v0.2.x when plugin maturity work begins. |
| `jina` plugin | Network-only backend that conflicts with local-first defaults. Deferred until offline/local fallback story is stronger and network disclosure UX is more polished. |
| `pngquant` plugin | Niche PNG quantization tool. Lower priority than jpegoptim and optipng for the initial image compress story. Can return if there is user demand. |

---

## 4. Release checklist

Before tagging v0.1.0, verify every item below.

### Build and type safety

- [ ] `pnpm build` passes with zero errors
- [ ] `pnpm typecheck` passes with zero errors
- [ ] `pnpm lint` passes with zero errors

### Tests

- [ ] `pnpm test` passes
- [ ] All stable routes have at least one integration or snapshot test
- [ ] Planner scoring tests cover route selection for core routes
- [ ] Plugin detection tests pass for all stable plugins

### CLI verification

- [ ] `morphase doctor` runs and reports backend health correctly
- [ ] `morphase explain notes.md --to pdf` produces a valid plan
- [ ] `morphase convert`, `extract`, `fetch`, `media`, `pdf merge`, `pdf split`, `pdf optimize` all work with real backends installed
- [ ] `morphase backend verify <id>` works for each stable plugin
- [ ] Error messages are actionable when a backend is missing

### Documentation

- [ ] README reflects current command set and install instructions
- [ ] CHANGELOG.md has a v0.1.0 entry with all notable changes
- [ ] docs/route-matrix.md is up to date with stable routes
- [ ] docs/support-matrix.md is up to date
- [ ] RELEASE_READY.md exists and reflects final scope (this file)

### Server mode (experimental)

- [ ] `morphase serve` starts and binds to `127.0.0.1:3210`
- [ ] `/health` endpoint returns OK
- [ ] `/capabilities` lists stable routes
- [ ] `/backends` reports plugin status

### Housekeeping

- [ ] Version in package.json is set to `0.1.0`
- [ ] No `TODO` or `FIXME` comments in stable command paths
- [ ] No debug `console.log` statements in production code
- [ ] Git tag `v0.1.0` is created and pushed

---

## 5. Known limitations

1. **Platform support is macOS-first.** Windows and Linux are best-effort for v0.1.0. Install hints exist but have not been tested end-to-end on all platforms.

2. **No HEIC output guarantee.** ImageMagick HEIC support depends on system delegates. The `heic -> jpg/png` routes may fail on some installations.

3. **PDF extraction is basic.** `pdf -> markdown` via markitdown is experimental. Complex layouts, scanned PDFs, and OCR are not supported yet.

4. **No batch processing.** Each command handles one job at a time. Multi-file and directory-level processing are planned for a future release.

5. **Server mode has no auth.** `morphase serve` binds to localhost only, but has no authentication, rate limiting, or TLS. Do not expose it to a network without a reverse proxy.

6. **`backend install --run` and `backend update --run` require confirmation.** They delegate to the system package manager. The printed command is shown before execution, but there is no dry-run for the delegated install itself.

7. **YouTube and media download legality.** The `ytdlp` plugin is optional and user-installed. Morphase does not grant rights to download or redistribute content. Users are responsible for compliance with terms of service and local law.

8. **Transcription quality varies.** The `whisper` plugin depends on the chosen sub-backend (`whisper.cpp` or `faster-whisper`) and the model used. Accuracy is not guaranteed and install guidance is still maturing.

9. **No config file documentation yet.** `~/.morphase/config.json` is supported internally but is not yet documented for end users. Full config documentation is planned for v0.3.x.

10. **Progress indicators are minimal.** Long-running conversions show limited progress feedback. Improved progress reporting is planned for v0.3.x.

# Muxory

Muxory is a local-first, open-source conversion router. It presents one CLI and one shared engine across documents, PDFs, images, media, and web extraction, then routes each request to the best available backend such as Pandoc, LibreOffice, FFmpeg, qpdf, ImageMagick, Trafilatura, MarkItDown, Docling, yt-dlp, or Whisper.

## What it supports

- Documents and markup: `md -> pdf`, `md -> docx`, `html -> pdf`, `html -> md`, `docx -> pdf`, `pptx -> pdf`, `xlsx -> pdf`
- PDF operations: `pdf -> markdown`, `pdf -> txt`, `pdf merge`, `pdf split`, `pdf optimize`
- Images: `jpg -> png`, `png -> jpg`, `webp -> png`, `webp -> jpg`, `heic -> jpg/png` best effort
- Audio and video: `mp4 -> mp3`, `mov -> mp4`, `mkv -> mp4`, `wav -> mp3`, `mp3 -> wav`
- Web extraction: `url -> markdown`, `url -> txt`
- Optional plugins: YouTube fetch and local transcription

## Install

1. Install the workspace dependencies with `pnpm install`
2. Build the monorepo with `pnpm build`
3. Run the CLI with `pnpm --filter muxory-cli dev` during development or execute the built binary from `apps/cli/dist/index.js`

Muxory intentionally does not install every backend up front. It detects them on demand and explains how to install or update them when you need a route.

## Guided mode

Run:

```bash
muxory
```

This launches the beginner-friendly wizard, asks what you want to do, plans the route, checks backend availability, and then shows the equivalent direct command after execution.

## Direct commands

```bash
muxory convert deck.pptx deck.pdf
muxory extract paper.pdf --to markdown
muxory fetch https://example.com/article --to markdown
muxory media input.mp4 --to mp3
muxory pdf merge a.pdf b.pdf -o merged.pdf
muxory pdf split report.pdf --pages 1-3 -o excerpt.pdf
muxory doctor
muxory backend verify ffmpeg
muxory explain notes.md --to pdf
muxory serve
```

## Backend installation and doctor

Use `muxory doctor` to inspect the whole backend matrix. Use `muxory backend verify <id>` for one backend and `muxory backend install <id>` or `muxory backend update <id>` to print the correct package-manager command for the current platform.

## Server mode

Run:

```bash
muxory serve
```

By default the Fastify server binds to `127.0.0.1:3210` and exposes health, capabilities, backend info, and job endpoints using the same engine as the CLI.

## Repository layout

- `apps/cli`: interactive and direct CLI
- `apps/server`: local API server
- `packages/engine`: routing, planning, execution, doctor, jobs, config, platform
- `packages/plugin-sdk`: plugin authoring helpers
- `packages/plugins`: builtin backend plugins
- `packages/shared`: shared types, schemas, constants, and utilities
- `docs`: architecture and support docs
- `tests`: planner and plugin tests

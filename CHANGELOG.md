# Changelog

All notable changes to Morphase will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

## [0.1.1] - 2026-04-17

### Changed

- Synchronized README and reference docs with the current route, plugin, and install-guidance model
- Updated platform and package-manager documentation to match actual runtime detection and strategy resolution
- Tightened route documentation around Poppler PDF rendering, manual fallbacks, and backend-selection behavior
- Improved CLI install and update hints to show manual fallback guidance, notes, and documentation URLs when available
- Included backend verification warnings in doctor output
- Clarified CLI validation errors for image and video compression commands

## [0.1.0] - 2026-04-11

### Added

- CLI with convert, extract, fetch, media, image compress, video compress, pdf merge/split/optimize/extract-images commands
- Interactive wizard for guided file operations
- `morphase doctor` for backend health inspection
- `morphase explain` for route planning without execution
- `morphase backend list/status/verify/install/update` for backend management
- Shared engine architecture with plugin registry, planner, executor, doctor, and job manager
- Plugin SDK for consistent plugin authoring
- Stable plugins: pandoc, libreoffice, ffmpeg, imagemagick, qpdf, trafilatura, ytdlp, img2pdf, poppler
- Experimental plugins: whisper, markitdown, jpegoptim, optipng, summarize
- Curated multi-step pipelines for indirect conversion routes
- Structured error reporting with likely cause and suggested fixes
- Offline mode support
- Dry-run support
- Debug logging
- `--force` flag to overwrite existing output paths
- Config file support at `~/.morphase/config.json`

### Removed

- docling plugin (deferred)
- jina plugin (deferred)
- pngquant plugin (deferred)
